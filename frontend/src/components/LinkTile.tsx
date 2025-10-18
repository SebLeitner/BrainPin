"use client";

import { PencilSquareIcon, TrashIcon } from "@heroicons/react/24/outline";
import { useMemo } from "react";
import { useLinksStore, type LinkItem } from "@/store/useLinksStore";

export type LinkTileProps = {
  link: LinkItem;
  onEdit: (link: LinkItem) => void;
};

export function LinkTile({ link, onEdit }: LinkTileProps) {
  const { deleteLink, categories } = useLinksStore((state) => ({
    deleteLink: state.deleteLink,
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
    <div className="group flex flex-col justify-between rounded-2xl border border-slate-800 bg-slate-900/70 p-4 shadow hover:border-brand-500/70 hover:shadow-brand-500/20">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-brand-300">{categoryName}</p>
          <h3 className="mt-1 text-lg font-semibold text-slate-100" title={link.name}>
            {link.name}
          </h3>
          {link.description ? (
            <p className="mt-2 text-sm text-slate-300 max-h-20 overflow-hidden text-ellipsis">{link.description}</p>
          ) : null}
        </div>
        <div className="flex gap-2 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            type="button"
            onClick={() => onEdit(link)}
            className="rounded-full border border-slate-700 p-2 text-slate-300 hover:border-brand-500 hover:text-brand-200"
            aria-label="Link bearbeiten"
          >
            <PencilSquareIcon className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => deleteLink(link.id)}
            className="rounded-full border border-rose-600 p-2 text-rose-400 hover:bg-rose-600/10 hover:text-rose-300"
            aria-label="Link löschen"
          >
            <TrashIcon className="h-5 w-5" />
          </button>
        </div>
      </div>
      <a
        href={link.url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 inline-flex items-center justify-between rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-slate-950 shadow-lg shadow-brand-500/30 transition hover:bg-brand-400"
      >
        Öffnen
        <span className="text-xs font-normal text-slate-900/80">{hostname}</span>
      </a>
    </div>
  );
}
