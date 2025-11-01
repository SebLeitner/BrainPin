"use client";

import { useId, useMemo, useState } from "react";
import { shallow } from "zustand/shallow";

import { Modal } from "@/components/Modal";
import {
  selectHasSublinksByLinkId,
  selectSublinksByLinkId,
  useLinksStore
} from "@/store/useLinksStore";
import type { LinkItem } from "@/types/links";

export type LinkTileProps = {
  link: LinkItem;
};

export function LinkTile({ link }: LinkTileProps) {
  const [isSublinkDialogOpen, setSublinkDialogOpen] = useState(false);

  const categoryNames = useLinksStore(
    (state) => state.getCategoryNamesByIds(link.categoryIds),
    shallow
  );
  const categoryLabel =
    categoryNames.length > 0 ? categoryNames.join(" · ") : "Unbekannt";

  const sublinks = useLinksStore(
    useMemo(() => selectSublinksByLinkId(link.id), [link.id]),
    shallow
  );

  const hasSublinks = useLinksStore(
    useMemo(() => selectHasSublinksByLinkId(link.id), [link.id])
  );

  const sublinkDialogDescriptionId = useId();

  const hostname = useMemo(() => {
    try {
      return new URL(link.url).hostname.replace(/^www\./, "");
    } catch {
      return link.url;
    }
  }, [link.url]);

  return (
    <article className="group flex h-full flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-4 shadow transition hover:border-brand-500/70 hover:shadow-brand-500/20 focus-within:border-brand-400 focus-within:shadow-brand-500/20">
      <a
        href={link.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex flex-1 flex-col justify-between text-left"
      >
        <div>
          <p className="text-xs uppercase tracking-wide text-brand-300">{categoryLabel}</p>
          <h3 className="mt-1 text-lg font-semibold text-slate-100" title={link.name}>
            {link.name}
          </h3>
          {link.description ? (
            <p className="mt-2 max-h-20 overflow-hidden text-ellipsis text-sm text-slate-300">{link.description}</p>
          ) : null}
        </div>
        <div className="mt-4 inline-flex items-center justify-between rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-slate-950 shadow-lg shadow-brand-500/30 transition group-hover:bg-brand-400 group-focus-within:bg-brand-400">
          <span>Öffnen</span>
          <span className="text-xs font-normal text-slate-900/80">{hostname}</span>
        </div>
      </a>

      <button
        type="button"
        onClick={() => setSublinkDialogOpen(true)}
        disabled={!hasSublinks}
        aria-haspopup="dialog"
        aria-expanded={isSublinkDialogOpen}
        aria-controls={sublinkDialogDescriptionId}
        className="inline-flex items-center justify-center rounded-xl border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-brand-400 hover:text-brand-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-300 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {hasSublinks ? "Sublinks anzeigen" : "Keine Sublinks"}
      </button>

      <Modal
        open={isSublinkDialogOpen}
        title={`${link.name} – Sublinks`}
        descriptionId={sublinkDialogDescriptionId}
        onClose={() => setSublinkDialogOpen(false)}
      >
        {hasSublinks ? (
          <ul className="space-y-3" id={sublinkDialogDescriptionId}>
            {sublinks.map((sublink) => (
              <li key={sublink.id} className="rounded-xl border border-slate-800 bg-slate-900/80 p-3">
                <a
                  href={sublink.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-col gap-1 text-sm text-brand-200 transition hover:text-brand-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-300"
                >
                  <span className="text-sm font-semibold text-slate-100">{sublink.name}</span>
                  <span className="text-xs break-all text-slate-400">{sublink.url}</span>
                  {sublink.description ? (
                    <span className="text-xs text-slate-300">{sublink.description}</span>
                  ) : null}
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-300" id={sublinkDialogDescriptionId}>
            Für diesen Link wurden noch keine Sublinks hinterlegt.
          </p>
        )}
      </Modal>
    </article>
  );
}
