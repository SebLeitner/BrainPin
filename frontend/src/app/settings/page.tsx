"use client";

import Link from "next/link";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import { useLinksStore } from "@/store/useLinksStore";

export default function SettingsPage() {
  const { categories, links } = useLinksStore((state) => ({
    categories: state.categories.filter((category) => category.id !== "all"),
    links: state.links
  }));

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-10 px-4 py-10 sm:px-8">
      <header className="flex flex-col gap-4">
        <Link
          href="/"
          className="inline-flex items-center gap-2 self-start rounded-full border border-slate-700 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-300 transition hover:border-brand-400 hover:text-brand-100"
        >
          <ArrowLeftIcon className="h-4 w-4" /> Zurück
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-slate-50">Einstellungen</h1>
          <p className="mt-2 text-base text-slate-300">
            Passe deine BrainPin-Erfahrung an. Kategorien verwalten, Links pflegen und Layout-Voreinstellungen dokumentieren.
          </p>
        </div>
      </header>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-slate-100">Status</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
            <p className="text-sm uppercase tracking-wide text-slate-400">Kategorien</p>
            <p className="mt-2 text-3xl font-bold text-brand-200">{categories.length}</p>
            <p className="mt-1 text-sm text-slate-400">
              Kategorien werden auf der Startseite als Filter angezeigt. Nutze die Buttons dort, um neue Kategorien anzulegen oder bestehende zu bearbeiten.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
            <p className="text-sm uppercase tracking-wide text-slate-400">Links</p>
            <p className="mt-2 text-3xl font-bold text-brand-200">{links.length}</p>
            <p className="mt-1 text-sm text-slate-400">
              Verwalte deine Links direkt aus der Startseite heraus. Du kannst jeden Eintrag öffnen, bearbeiten oder löschen.
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-slate-100">Tipps</h2>
        <div className="space-y-3 text-sm text-slate-300">
          <p>
            • Verwende sprechende Kurz-Namen (≤16 Zeichen), damit deine Kacheln auch auf kleinen Bildschirmen lesbar bleiben.
          </p>
          <p>• Ziehe mobile Nutzer:innen in Betracht – Buttons und Kacheln sind bereits responsiv gestaltet.</p>
          <p>
            • Plane Kategorien so, dass jeder Link eindeutig zugeordnet werden kann. Doppelte Kategorien lassen sich jederzeit über die Dialoge entfernen.
          </p>
        </div>
      </section>
    </main>
  );
}
