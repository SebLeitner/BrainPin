"use client";

import { useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/Modal";
import { useLinksStore, type LinkItem } from "@/store/useLinksStore";

export type LinkFormDialogProps = {
  open: boolean;
  mode: "create" | "edit";
  initialValues?: Omit<LinkItem, "id">;
  onSubmit: (values: Omit<LinkItem, "id">) => void;
  onDelete?: () => void;
  onClose: () => void;
};

export function LinkFormDialog({
  open,
  mode,
  initialValues,
  onSubmit,
  onDelete,
  onClose
}: LinkFormDialogProps) {
  const categories = useLinksStore((state) => state.categories.filter((category) => category.id !== "all"));
  const [name, setName] = useState(initialValues?.name ?? "");
  const [url, setUrl] = useState(initialValues?.url ?? "");
  const [description, setDescription] = useState(initialValues?.description ?? "");
  const [categoryId, setCategoryId] = useState(initialValues?.categoryId ?? categories[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);

  const hasCategories = categories.length > 0;

  useEffect(() => {
    setName(initialValues?.name ?? "");
    setUrl(initialValues?.url ?? "");
    setDescription(initialValues?.description ?? "");
    setCategoryId(initialValues?.categoryId ?? categories[0]?.id ?? "");
    setError(null);
  }, [initialValues, open, categories]);

  const canSubmit = useMemo(() => {
    const trimmed = name.trim();
    return Boolean(trimmed) && trimmed.length <= 16 && Boolean(url.trim()) && Boolean(categoryId) && hasCategories;
  }, [name, url, categoryId, hasCategories]);

  const handleSubmit = () => {
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
    onSubmit({
      name: trimmedName,
      url: trimmedUrl,
      description: description.trim() || undefined,
      categoryId
    });
    onClose();
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
              onClick={onDelete}
              className="rounded-full border border-rose-500 px-3 py-2 text-sm text-rose-300 hover:bg-rose-500/10"
            >
              Löschen
            </button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:border-slate-500 hover:text-slate-100"
            >
              Abbrechen
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="rounded-full bg-brand-500 px-4 py-2 text-sm font-semibold text-slate-50 hover:bg-brand-400 disabled:cursor-not-allowed disabled:bg-slate-700"
            >
              {mode === "create" ? "Speichern" : "Aktualisieren"}
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
        <label className="block text-sm font-medium text-slate-200">
          Kategorie
          <select
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
            disabled={!hasCategories}
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 focus:border-brand-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
        {!hasCategories ? (
          <p className="text-sm text-amber-300">Bitte lege zuerst eine Kategorie an.</p>
        ) : null}
        <label className="block text-sm font-medium text-slate-200">
          Beschreibung (optional)
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 focus:border-brand-400"
            rows={3}
          />
        </label>
        {error ? <p className="text-sm text-rose-400">{error}</p> : null}
      </div>
    </Modal>
  );
}
