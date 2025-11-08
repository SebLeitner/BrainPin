"use client";

import { useEffect, useMemo, useState } from "react";

import { Modal } from "@/components/Modal";
import {
  extractPhoneNumber,
  isTelephoneUrl,
  sanitizePhoneNumber
} from "@/lib/sublinks";

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
  allowPhoneType: boolean;
};

export function SublinkFormDialog({
  open,
  mode,
  initialValues,
  onSubmit,
  onClose,
  isSubmitting,
  allowPhoneType
}: SublinkFormDialogProps) {
  const [name, setName] = useState(initialValues.name);
  const [urlValue, setUrlValue] = useState(initialValues.url);
  const [phoneValue, setPhoneValue] = useState(() =>
    extractPhoneNumber(initialValues.url)
  );
  const [description, setDescription] = useState(initialValues.description);
  const [error, setError] = useState<string | null>(null);
  const [linkType, setLinkType] = useState<"url" | "phone">(() =>
    isTelephoneUrl(initialValues.url) ? "phone" : "url"
  );
  const [phoneNormalizationNotice, setPhoneNormalizationNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    setName(initialValues.name);
    setUrlValue(initialValues.url);
    setPhoneValue(extractPhoneNumber(initialValues.url));
    setDescription(initialValues.description);
    setLinkType(isTelephoneUrl(initialValues.url) ? "phone" : "url");
    setError(null);
    setPhoneNormalizationNotice(null);
  }, [initialValues, open]);

  const canSubmit = useMemo(() => {
    const currentValue = linkType === "phone" ? phoneValue : urlValue;
    return Boolean(name.trim()) && Boolean(currentValue.trim());
  }, [linkType, name, phoneValue, urlValue]);

  const handleTypeChange = (nextType: "url" | "phone") => {
    if (nextType === "phone" && !allowPhoneType && linkType !== "phone") {
      return;
    }

    setLinkType(nextType);
    setPhoneNormalizationNotice(null);
  };

  const handleSubmit = async () => {
    if (isSubmitting) {
      return;
    }

    const trimmedName = name.trim();
    const currentValue = linkType === "phone" ? phoneValue : urlValue;
    const trimmedValue = currentValue.trim();

    if (!trimmedName) {
      setError("Name darf nicht leer sein.");
      return;
    }

    if (!trimmedValue) {
      setError(
        linkType === "phone"
          ? "Bitte gib eine Telefonnummer an."
          : "Bitte gib eine URL an."
      );
      return;
    }

    setError(null);

    let finalUrl = trimmedValue;

    if (linkType === "phone") {
      try {
        const sanitized = sanitizePhoneNumber(trimmedValue);
        const hasNormalizationChange = sanitized !== trimmedValue;

        setPhoneValue(sanitized);
        setPhoneNormalizationNotice(
          hasNormalizationChange
            ? "Die Telefonnummer wurde automatisch formatiert. Bitte prüfe sie."
            : null
        );
        finalUrl = `tel:${sanitized}`;
      } catch (phoneError) {
        const message =
          phoneError instanceof Error
            ? phoneError.message
            : "Ungültige Telefonnummer.";
        setError(message);
        return;
      }
    }

    try {
      await onSubmit({
        name: trimmedName,
        url: finalUrl,
        description: description.trim()
      });
      setPhoneNormalizationNotice(null);
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
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-slate-200">Typ</span>
          <div className="inline-flex items-center gap-2">
            <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-200">
              <input
                type="radio"
                name="sublink-type"
                value="url"
                checked={linkType === "url"}
                onChange={() => handleTypeChange("url")}
                className="h-3 w-3"
              />
              Weblink
            </label>
            <label
              className="inline-flex items-center gap-2 text-xs font-medium"
              aria-disabled={!allowPhoneType && linkType !== "phone"}
            >
              <input
                type="radio"
                name="sublink-type"
                value="phone"
                checked={linkType === "phone"}
                onChange={() => handleTypeChange("phone")}
                className="h-3 w-3"
                disabled={!allowPhoneType && linkType !== "phone"}
              />
              <span
                className={
                  !allowPhoneType && linkType !== "phone"
                    ? "text-xs font-medium text-slate-500"
                    : "text-xs font-medium text-slate-200"
                }
              >
                Telefonnummer
              </span>
            </label>
          </div>
        </div>
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
          {linkType === "phone" ? "Telefonnummer" : "URL"}
          <input
            value={linkType === "phone" ? phoneValue : urlValue}
            onChange={(event) => {
              if (linkType === "phone") {
                setPhoneValue(event.target.value);
                setRequiresPhoneConfirmation(false);
                setPhoneNormalizationNotice(null);
              } else {
                setUrlValue(event.target.value);
              }
            }}
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 focus:border-brand-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-300"
            placeholder={linkType === "phone" ? "+49 123 456789" : "https://"}
            inputMode={linkType === "phone" ? "tel" : "url"}
          />
        </label>
        {linkType === "phone" && phoneNormalizationNotice ? (
          <p className="text-xs text-amber-300">{phoneNormalizationNotice}</p>
        ) : null}
        {!allowPhoneType && linkType !== "phone" ? (
          <p className="text-xs text-slate-400">
            Es kann nur eine Telefonnummer hinterlegt werden.
          </p>
        ) : null}
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
