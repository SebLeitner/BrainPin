# README – Entwickler-Maschine in AWS EC2

## Überblick
Diese Anleitung beschreibt, wie du eine kleine Entwickler-Maschine auf Basis einer Amazon-EC2-Instanz bereitstellst. Die Instanz stellt sowohl eine klassische SSH-Verbindung als auch einen webbasierten Terminalzugriff (CLI im Browser) zur Verfügung. Die Schritte umfassen Planung, Einrichtung, Absicherung und laufende Wartung.

---

## Architekturübersicht

1. **Netzwerk**
   - Nutzung eines dedizierten VPC-Subnets (privat oder öffentlich, abhängig vom Bedarf).
   - Security Groups zur Kontrolle eingehender Verbindungen (z. B. Port 22 für SSH, Port 443 für den webbasierten Terminalzugang).
   - Optional: AWS Systems Manager Session Manager als zusätzliche, sichere Zugriffsmöglichkeit ohne offene SSH-Ports.

2. **Compute**
   - EC2-Instanz (z. B. Amazon Linux 2023, Ubuntu 22.04 LTS, t3.small/t3.medium je nach Bedarf).
   - Ausreichende CPU/RAM je nach Entwicklungs-Workloads.

3. **Speicher**
   - EBS-Volume (gp3) mit ausreichender Kapazität, ggf. zusätzliche Volumes für Daten.
   - S3 für Backups, Artefakte oder Konfigurationsdateien.

4. **Zugriff**
   - SSH über einen Key Pair oder AWS SSM Session Manager.
   - Webterminal via eigenem Dienst (z. B. `wetty`, `ttyd`, `code-server` Terminal, JetBrains Projector).

5. **Sicherheit**
   - TLS-Zertifikate (z. B. ACM oder Let’s Encrypt) für Browserzugriff.
   - Regelmäßige Updates, zentrale Protokollierung und Monitoring.

---

## Voraussetzungen

- AWS-Konto mit ausreichenden Rechten (EC2, VPC, IAM, ACM, Route 53 optional).
- Grundkenntnisse in Linux-Administration und AWS Networking.
- Domäne (optional) für TLS und komfortablen Browserzugriff.
- SSH-Key Pair (oder Bereitschaft, eines zu erstellen).
- Lokale Tools: AWS CLI, ggf. Terraform/CloudFormation bei Infrastructure-as-Code.

---

## Einrichtungsschritte

### 1. IAM & Sicherheit
1. Erstelle oder verwende einen IAM-Benutzer mit MFA, der EC2/VPC/IAM/ACM verwalten darf.
2. Lege ggf. IAM-Rollen fest:
   - Instanzprofil für EC2 zur Verwendung von SSM, S3, CloudWatch.
   - Rollen für Administrationsskripte.

### 2. Netzwerk & Zugriffsregeln
1. **VPC/Subnet**: Nutze ein vorhandenes VPC oder erstelle ein neues (z. B. 10.10.0.0/16).
2. **Security Group**:
   - Eingehend: TCP 22 (SSH) nur für deine IP oder VPN; TCP 443 (HTTPS) für den Browserzugriff.
   - Optional: TCP 80 nur für Let’s Encrypt-HTTP-01-Challenge.
3. **Network ACL**: Standard belassen oder restriktiver konfigurieren.
4. **Elastic IP** (optional) für stabile IPv4-Adresse.

### 3. EC2-Instanz starten
1. Wähle ein AMI (Amazon Linux 2023 oder Ubuntu 22.04 LTS).
2. Instanztyp: t3.small (Test/leichte Nutzung) oder t3.medium (mehr RAM).
3. Storage: Start mit 20–40 GB gp3; bei Bedarf erhöhen.
4. Weisen Instanzprofil (IAM-Rolle) zu, falls SSM/S3/CloudWatch genutzt werden.
5. Key Pair erstellen oder vorhandenes wählen.
6. Instanz in passendem Subnet starten.

### 4. Grundkonfiguration per SSH/SSM
1. Verbinde dich via SSH oder SSM Session Manager.
2. Führe Updates aus:
   - Amazon Linux: `sudo dnf update -y`
   - Ubuntu: `sudo apt update && sudo apt upgrade -y`
3. Installiere Entwicklungs-Tools:
   - Git, build-essential, Docker, Node.js, Python usw. je nach Bedarf.
4. Konfiguriere Shell (z. B. zsh, bash), Dotfiles, Paket-Manager (asdf, nvm, pyenv).
5. Richte optionale Tools wie `tmux`, `direnv`, `awscli`, `kubectl` ein.

### 5. Webbasierte CLI bereitstellen
1. **Variante A: Wetty (Node.js-basiert)**
   - Installiere Docker: `sudo dnf install -y docker` (Amazon Linux) oder `sudo apt install -y docker.io`.
   - Starte Docker-Dienst und füge Benutzer zur Gruppe hinzu.
   - Deploy Wetty:
     ```bash
     sudo docker run -d --name wetty \
       --restart always \
       -p 3000:3000 \
       svenihoney/wetty --command "/bin/bash"
     ```
   - Wetty leitet zu `/bin/bash`. Nutze User-Zugang via SSH-Key (z. B. `wetty`-Benutzer mit begrenzten Rechten).
2. **Variante B: ttyd**
   - `sudo dnf install -y ttyd` (Amazon Linux EPEL) oder Kompilieren aus Source.
   - Service erstellen (`systemd`) und auf Port 7681 lauschen lassen.
3. **Variante C: code-server**
   - Installiere `code-server` (VS Code im Browser, Terminal inklusive).
   - Konfiguriere Passwort oder GitHub OAuth.

### 6. Reverse Proxy & TLS
1. Installiere Nginx oder Caddy als Reverse Proxy.
2. Leite HTTPS (Port 443) auf deinen Webterminal-Port (3000/7681 etc.) weiter.
3. TLS-Optionen:
   - **AWS ACM**: Erstelle Zertifikat und nutze Application Load Balancer.
   - **Let’s Encrypt**: `certbot --nginx -d dev.example.com` (Port 80 vorübergehend öffnen).
4. Erzwinge HTTPS-Redirect und sichere Header (HSTS, X-Frame-Options).

### 7. SSH-Härtung
1. Nur Key-basierte Authentifizierung, Passwortlogin deaktivieren (`/etc/ssh/sshd_config`).
2. Fail2ban oder AWS WAF/Shield einsetzen.
3. Erwäge Port-Knocking oder VPN (AWS Client VPN, WireGuard) zur weiteren Absicherung.

### 8. Optional: Infrastructure as Code
- Terraform / CloudFormation Templates zur Reproduzierbarkeit.
- Parameter für Instanztyp, VPC, Subnet, Security Groups.

---

## Betrieb & Wartung

- **Monitoring**: CloudWatch Agent, Logs für SSH/Webterminal, Alarme für CPU/RAM.
- **Backups**: Regelmäßige AMI-Snapshots oder EBS-Snapshots; Konfigurationen in Git (Dotfiles).
- **Updates**: Automatische Sicherheitsupdates aktivieren (z. B. `yum-cron`, `unattended-upgrades`).
- **Skalierung**: Größeren Instanztyp wählen oder EBS vergrößern, wenn Leistung nicht ausreicht.
- **Benutzerverwaltung**: IAM + SSM oder zentrale Nutzerverwaltung (z. B. via AWS Directory Service).

---

## Sicherheits-Checkliste

- [ ] MFA für IAM-Accounts.
- [ ] Least-Privilege-Rollen für EC2/SSM.
- [ ] SSH-Port nur für vertrauenswürdige IPs/VPN.
- [ ] Webterminal mit Authentifizierung + HTTPS.
- [ ] Protokolle und Zugriffskontrolle überwachen.
- [ ] Regelmäßige Patches, CVE-Warnungen beachten.
- [ ] Notfall-Plan (Snapshots, Rollback).

---

## Kostenoptimierung

- Wähle Spot-Instanzen für nicht-kritische Nutzung (mit regelmäßigen Snapshots).
- Scheduler oder Lambda, um Instanz automatisch nachts zu stoppen.
- Nutze Savings Plans/Reserved Instances bei Dauerbetrieb.
- Überwache EBS- und Datenübertragungskosten.

---

## Troubleshooting

- **SSH funktioniert nicht**: Security Group prüfen, Key Pair, `sshd`-Status, Konsolen-Ausgabe via EC2 Console.
- **Webterminal nicht erreichbar**: Nginx/Proxy-Logs checken, Ports offen, Dienst läuft?
- **Hohe Latenz**: Regionale Nähe sicherstellen, ggf. Instance-Typ wechseln.
- **TLS-Fehler**: Zertifikat-Status, Ablaufdatum, ALB/Nginx-Konfiguration kontrollieren.

---

## Weiterführende Optionen

- Integration mit AWS Cloud9 oder GitHub Codespaces als Alternative.
- Automatisches Provisioning via Ansible, Chef oder Puppet.
- Teamzugang mit zentralem Identitätsmanagement (Azure AD, Okta, IAM Identity Center).
- Logging/Tracing in zentrale Systeme (ELK, Datadog).

---

## Testing
⚠️ Keine Tests ausgeführt (reine Dokumentationsaufgabe).
