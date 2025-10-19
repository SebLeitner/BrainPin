"use client";

import { useEffect, useMemo, useState } from "react";

import { Modal } from "@/components/Modal";

export type SublinkFormValues = {
  name: string;
  url: string;
  description: string;
};

export type SublinkFormDialogProps = {
  open: boolean;
  mode: "create" | "edit";
  initialValues: SublinkFormValues;
  onSubmit: (values: SublinkFormValues) => Promise<void>;
  onClose: () => void;
  isSubmitting: boolean;
};

export function SublinkFormDialog({
  open,
  mode,
  initialValues,
  onSubmit,
  onClose,
  isSubmitting
}: SublinkFormDialogProps) {
  const [name, setName] = useState(initialValues.name);
  const [url, setUrl] = useState(initialValues.url);
  const [description, setDescription] = useState(initialValues.description);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    setName(initialValues.name);
    setUrl(initialValues.url);
    setDescription(initialValues.description);
    setError(null);
  }, [initialValues, open]);

  const canSubmit = useMemo(() => {
    return Boolean(name.trim()) && Boolean(url.trim());
  }, [name, url]);

  const handleSubmit = async () => {
    if (isSubmitting) {
      return;
    }

    const trimmedName = name.trim();
    const trimmedUrl = url.trim();

    if (!trimmedName) {
      setError("Name darf nicht leer sein.");
      return;
    }

    if (!trimmedUrl) {
      setError("Bitte gib eine URL an.");
      return;
    }

    setError(null);

    try {
      await onSubmit({
        name: trimmedName,
        url: trimmedUrl,
        description: description.trim()
      });
    } catch (submitError) {
      const message =
        submitError instanceof Error
          ? submitError.message || "Sublink konnte nicht gespeichert werden."
          : "Sublink konnte nicht gespeichert werden.";
      setError(message);
      return;
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={mode === "create" ? "Sublink hinzufügen" : "Sublink bearbeiten"}
      footer={
        <div className="flex w-full items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-full border border-slate-700 px-4 py-2 text-sm text-slate-300 transition hover:border-slate-500 hover:text-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Abbrechen
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit || isSubmitting}
            className="rounded-full bg-brand-500 px-4 py-2 text-sm font-semibold text-slate-50 transition hover:bg-brand-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-300 disabled:cursor-not-allowed disabled:bg-slate-700"
          >
            {isSubmitting ? "Wird gespeichert…" : mode === "create" ? "Speichern" : "Aktualisieren"}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <label className="block text-sm font-medium text-slate-200">
          Name
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 focus:border-brand-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-300"
            placeholder="Titel"
          />
        </label>
        <label className="block text-sm font-medium text-slate-200">
          URL
          <input
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 focus:border-brand-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-300"
            placeholder="https://"
            inputMode="url"
          />
        </label>
        <label className="block text-sm font-medium text-slate-200">
          Beschreibung (optional)
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 focus:border-brand-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-300"
            rows={3}
          />
        </label>
        {error ? <p className="text-sm text-rose-400">{error}</p> : null}
      </div>
    </Modal>
  );
}
