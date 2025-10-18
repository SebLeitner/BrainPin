"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Cog6ToothIcon } from "@heroicons/react/24/outline";
import { CategoryFilter } from "@/components/CategoryFilter";
import { LinkTile } from "@/components/LinkTile";
import { useLinksStore } from "@/store/useLinksStore";

export default function HomePage() {
  const { links, activeCategoryId } = useLinksStore((state) => ({
    links: state.links,
    activeCategoryId: state.activeCategoryId
  }));

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
        <CategoryFilter />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filteredLinks.map((link) => (
            <LinkTile key={link.id} link={link} />
          ))}
          {filteredLinks.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/60 p-6 text-sm text-slate-400">
              Noch keine Links in dieser Kategorie. Füge neue Links hinzu, um deine Sammlung zu erweitern.
            </p>
          ) : null}
        </div>
      </section>
    </main>
  );
}
