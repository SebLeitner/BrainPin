"use client";

import { useEffect, useMemo } from "react";
import Link from "next/link";
import { Cog6ToothIcon } from "@heroicons/react/24/outline";
import { CategoryFilter } from "@/components/CategoryFilter";
import { LinkTile } from "@/components/LinkTile";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { useLinksStore } from "@/store/useLinksStore";

export default function HomePage() {
  const { links, activeCategoryId, isLoading, error, loadLinks } = useLinksStore((state) => ({
    links: state.links,
    activeCategoryId: state.activeCategoryId,
    isLoading: state.isLoading,
    error: state.error,
    loadLinks: state.loadLinks
  }));

  useEffect(() => {
    void loadLinks();
  }, [loadLinks]);

  const filteredLinks = useMemo(() => {
    if (!activeCategoryId || activeCategoryId === "all") {
      return links;
    }
    return links.filter((link) => link.categoryId === activeCategoryId);
  }, [links, activeCategoryId]);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-10 px-4 py-10 sm:px-8">
      <header className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-50 sm:text-4xl">BrainPin</h1>
        </div>
        <Link
          href="/settings"
          className="inline-flex items-center gap-2 self-start rounded-full border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-brand-400 hover:text-brand-100"
        >
          <Cog6ToothIcon className="h-5 w-5" />
          Einstellungen
        </Link>
      </header>

      <section className="space-y-4">
        {isLoading ? (
          <LoadingSpinner
            label="Links und Kategorien werden geladen…"
            className="mx-auto rounded-2xl border border-slate-800 bg-slate-900/60 p-6"
          />
        ) : null}
        {error ? (
          <div className="rounded-2xl border border-rose-500/60 bg-rose-900/20 p-4 text-sm text-rose-200">
            <p className="font-medium">Ein Fehler ist aufgetreten.</p>
            <p className="mt-1 text-rose-100/80">{error}</p>
            <button
              type="button"
              onClick={() => {
                void loadLinks({ force: true });
              }}
              className="mt-3 inline-flex items-center rounded-full border border-rose-400 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-rose-100 transition hover:border-rose-200 hover:text-rose-50"
            >
              Erneut laden
            </button>
          </div>
        ) : null}
        <CategoryFilter />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filteredLinks.map((link) => (
            <LinkTile key={link.id} link={link} />
          ))}
          {filteredLinks.length === 0 && !isLoading ? (
            <p className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/60 p-6 text-sm text-slate-400">
              Noch keine Links in dieser Kategorie. Füge neue Links hinzu, um deine Sammlung zu erweitern.
            </p>
          ) : null}
        </div>
      </section>
    </main>
  );
}
