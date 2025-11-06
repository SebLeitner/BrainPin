"use client";

import { useEffect, useMemo, useState } from "react";
import { PencilSquareIcon, PlusIcon, TrashIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";
import { shallow } from "zustand/shallow";

import { Modal } from "@/components/Modal";
import { SublinkFormDialog, type SublinkFormValues } from "@/components/SublinkFormDialog";
import { useLinksStore } from "@/store/useLinksStore";
import { extractPhoneNumber, isTelephoneUrl } from "@/lib/sublinks";
import type { LinkItem, SublinkItem } from "@/types/links";

const generateSublinkId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `sublink-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const deriveInitialCategoryIds = (
  categories: { id: string }[],
  source?: readonly string[]
): string[] => {
  if (categories.length === 0) {
    return [];
  }

  if (source && source.length > 0) {
    const availableIds = new Set(categories.map((category) => category.id));
    const filtered = source.filter((categoryId) => availableIds.has(categoryId));
    if (filtered.length > 0) {
      return filtered;
    }
  }

  return [categories[0].id];
};

export type LinkFormDialogProps = {
  open: boolean;
  mode: "create" | "edit";
  linkId?: string;
  initialValues?: Omit<LinkItem, "id">;
  onSubmit: (values: Omit<LinkItem, "id">) => Promise<void> | void;
  onDelete?: () => Promise<void> | void;
  onClose: () => void;
};

export function LinkFormDialog({
  open,
  mode,
  linkId,
  initialValues,
  onSubmit,
  onDelete,
  onClose
}: LinkFormDialogProps) {
  const allCategories = useLinksStore((state) => state.categories, shallow);
  const { addSublink, updateSublink, deleteSublink } = useLinksStore(
    (state) => ({
      addSublink: state.addSublink,
      updateSublink: state.updateSublink,
      deleteSublink: state.deleteSublink
    }),
    shallow
  );
  const liveLink = useLinksStore((state) =>
    linkId ? state.links.find((link) => link.id === linkId) ?? null : null
  );
  const categories = useMemo(
    () => allCategories.filter((category) => category.id !== "all"),
    [allCategories]
  );
  const [name, setName] = useState(initialValues?.name ?? "");
  const [url, setUrl] = useState(initialValues?.url ?? "");
  const [description, setDescription] = useState(initialValues?.description ?? "");
  const [categoryIds, setCategoryIds] = useState<string[]>(
    () => deriveInitialCategoryIds(categories, initialValues?.categoryIds)
  );
  const [sublinks, setSublinks] = useState<SublinkItem[]>(
    (initialValues?.sublinks ?? []).map((sublink) => ({ ...sublink }))
  );
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setSubmitting] = useState(false);
  const [isDeleting, setDeleting] = useState(false);
  const [isSublinkDialogOpen, setSublinkDialogOpen] = useState(false);
  const [sublinkDialogMode, setSublinkDialogMode] = useState<"create" | "edit">("create");
  const [activeSublinkId, setActiveSublinkId] = useState<string | null>(null);
  const [sublinkDraft, setSublinkDraft] = useState<SublinkFormValues>({
    name: "",
    url: "",
    description: ""
  });
  const [isSublinkSubmitting, setSublinkSubmitting] = useState(false);
  const [pendingSublinkId, setPendingSublinkId] = useState<string | null>(null);
  const [sublinkListError, setSublinkListError] = useState<string | null>(null);
  const activeSublink = useMemo(() => {
    if (!activeSublinkId) {
      return null;
    }

    return sublinks.find((item) => item.id === activeSublinkId) ?? null;
  }, [activeSublinkId, sublinks]);
  const hasPhoneSublink = useMemo(
    () => sublinks.some((item) => isTelephoneUrl(item.url)),
    [sublinks]
  );
  const allowPhoneType =
    !hasPhoneSublink || (activeSublink ? isTelephoneUrl(activeSublink.url) : false);

  const hasCategories = categories.length > 0;
  const isBusy =
    isSubmitting || isDeleting || isSublinkSubmitting || pendingSublinkId !== null;

  const toggleCategory = (categoryId: string) => {
    if (isBusy) {
      return;
    }

    setCategoryIds((current) => {
      const nextSelection = new Set(current);
      if (nextSelection.has(categoryId)) {
        nextSelection.delete(categoryId);
      } else {
        nextSelection.add(categoryId);
      }

      return categories
        .filter((category) => nextSelection.has(category.id))
        .map((category) => category.id);
    });
  };

  useEffect(() => {
    setName(initialValues?.name ?? "");
    setUrl(initialValues?.url ?? "");
    setDescription(initialValues?.description ?? "");
    setCategoryIds(deriveInitialCategoryIds(categories, initialValues?.categoryIds));
    setSublinks((initialValues?.sublinks ?? []).map((sublink) => ({ ...sublink })));
    setError(null);
    setSubmitting(false);
    setDeleting(false);
    setSublinkDialogOpen(false);
    setActiveSublinkId(null);
    setSublinkDraft({ name: "", url: "", description: "" });
    setSublinkSubmitting(false);
    setPendingSublinkId(null);
    setSublinkListError(null);
  }, [initialValues, open, categories]);

  useEffect(() => {
    if (mode === "edit" && liveLink) {
      setSublinks(liveLink.sublinks.map((sublink) => ({ ...sublink })));
    }
  }, [liveLink, mode]);

  const canSubmit = useMemo(() => {
    const trimmed = name.trim();
    return (
      Boolean(trimmed) &&
      trimmed.length <= 16 &&
      Boolean(url.trim()) &&
      categoryIds.length > 0 &&
      hasCategories &&
      !isSublinkSubmitting &&
      pendingSublinkId === null
    );
  }, [name, url, categoryIds, hasCategories, isSublinkSubmitting, pendingSublinkId]);

  const handleSubmit = async () => {
    if (isSubmitting || isDeleting || isSublinkSubmitting || pendingSublinkId !== null) {
      return;
    }

    const trimmedName = name.trim();
    const trimmedUrl = url.trim();
    if (!trimmedName) {
      setError("Name darf nicht leer sein.");
      return;
    }
    if (trimmedName.length > 16) {
      setError("Maximal 16 Zeichen erlaubt.");
      return;
    }
    if (!trimmedUrl) {
      setError("Bitte gib eine URL an.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const trimmedDescription = description.trim();
      const normalizedSublinks = sublinks.map((sublink) => {
        if (typeof sublink.description === "string") {
          const trimmed = sublink.description.trim();
          return {
            ...sublink,
            description: trimmed.length > 0 ? trimmed : null
          };
        }

        return {
          ...sublink,
          description: sublink.description ?? null
        };
      });
      await onSubmit({
        name: trimmedName,
        url: trimmedUrl,
        description: trimmedDescription.length > 0 ? trimmedDescription : null,
        categoryIds,
        sublinks: normalizedSublinks
      });
      onClose();
    } catch (submitError) {
      const message =
        submitError instanceof Error
          ? submitError.message || "Aktion fehlgeschlagen."
          : "Aktion fehlgeschlagen.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (
      !onDelete ||
      isDeleting ||
      isSubmitting ||
      isSublinkSubmitting ||
      pendingSublinkId !== null
    ) {
      return;
    }

    setError(null);
    setDeleting(true);
    try {
      await onDelete();
      onClose();
    } catch (deleteError) {
      const message =
        deleteError instanceof Error
          ? deleteError.message || "Löschen fehlgeschlagen."
          : "Löschen fehlgeschlagen.";
      setError(message);
    } finally {
      setDeleting(false);
    }
  };

  const openCreateSublink = () => {
    setSublinkDialogMode("create");
    setActiveSublinkId(null);
    setSublinkDraft({ name: "", url: "", description: "" });
    setSublinkListError(null);
    setSublinkDialogOpen(true);
  };

  const openEditSublink = (sublink: SublinkItem) => {
    setSublinkDialogMode("edit");
    setActiveSublinkId(sublink.id);
    setSublinkDraft({
      name: sublink.name,
      url: sublink.url,
      description: sublink.description ?? ""
    });
    setSublinkListError(null);
    setSublinkDialogOpen(true);
  };

  const closeSublinkDialog = () => {
    if (isSublinkSubmitting) {
      return;
    }

    setSublinkDialogOpen(false);
    setActiveSublinkId(null);
  };

  const handleSublinkSubmit = async (values: SublinkFormValues) => {
    const trimmedName = values.name.trim();
    const trimmedUrl = values.url.trim();
    const trimmedDescription = values.description.trim();
    const descriptionValue = trimmedDescription.length > 0 ? trimmedDescription : null;
    const isPhone = isTelephoneUrl(trimmedUrl);
    const existingPhone = sublinks.find((item) => isTelephoneUrl(item.url));
    const editedSublinkId =
      sublinkDialogMode === "edit" && activeSublinkId ? activeSublinkId : null;

    if (isPhone && existingPhone && existingPhone.id !== editedSublinkId) {
      throw new Error("Es kann nur eine Telefonnummer hinterlegt werden.");
    }

    if (mode === "edit" && linkId) {
      setSublinkSubmitting(true);
      try {
        let updated: LinkItem;
        if (sublinkDialogMode === "create") {
          updated = await addSublink(linkId, {
            name: trimmedName,
            url: trimmedUrl,
            description: descriptionValue
          });
        } else if (sublinkDialogMode === "edit" && activeSublinkId) {
          updated = await updateSublink(linkId, activeSublinkId, {
            name: trimmedName,
            url: trimmedUrl,
            description: descriptionValue
          });
        } else {
          throw new Error("Ungültige Sublink-Aktion.");
        }
        setSublinks(updated.sublinks.map((sublink) => ({ ...sublink })));
        setSublinkListError(null);
        setSublinkDialogOpen(false);
        setActiveSublinkId(null);
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message || "Sublink konnte nicht gespeichert werden."
            : "Sublink konnte nicht gespeichert werden.";
        throw new Error(message);
      } finally {
        setSublinkSubmitting(false);
      }
      return;
    }

    const nextSublink: SublinkItem = {
      id: sublinkDialogMode === "create" || !activeSublinkId
        ? generateSublinkId()
        : activeSublinkId,
      name: trimmedName,
      url: trimmedUrl,
      description: descriptionValue
    };

    setSublinks((current) =>
      sublinkDialogMode === "create" || !activeSublinkId
        ? [...current, nextSublink]
        : current.map((sublink) => (sublink.id === activeSublinkId ? nextSublink : sublink))
    );
    setSublinkDialogOpen(false);
    setActiveSublinkId(null);
    setSublinkListError(null);
  };

  const handleSublinkDelete = async (sublink: SublinkItem) => {
    if (isBusy) {
      return;
    }

    if (!confirm(`Sublink "${sublink.name}" wirklich löschen?`)) {
      return;
    }

    if (mode === "edit" && linkId) {
      setSublinkListError(null);
      setPendingSublinkId(sublink.id);
      try {
        const updated = await deleteSublink(linkId, sublink.id);
        setSublinks(updated.sublinks.map((item) => ({ ...item })));
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message || "Sublink konnte nicht gelöscht werden."
            : "Sublink konnte nicht gelöscht werden.";
        setSublinkListError(message);
      } finally {
        setPendingSublinkId(null);
      }
      return;
    }

    setSublinks((current) => current.filter((item) => item.id !== sublink.id));
    setSublinkListError(null);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={mode === "create" ? "Link hinzufügen" : "Link bearbeiten"}
      footer={
        <div className="flex w-full items-center justify-between">
          {mode === "edit" && onDelete ? (
            <button
              type="button"
              onClick={handleDelete}
              disabled={isDeleting || isSubmitting || isSublinkSubmitting || pendingSublinkId !== null}
              className="rounded-full border border-rose-500 px-3 py-2 text-sm text-rose-300 hover:bg-rose-500/10 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isDeleting ? "Wird gelöscht…" : "Löschen"}
            </button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting || isDeleting || isSublinkSubmitting}
              className="rounded-full border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:border-slate-500 hover:text-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Abbrechen
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit || isSubmitting || isDeleting}
              className="rounded-full bg-brand-500 px-4 py-2 text-sm font-semibold text-slate-50 hover:bg-brand-400 disabled:cursor-not-allowed disabled:bg-slate-700"
            >
              {isSubmitting ? "Wird gespeichert…" : mode === "create" ? "Speichern" : "Aktualisieren"}
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-200">
            Name
            <input
              value={name}
              maxLength={16}
              onChange={(event) => setName(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 focus:border-brand-400"
              placeholder="Kurzname"
            />
          </label>
          <p className="mt-1 text-xs text-slate-400">Maximal 16 Zeichen – wird auf der Kachel angezeigt.</p>
        </div>
        <label className="block text-sm font-medium text-slate-200">
          URL
          <input
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 focus:border-brand-400"
            placeholder="https://"
            inputMode="url"
          />
        </label>
        <div>
          <p className="text-sm font-medium text-slate-200">Kategorien</p>
          {hasCategories ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {categories.map((category) => {
                const isSelected = categoryIds.includes(category.id);
                return (
                  <label
                    key={category.id}
                    className={clsx(
                      "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium transition focus-within:outline focus-within:outline-2 focus-within:outline-offset-2",
                      isSelected
                        ? "border-brand-400 bg-brand-500/20 text-brand-100 focus-within:outline-brand-300"
                        : "border-slate-700 bg-slate-950/40 text-slate-300 hover:border-brand-400 hover:text-brand-100 focus-within:outline-brand-300",
                      isBusy ? "cursor-not-allowed opacity-60" : "cursor-pointer"
                    )}
                  >
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={isSelected}
                      onChange={() => toggleCategory(category.id)}
                      disabled={isBusy}
                    />
                    <span>{category.name}</span>
                  </label>
                );
              })}
            </div>
          ) : (
            <p className="mt-2 text-sm text-amber-300">Bitte lege zuerst eine Kategorie an.</p>
          )}
          {hasCategories && categoryIds.length === 0 ? (
            <p className="mt-2 text-xs text-amber-300">Wähle mindestens eine Kategorie aus.</p>
          ) : null}
        </div>
        <label className="block text-sm font-medium text-slate-200">
          Beschreibung (optional)
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 focus:border-brand-400"
            rows={3}
          />
        </label>
        <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-3">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-medium text-slate-200">Sublinks</p>
            <button
              type="button"
              onClick={openCreateSublink}
              disabled={isBusy}
              className="inline-flex items-center gap-2 rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-200 transition hover:border-brand-400 hover:text-brand-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <PlusIcon className="h-4 w-4" /> Hinzufügen
            </button>
          </div>
          {sublinks.length === 0 ? (
            <p className="text-xs text-slate-400">Noch keine Sublinks hinzugefügt.</p>
          ) : (
            <ul className="space-y-2">
              {sublinks.map((sublink) => (
                <li
                  key={sublink.id}
                  className="rounded-xl border border-slate-800 bg-slate-950/80 p-3"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-1 text-sm text-slate-200">
                      <p className="font-medium text-slate-100">{sublink.name}</p>
                      {sublink.description ? (
                        <p className="text-xs text-slate-400">{sublink.description}</p>
                      ) : null}
                      <a
                        href={sublink.url}
                        target={isTelephoneUrl(sublink.url) ? undefined : "_blank"}
                        rel={
                          isTelephoneUrl(sublink.url)
                            ? undefined
                            : "noopener noreferrer"
                        }
                        className="break-all text-xs text-brand-200 hover:text-brand-100"
                      >
                        {isTelephoneUrl(sublink.url)
                          ? extractPhoneNumber(sublink.url)
                          : sublink.url}
                      </a>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openEditSublink(sublink)}
                        disabled={isBusy}
                        className="inline-flex items-center gap-2 rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-300 transition hover:border-brand-400 hover:text-brand-200 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <PencilSquareIcon className="h-4 w-4" /> Bearbeiten
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          void handleSublinkDelete(sublink);
                        }}
                        disabled={isBusy || pendingSublinkId === sublink.id}
                        className="inline-flex items-center gap-2 rounded-full border border-rose-600 px-3 py-1 text-xs text-rose-300 transition hover:bg-rose-600/10 hover:text-rose-200 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <TrashIcon className="h-4 w-4" />
                        {pendingSublinkId === sublink.id ? "Wird gelöscht…" : "Löschen"}
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {sublinkListError ? (
            <p className="mt-3 text-xs text-rose-400">{sublinkListError}</p>
          ) : null}
        </div>
        {error ? <p className="text-sm text-rose-400">{error}</p> : null}
      </div>
      <SublinkFormDialog
        open={isSublinkDialogOpen}
        mode={sublinkDialogMode}
        initialValues={sublinkDraft}
        onSubmit={handleSublinkSubmit}
        onClose={closeSublinkDialog}
        isSubmitting={isSublinkSubmitting}
        allowPhoneType={allowPhoneType}
      />
    </Modal>
  );
}
