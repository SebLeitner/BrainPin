"use client";

import { useMemo } from "react";
import { useLinksStore } from "@/store/useLinksStore";
import type { LinkItem } from "@/types/links";

export type LinkTileProps = {
  link: LinkItem;
};

export function LinkTile({ link }: LinkTileProps) {
  const { categories } = useLinksStore((state) => ({
    categories: state.categories
  }));

  const categoryName = useMemo(() => {
    return categories.find((category) => category.id === link.categoryId)?.name ?? "Unbekannt";
  }, [categories, link.categoryId]);

  const hostname = useMemo(() => {
    try {
      return new URL(link.url).hostname.replace(/^www\./, "");
    } catch {
      return link.url;
    }
  }, [link.url]);

  return (
    <a
      href={link.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex flex-col justify-between rounded-2xl border border-slate-800 bg-slate-900/70 p-4 text-left shadow transition hover:border-brand-500/70 hover:shadow-brand-500/20"
    >
      <div>
        <p className="text-xs uppercase tracking-wide text-brand-300">{categoryName}</p>
        <h3 className="mt-1 text-lg font-semibold text-slate-100" title={link.name}>
          {link.name}
        </h3>
        {link.description ? (
          <p className="mt-2 max-h-20 overflow-hidden text-ellipsis text-sm text-slate-300">{link.description}</p>
        ) : null}
      </div>
      <div className="mt-4 inline-flex items-center justify-between rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-slate-950 shadow-lg shadow-brand-500/30 transition group-hover:bg-brand-400">
        <span>Öffnen</span>
        <span className="text-xs font-normal text-slate-900/80">{hostname}</span>
      </div>
    </a>
  );
}
