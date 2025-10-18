"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/Modal";

export type CategoryFormDialogProps = {
  open: boolean;
  initialName?: string;
  mode: "create" | "edit";
  onSubmit: (name: string) => void;
  onClose: () => void;
};

export function CategoryFormDialog({
  open,
  initialName = "",
  mode,
  onSubmit,
  onClose
}: CategoryFormDialogProps) {
  const [name, setName] = useState(initialName);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setName(initialName);
    setError(null);
  }, [initialName, open]);

  const handleSubmit = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Name darf nicht leer sein.");
      return;
    }
    if (trimmed.length > 16) {
      setError("Maximal 16 Zeichen erlaubt.");
      return;
    }
    onSubmit(trimmed);
    onClose();
  };

  return (
    <Modal
      open={open}
      title={mode === "create" ? "Kategorie anlegen" : "Kategorie bearbeiten"}
      onClose={onClose}
      footer={
        <>
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
            className="rounded-full bg-brand-500 px-4 py-2 text-sm font-semibold text-slate-50 hover:bg-brand-400"
          >
            {mode === "create" ? "Erstellen" : "Speichern"}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <label className="block text-sm font-medium text-slate-200">
          Name
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={16}
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 focus:border-brand-400"
            placeholder="z. B. Tools"
          />
        </label>
        <p className="text-xs text-slate-400">Maximal 16 Zeichen. Der Name erscheint auf der Startseite als Button.</p>
        {error ? <p className="text-sm text-rose-400">{error}</p> : null}
      </div>
    </Modal>
  );
}
