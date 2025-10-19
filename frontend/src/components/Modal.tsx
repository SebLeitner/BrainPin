"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

export type ModalProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  descriptionId?: string;
};

export function Modal({ open, title, onClose, children, footer, descriptionId }: ModalProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const lastFocusedElementRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    lastFocusedElementRef.current = document.activeElement as HTMLElement | null;

    const modalElement = panelRef.current;
    if (modalElement) {
      const focusableSelector =
        "a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex='-1'])";
      const focusable = Array.from(
        modalElement.querySelectorAll<HTMLElement>(focusableSelector)
      ).filter((element) => !element.hasAttribute("data-focus-guard"));

      if (focusable.length > 0) {
        focusable[0].focus();
      } else {
        modalElement.focus();
      }
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key === "Tab") {
        const modal = panelRef.current;
        if (!modal) {
          return;
        }

        const focusableSelector =
          "a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex='-1'])";
        const focusableElements = Array.from(
          modal.querySelectorAll<HTMLElement>(focusableSelector)
        ).filter((element) => !element.hasAttribute("data-focus-guard"));

        if (focusableElements.length === 0) {
          event.preventDefault();
          modal.focus();
          return;
        }

        const first = focusableElements[0];
        const last = focusableElements[focusableElements.length - 1];

        if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        } else if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        }
      }
    };

    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      const previouslyFocused = lastFocusedElementRef.current;
      if (previouslyFocused && typeof previouslyFocused.focus === "function") {
        previouslyFocused.focus();
      }
      lastFocusedElementRef.current = null;
    };
  }, [open, onClose]);

  if (typeof document === "undefined") {
    return null;
  }

  if (!open) {
    return null;
  }
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 py-6">
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
        className="w-full max-w-lg rounded-2xl bg-slate-900 shadow-xl ring-1 ring-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400"
      >
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
          <h2 id={titleId} className="text-lg font-semibold text-slate-100">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-slate-400 transition hover:text-slate-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-300"
            aria-label="Dialog schließen"
          >
            ×
          </button>
        </div>
        <div className="px-6 py-4 text-sm text-slate-100">{children}</div>
        {footer ? (
          <div className="flex justify-end gap-3 border-t border-slate-800 px-6 py-4">{footer}</div>
        ) : null}
      </div>
    </div>,
    document.body
  );
}
