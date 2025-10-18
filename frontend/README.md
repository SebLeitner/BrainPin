# BrainPin Frontend

BrainPin ist eine Next.js-14-Anwendung mit App Router, die als persönliche Startseite für kuratierte Links dient. Kategorien lassen sich anlegen, filtern und verwalten, während Links als kompakte Kacheln dargestellt werden. Dieses Dokument beschreibt Architektur, lokale Entwicklung, Tests sowie den Deployment-Workflow – mit besonderem Fokus auf Hosting in AWS.

## Inhaltsverzeichnis
- [Technischer Überblick](#technischer-überblick)
- [Projektstruktur](#projektstruktur)
- [State-Management](#state-management)
- [Validierung & UX](#validierung--ux)
- [Lokale Entwicklung](#lokale-entwicklung)
- [Qualitätssicherung](#qualitätssicherung)
- [Deployment](#deployment)
  - [AWS Amplify Hosting](#aws-amplify-hosting)
  - [Alternative: S3 + CloudFront (Static Export)](#alternative-s3--cloudfront-static-export)
- [Anpassung von Kategorien und Links](#anpassung-von-kategorien-und-links)
- [Styling-Richtlinien](#styling-richtlinien)
- [Nützliche Befehle](#nützliche-befehle)

## Technischer Überblick
- **Framework:** [Next.js 14](https://nextjs.org/docs) im App-Router-Modus mit `src/app`-Verzeichnis.
- **Sprache:** TypeScript mit React 18.3.x.
- **Styling:** Tailwind CSS 3.4 mit erweiterten Farbvarianten für das BrainPin-Branding.
- **State:** [Zustand](https://github.com/pmndrs/zustand) als Client Store für Kategorien, Links und Filterstatus.
- **UI-Bausteine:** Headless UI Dialoge, Heroicons-Symbolik.
- **Validierung:** Clientseitige 16-Zeichen-Grenze für Link- und Kategorienamen; URLs und Beschreibungen besitzen optionale Felder.
- **Build Tooling:** ESLint (Next.js-Konfiguration), PostCSS, TypeScript.

## Projektstruktur
```
frontend/
├── src/
│   ├── app/
│   │   ├── layout.tsx         # RootLayout: globale Schriftarten & Shell
│   │   ├── globals.css        # Tailwind-Basis + Custom Styles
│   │   ├── page.tsx           # Startseite mit Filtern, Grid und Modals
│   │   └── settings/page.tsx  # Einstellungsseite mit Link-/Kategorie-Übersicht
│   ├── components/
│   │   ├── CategoryFilter.tsx     # Filterleiste inkl. Zustand-Bindung
│   │   ├── CategoryFormDialog.tsx # Modal zum Erstellen/Bearbeiten von Kategorien
│   │   ├── LinkFormDialog.tsx     # Modal zum Verwalten einzelner Links
│   │   ├── LinkTile.tsx           # Darstellung einzelner Link-Kacheln
│   │   └── Modal.tsx              # Headless UI Wrapper für Dialoge
│   └── store/
│       └── useLinksStore.ts       # Zentraler Zustand für Kategorien & Links
├── public/ (nicht angelegt)       # Platz für Favicons/Assets bei Bedarf
├── package.json
├── next.config.mjs
├── tailwind.config.ts
└── tsconfig.json
```

## State-Management
Der Zustand lebt vollständig im Client und wird über `useLinksStore` (Zustand) verwaltet. Der Store stellt folgende Methoden bereit:
- `setActiveCategory(id | null)` – Aktualisiert die ausgewählte Kategorie.
- `addCategory(name)` / `updateCategory(id, name)` / `deleteCategory(id)` – CRUD für Kategorien inklusive Verknüpfungslogik zu Links.
- `addLink(payload)` / `updateLink(id, payload)` / `deleteLink(id)` – CRUD für Links mit ID-Generierung via `nanoid`.
- `getFilteredLinks()` – Selektor, der Filterung serverunabhängig durchführt.

Da der Store derzeit lokal arbeitet, sind alle Daten initial im Frontend codiert. Für Persistenz kann der Store an eine API (REST/GraphQL) angebunden werden; dank zentraler Methoden genügt der Austausch der CRUD-Implementierungen.

## Validierung & UX
- Namen von Kategorien und Links werden auf `trim()` geprüft und dürfen maximal **16 Zeichen** lang sein.
- Beschreibungen und URLs sind optional, wobei URLs im Formular auf `type="url"` setzen.
- Dialoge bestätigen Löschvorgänge und schließen sich automatisch nach erfolgreichem Speichern.
- Das Layout ist responsiv: Kategorie-Buttons werden auf kleinen Bildschirmen horizontal scroll- und stapelbar dargestellt, Link-Kacheln nutzen ein CSS-Grid mit Breakpoints bei `sm` und `xl`.

## Lokale Entwicklung
### Voraussetzungen
- Node.js ≥ 18.17 (LTS empfohlen) und npm ≥ 9
- Optional: pnpm oder yarn, sofern das Lockfile ergänzt wird

### Setup & Start
```bash
cd frontend
npm install
npm run dev
```
Die Entwicklungsinstanz läuft standardmäßig unter `http://localhost:3000`. Hot Module Reloading ist aktiviert.

### Build & Produktionsstart
```bash
npm run build
npm run start
```
`next start` startet den Produktionsserver und sollte hinter einem Reverse Proxy (z. B. Nginx, AWS ALB) betrieben werden.

Für einen statischen Export (z. B. S3 + CloudFront) steht zusätzlich folgender Befehl zur Verfügung:

```bash
npm run build:static
```
Der Export landet im Ordner `out/`.

## Qualitätssicherung
- **Linting:** `npm run lint`
- **Type Checking:** Next.js führt während des Builds Typprüfungen aus. Für inkrementelle Checks kann `npx tsc --noEmit` verwendet werden.
- **Testing:** Momentan keine automatisierten Tests vorhanden. Für die Zukunft empfiehlt sich Playwright (End-to-End) oder React Testing Library.

## Deployment
### AWS Amplify Hosting
AWS Amplify ist der schnellste Weg, ein Next.js-14-Projekt mit SSR zu hosten.

1. **Repository verbinden:** Pushen Sie die Anwendung in ein Git-Repository (GitHub, GitLab oder CodeCommit). Melden Sie sich in der [AWS Amplify Console](https://console.aws.amazon.com/amplify/) an und verbinden Sie das Repo.
2. **Build-Einstellungen:** Amplify erkennt Next.js automatisch. Standard-Buildspec:
   ```yaml
   version: 1
   applications:
     - frontend:
         phases:
           preBuild:
             commands:
               - npm ci
           build:
             commands:
               - npm run build
         artifacts:
           baseDirectory: .next
           files:
             - '**/*'
         cache:
           paths:
             - node_modules/**
         customHeaders:
           - pattern: '/_next/static/*'
             headers:
               - key: Cache-Control
                 value: 'public, max-age=31536000, immutable'
   ```
   Amplify erstellt daraus automatisch eine Node-Lambda mit Edge-Funktionen für SSR/ISR.
3. **Umgebungsvariablen:** Derzeit nicht erforderlich. Legen Sie bei Bedarf (`AMPLIFY_BRANCH_ENV`, API-Keys etc.) in der Amplify-Konsole an.
4. **Domain:** Amplify stellt eine *.amplifyapp.com*-Domain bereit. Eigene Domains lassen sich via Route 53 oder externem Registrar verbinden.
5. **Continuous Deployment:** Commits auf dem verbundenen Branch triggern automatische Builds und Rollouts. Rollbacks können in der UI vorgenommen werden.

### GitHub Actions Deployment (S3 + CloudFront)
Dieses Repository enthält einen Workflow unter [`.github/workflows/deploy-frontend.yml`](../.github/workflows/deploy-frontend.yml), der den statischen Export automatisiert auf S3/CloudFront bereitstellt.

1. **Secrets konfigurieren:** Hinterlege in den Repository-Einstellungen die AWS-Credentials als Secrets `AWS_ACCESS_KEY_ID` und `AWS_SECRET_ACCESS_KEY`. Der verwendete Benutzer benötigt Zugriff auf `s3:List*`, `s3:PutObject*`, `s3:DeleteObject*` für den Bucket sowie `cloudfront:CreateInvalidation` für die Distribution.
2. **Optional: Region überschreiben:** Standardmäßig wird `eu-central-1` genutzt. Bei Bedarf kann über ein Repository- oder Organisations-Variable `AWS_REGION` ein anderer Wert gesetzt werden.
3. **Build & Deploy:** Bei Pushes auf `main`, die Dateien unter `frontend/` betreffen, führt der Workflow `npm run build:static` aus, synchronisiert `frontend/out` mit dem Bucket `brainpin-frontend-prod-140023375269` und invalidiert die CloudFront-Distribution `E2N7KMOABLKE5P`.
4. **Manueller Trigger:** Über den `workflow_dispatch`-Trigger lässt sich ein Deployment jederzeit manuell anstoßen.

> **Hinweis:** Die Infrastruktur (Terraform) wird weiterhin manuell verwaltet. Der Workflow führt ausschließlich den Upload des statischen Bundles sowie die Cache-Invalidierung durch.

### Alternative: S3 + CloudFront (Static Export)
Wenn ausschließlich statische Inhalte nötig sind, können Sie `next export` verwenden. Da die BrainPin-App keine serverseitigen Funktionen nutzt, ist eine statische Bereitstellung möglich.

1. **Konfiguration prüfen:** Stellen Sie sicher, dass `output: 'export'` in `next.config.mjs` gesetzt wird, falls nur statische Routen verwendet werden sollen.
2. **Export ausführen:**
   ```bash
   npm run build:static
   ```
   Der Export liegt im Verzeichnis `out/`.
3. **S3-Bucket anlegen:** Erstellen Sie einen öffentlichen (oder via CloudFront geschützten) S3-Bucket, aktivieren Sie statisches Website-Hosting.
4. **Dateien hochladen:** Laden Sie den `out/`-Ordner per AWS CLI (`aws s3 sync out/ s3://<bucket-name> --delete`) hoch.
5. **CloudFront einrichten:** Legen Sie eine CloudFront-Distribution mit dem S3-Bucket als Origin an, aktivieren Sie gzip/Brotli-Komprimierung und leiten Sie `404` auf `index.html` um.
6. **Domain & SSL:** Binden Sie optional eine eigene Domain über Route 53 an und erstellen Sie ein ACM-Zertifikat.

> **Hinweis:** Sobald serverseitige Funktionen (z. B. dynamische Routen, API-Routen) dazukommen, ist Amplify (oder AWS App Runner/Fargate) die geeignetere Option.

## Anpassung von Kategorien und Links
Die initialen Daten befinden sich in [`src/store/useLinksStore.ts`](src/store/useLinksStore.ts). Zum Anpassen:
- Passen Sie `initialCategories` und `initialLinks` an, um andere Standardwerte auszuliefern.
- Für Persistenz können Sie die CRUD-Methoden an API-Aufrufe koppeln oder eine Middleware (z. B. Zustand `persist`) verwenden.
- Möchten Sie Daten serverseitig laden, fügen Sie in `page.tsx` Server Actions oder `fetch`-Aufrufe hinzu und reichen Sie die Ergebnisse als Props an Client-Komponenten weiter.

## Styling-Richtlinien
- Nutzen Sie Tailwind Utility-Klassen. Farben sind in `tailwind.config.ts` unter `theme.extend.colors.brand` definiert.
- Globale Styles (z. B. Hintergrundverläufe, Schriftfarben) finden sich in [`src/app/globals.css`](src/app/globals.css).
- Neue Komponenten sollten als Client-Komponenten (`"use client";`) beginnen, wenn sie Zustand oder Hooks verwenden.

## Nützliche Befehle
| Zweck | Befehl |
|-------|--------|
| Dev-Server starten | `npm run dev` |
| Produktions-Build erstellen | `npm run build` |
| Produktionsserver lokal testen | `npm run start` |
| Linting ausführen | `npm run lint` |
| TypeScript-Check (manuell) | `npx tsc --noEmit` |
| Next.js-Version prüfen | `npx next info` |

---

Bei Fragen zum Hosting oder zur Erweiterung der App steht dieser Leitfaden als Ausgangspunkt bereit.
