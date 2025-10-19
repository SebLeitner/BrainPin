"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeftIcon, PencilSquareIcon, PlusIcon, TrashIcon } from "@heroicons/react/24/outline";
import { CategoryFormDialog } from "@/components/CategoryFormDialog";
import { LinkFormDialog } from "@/components/LinkFormDialog";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { SublinkFormDialog, type SublinkFormValues } from "@/components/SublinkFormDialog";
import { useLinksStore } from "@/store/useLinksStore";
import type { LinkItem, SublinkItem } from "@/types/links";

export default function SettingsPage() {
  const {
    categories,
    allCategories,
    links,
    isLoading,
    error,
    loadLinks,
    addCategory,
    updateCategory,
    deleteCategory,
    addLink,
    updateLink,
    deleteLink,
    addSublink,
    updateSublink,
    deleteSublink
  } = useLinksStore((state) => ({
    categories: state.categories.filter((category) => category.id !== "all"),
    allCategories: state.categories,
    links: state.links,
    isLoading: state.isLoading,
    error: state.error,
    loadLinks: state.loadLinks,
    addCategory: state.addCategory,
    updateCategory: state.updateCategory,
    deleteCategory: state.deleteCategory,
    addLink: state.addLink,
    updateLink: state.updateLink,
    deleteLink: state.deleteLink,
    addSublink: state.addSublink,
    updateSublink: state.updateSublink,
    deleteSublink: state.deleteSublink
  }));

  useEffect(() => {
    void loadLinks();
  }, [loadLinks]);

  const [isCategoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [categoryDialogMode, setCategoryDialogMode] = useState<"create" | "edit">("create");
  const [categoryDialogId, setCategoryDialogId] = useState<string | null>(null);

  const [isLinkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkDialogMode, setLinkDialogMode] = useState<"create" | "edit">("create");
  const [editingLink, setEditingLink] = useState<LinkItem | null>(null);

  const [isSublinkDialogOpen, setSublinkDialogOpen] = useState(false);
  const [sublinkDialogMode, setSublinkDialogMode] = useState<"create" | "edit">("create");
  const [activeLinkForSublink, setActiveLinkForSublink] = useState<LinkItem | null>(null);
  const [activeSublinkId, setActiveSublinkId] = useState<string | null>(null);
  const [sublinkDraft, setSublinkDraft] = useState<SublinkFormValues>({
    name: "",
    url: "",
    description: ""
  });
  const [isSublinkSubmitting, setSublinkSubmitting] = useState(false);
  const [pendingSublinkId, setPendingSublinkId] = useState<string | null>(null);
  const [sublinkListError, setSublinkListError] = useState<string | null>(null);
  const [sublinkErrorLinkId, setSublinkErrorLinkId] = useState<string | null>(null);

  const linksPerCategory = useMemo(() => {
    return links.reduce<Record<string, number>>((acc, link) => {
      acc[link.categoryId] = (acc[link.categoryId] ?? 0) + 1;
      return acc;
    }, {});
  }, [links]);

  const categoryNameById = useMemo(() => {
    return allCategories.reduce<Record<string, string>>((acc, category) => {
      acc[category.id] = category.name;
      return acc;
    }, {});
  }, [allCategories]);

  const openCreateCategory = () => {
    setCategoryDialogMode("create");
    setCategoryDialogId(null);
    setCategoryDialogOpen(true);
  };

  const openEditCategory = (categoryId: string) => {
    setCategoryDialogMode("edit");
    setCategoryDialogId(categoryId);
    setCategoryDialogOpen(true);
  };

  const handleCategorySubmit = async (name: string) => {
    if (categoryDialogMode === "create") {
      await addCategory(name);
    } else if (categoryDialogMode === "edit" && categoryDialogId) {
      await updateCategory(categoryDialogId, name);
    }
  };

  const handleDeleteCategory = async (categoryId: string) => {
    const category = categories.find((item) => item.id === categoryId);
    if (!category) return;
    if (!confirm(`Kategorie "${category.name}" wirklich löschen?`)) {
      return;
    }

    try {
      await deleteCategory(categoryId);
    } catch (deleteError) {
      if (deleteError instanceof Error) {
        alert(`Kategorie konnte nicht gelöscht werden: ${deleteError.message}`);
      } else {
        alert("Kategorie konnte nicht gelöscht werden.");
      }
    }
  };

  const openCreateLink = () => {
    setLinkDialogMode("create");
    setEditingLink(null);
    setLinkDialogOpen(true);
  };

  const openEditLink = (link: LinkItem) => {
    setLinkDialogMode("edit");
    setEditingLink(link);
    setLinkDialogOpen(true);
  };

  const handleLinkSubmit = async (values: Omit<LinkItem, "id">) => {
    if (linkDialogMode === "create") {
      await addLink(values);
    } else if (linkDialogMode === "edit" && editingLink) {
      await updateLink(editingLink.id, values);
    }
  };

  const confirmDeleteLink = async (link: LinkItem) => {
    if (!confirm(`Link "${link.name}" wirklich löschen?`)) {
      return false;
    }

    await deleteLink(link.id);
    if (editingLink?.id === link.id) {
      setEditingLink(null);
    }
    return true;
  };

  const openCreateSublink = (link: LinkItem) => {
    setActiveLinkForSublink(link);
    setSublinkDialogMode("create");
    setActiveSublinkId(null);
    setSublinkDraft({ name: "", url: "", description: "" });
    setSublinkListError(null);
    setSublinkErrorLinkId(null);
    setSublinkDialogOpen(true);
  };

  const openEditSublink = (link: LinkItem, sublink: SublinkItem) => {
    setActiveLinkForSublink(link);
    setSublinkDialogMode("edit");
    setActiveSublinkId(sublink.id);
    setSublinkDraft({
      name: sublink.name,
      url: sublink.url,
      description: sublink.description ?? ""
    });
    setSublinkListError(null);
    setSublinkErrorLinkId(null);
    setSublinkDialogOpen(true);
  };

  const closeSublinkDialog = () => {
    if (isSublinkSubmitting) {
      return;
    }

    setSublinkDialogOpen(false);
    setActiveLinkForSublink(null);
    setActiveSublinkId(null);
    setSublinkDraft({ name: "", url: "", description: "" });
  };

  const handleSublinkSubmit = async (values: SublinkFormValues) => {
    if (!activeLinkForSublink) {
      throw new Error("Link wurde nicht gefunden.");
    }

    const trimmedDescription = values.description.trim();
    setSublinkListError(null);
    setSublinkErrorLinkId(null);
    setSublinkSubmitting(true);

    try {
      if (sublinkDialogMode === "create") {
        await addSublink(activeLinkForSublink.id, {
          name: values.name,
          url: values.url,
          description: trimmedDescription.length > 0 ? trimmedDescription : null
        });
      } else if (sublinkDialogMode === "edit" && activeSublinkId) {
        await updateSublink(activeLinkForSublink.id, activeSublinkId, {
          name: values.name,
          url: values.url,
          description: trimmedDescription.length > 0 ? trimmedDescription : null
        });
      } else {
        throw new Error("Ungültige Sublink-Aktion.");
      }

      setSublinkDialogOpen(false);
      setActiveLinkForSublink(null);
      setActiveSublinkId(null);
      setSublinkDraft({ name: "", url: "", description: "" });
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error("Sublink konnte nicht gespeichert werden.");
    } finally {
      setSublinkSubmitting(false);
    }
  };

  const handleSublinkDelete = async (link: LinkItem, sublink: SublinkItem) => {
    if (!confirm(`Sublink "${sublink.name}" wirklich löschen?`)) {
      return;
    }

    setPendingSublinkId(sublink.id);
    setSublinkListError(null);
    setSublinkErrorLinkId(link.id);

    try {
      await deleteSublink(link.id, sublink.id);
      if (activeSublinkId === sublink.id) {
        setActiveSublinkId(null);
      }
      setSublinkErrorLinkId(null);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message || "Sublink konnte nicht gelöscht werden."
          : "Sublink konnte nicht gelöscht werden.";
      setSublinkListError(message);
    } finally {
      setPendingSublinkId(null);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-10 px-4 py-10 sm:px-8">
      <header className="flex flex-col gap-4">
        <Link
          href="/"
          className="inline-flex items-center gap-2 self-start rounded-full border border-slate-700 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-300 transition hover:border-brand-400 hover:text-brand-100"
        >
          <ArrowLeftIcon className="h-4 w-4" /> Zurück
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-slate-50">Einstellungen</h1>
          <p className="mt-2 text-base text-slate-300">
            Verwalte Kategorien und Links zentral. Änderungen werden sofort auf der Startseite übernommen.
          </p>
        </div>
      </header>

      {isLoading ? (
        <LoadingSpinner
          label="Daten werden synchronisiert…"
          className="mx-auto rounded-2xl border border-slate-800 bg-slate-900/60 p-6"
        />
      ) : null}

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-slate-100">Status</h2>
        {error ? (
          <div className="rounded-2xl border border-rose-500/60 bg-rose-900/20 p-4 text-sm text-rose-200">
            <p className="font-medium">Fehler bei einer Aktion oder beim Laden.</p>
            <p className="mt-1 text-rose-100/80">{error}</p>
            <button
              type="button"
              onClick={() => {
                void loadLinks({ force: true });
              }}
              className="mt-3 inline-flex items-center rounded-full border border-rose-400 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-rose-100 transition hover:border-rose-200 hover:text-rose-50"
            >
              Erneut laden
            </button>
          </div>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
            <p className="text-sm uppercase tracking-wide text-slate-400">Kategorien</p>
            <p className="mt-2 text-3xl font-bold text-brand-200">{categories.length}</p>
            <p className="mt-1 text-sm text-slate-400">
              Kategorien werden auf der Startseite als Filter angezeigt. Bearbeite sie hier in den Einstellungen.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
            <p className="text-sm uppercase tracking-wide text-slate-400">Links</p>
            <p className="mt-2 text-3xl font-bold text-brand-200">{links.length}</p>
            <p className="mt-1 text-sm text-slate-400">
              Links erscheinen dort als klickbare Kacheln. Hier kannst du sie anlegen, bearbeiten oder entfernen.
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-xl font-semibold text-slate-100">Kategorien verwalten</h2>
          <button
            type="button"
            onClick={openCreateCategory}
            className="inline-flex items-center gap-2 rounded-full border border-dashed border-brand-500/70 px-4 py-2 text-sm font-medium text-brand-200 hover:border-brand-400 hover:text-brand-100"
          >
            <PlusIcon className="h-4 w-4" /> Kategorie
          </button>
        </div>
        <div className="space-y-2">
          {categories.length > 0 ? (
            categories.map((category) => (
              <div
                key={category.id}
                className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3 text-sm text-slate-200 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium text-slate-100">{category.name}</p>
                  <p className="text-xs text-slate-400">{linksPerCategory[category.id] ?? 0} Links</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openEditCategory(category.id)}
                    className="inline-flex items-center gap-2 rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-300 hover:border-brand-500 hover:text-brand-200"
                  >
                    <PencilSquareIcon className="h-4 w-4" /> Bearbeiten
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      void handleDeleteCategory(category.id);
                    }}
                    className="inline-flex items-center gap-2 rounded-full border border-rose-600 px-3 py-1 text-xs text-rose-300 hover:bg-rose-600/10 hover:text-rose-200"
                  >
                    <TrashIcon className="h-4 w-4" /> Löschen
                  </button>
                </div>
              </div>
            ))
          ) : (
            <p className="rounded-xl border border-dashed border-slate-700 bg-slate-900/60 p-4 text-sm text-slate-400">
              Noch keine Kategorien angelegt. Lege deine erste Kategorie an, um Links zu strukturieren.
            </p>
          )}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-xl font-semibold text-slate-100">Links verwalten</h2>
          <button
            type="button"
            onClick={openCreateLink}
            className="inline-flex items-center gap-2 rounded-full bg-brand-500 px-4 py-2 text-sm font-semibold text-slate-950 shadow-lg shadow-brand-500/30 transition hover:bg-brand-400"
          >
            <PlusIcon className="h-4 w-4" /> Link
          </button>
        </div>
        <div className="space-y-3">
          {links.length > 0 ? (
            links.map((link) => (
              <div
                key={link.id}
                className="flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-4"
              >
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-wide text-brand-300">
                    {categoryNameById[link.categoryId] ?? "Unbekannt"}
                  </p>
                  <p className="text-base font-semibold text-slate-100">{link.name}</p>
                  {link.description ? <p className="text-sm text-slate-300">{link.description}</p> : null}
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="break-all text-sm text-brand-200 transition hover:text-brand-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-300"
                  >
                    {link.url}
                  </a>
                </div>

                <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/50 p-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm font-semibold text-slate-200">
                      Sublinks ({link.sublinks.length})
                    </p>
                    <button
                      type="button"
                      onClick={() => openCreateSublink(link)}
                      disabled={isSublinkSubmitting || pendingSublinkId !== null}
                      className="inline-flex items-center gap-2 self-start rounded-full border border-dashed border-brand-400 px-3 py-1 text-xs font-medium text-brand-200 transition hover:border-brand-200 hover:text-brand-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-300 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <PlusIcon className="h-4 w-4" /> Sublink hinzufügen
                    </button>
                  </div>
                  {link.sublinks.length > 0 ? (
                    <ul className="space-y-2">
                      {link.sublinks.map((sublink) => (
                        <li
                          key={sublink.id}
                          className="rounded-lg border border-slate-800 bg-slate-900/70 p-3"
                        >
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div className="space-y-1 text-sm text-slate-200">
                              <p className="font-medium text-slate-100">{sublink.name}</p>
                              {sublink.description ? (
                                <p className="text-xs text-slate-400">{sublink.description}</p>
                              ) : null}
                              <a
                                href={sublink.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="break-all text-xs text-brand-200 transition hover:text-brand-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-300"
                              >
                                {sublink.url}
                              </a>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => openEditSublink(link, sublink)}
                                disabled={isSublinkSubmitting || pendingSublinkId === sublink.id}
                                className="inline-flex items-center gap-2 rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-300 transition hover:border-brand-400 hover:text-brand-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-300 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                <PencilSquareIcon className="h-4 w-4" /> Bearbeiten
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  void handleSublinkDelete(link, sublink);
                                }}
                                disabled={isSublinkSubmitting || pendingSublinkId === sublink.id}
                                className="inline-flex items-center gap-2 rounded-full border border-rose-600 px-3 py-1 text-xs text-rose-300 transition hover:bg-rose-600/10 hover:text-rose-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-300 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                <TrashIcon className="h-4 w-4" />
                                {pendingSublinkId === sublink.id ? "Wird gelöscht…" : "Löschen"}
                              </button>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-slate-400">
                      Noch keine Sublinks vorhanden. Lege einen Sublink an, um weiterführende Ziele zu verlinken.
                    </p>
                  )}
                  {sublinkErrorLinkId === link.id && sublinkListError ? (
                    <p className="text-xs text-rose-400">{sublinkListError}</p>
                  ) : null}
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => openEditLink(link)}
                    className="inline-flex items-center gap-2 rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-300 transition hover:border-brand-500 hover:text-brand-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-300"
                  >
                    <PencilSquareIcon className="h-4 w-4" /> Link bearbeiten
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      void confirmDeleteLink(link).catch((deleteError) => {
                        if (deleteError instanceof Error) {
                          alert(`Link konnte nicht gelöscht werden: ${deleteError.message}`);
                        } else {
                          alert("Link konnte nicht gelöscht werden.");
                        }
                      });
                    }}
                    className="inline-flex items-center gap-2 rounded-full border border-rose-600 px-3 py-1 text-xs text-rose-300 transition hover:bg-rose-600/10 hover:text-rose-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-300"
                  >
                    <TrashIcon className="h-4 w-4" /> Link löschen
                  </button>
                </div>
              </div>
            ))
          ) : (
            <p className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/60 p-6 text-sm text-slate-400">
              Noch keine Links vorhanden. Lege Links an oder importiere sie später.
            </p>
          )}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-slate-100">Tipps</h2>
        <div className="space-y-3 text-sm text-slate-300">
          <p>• Verwende sprechende Kurz-Namen (≤16 Zeichen), damit deine Kacheln auch auf kleinen Bildschirmen lesbar bleiben.</p>
          <p>• Ziehe mobile Nutzer:innen in Betracht – Buttons und Kacheln sind bereits responsiv gestaltet.</p>
          <p>
            • Plane Kategorien so, dass jeder Link eindeutig zugeordnet werden kann. Doppelte Kategorien lassen sich jederzeit hier entfernen.
          </p>
        </div>
      </section>

      <CategoryFormDialog
        open={isCategoryDialogOpen}
        mode={categoryDialogMode}
        initialName={
          categoryDialogMode === "edit"
            ? categories.find((category) => category.id === categoryDialogId)?.name ?? ""
            : ""
        }
        onSubmit={handleCategorySubmit}
        onClose={() => setCategoryDialogOpen(false)}
      />

      <LinkFormDialog
        open={isLinkDialogOpen}
        mode={linkDialogMode}
        linkId={linkDialogMode === "edit" ? editingLink?.id : undefined}
        initialValues={
          linkDialogMode === "edit" && editingLink
            ? {
                name: editingLink.name,
                url: editingLink.url,
                description: editingLink.description,
                categoryId: editingLink.categoryId,
                sublinks: editingLink.sublinks
              }
            : undefined
        }
        onSubmit={handleLinkSubmit}
        onDelete={
          linkDialogMode === "edit" && editingLink
            ? async () => {
                const removed = await confirmDeleteLink(editingLink);
                if (removed) {
                  setLinkDialogOpen(false);
                }
              }
            : undefined
        }
        onClose={() => setLinkDialogOpen(false)}
      />

      <SublinkFormDialog
        open={isSublinkDialogOpen}
        mode={sublinkDialogMode}
        initialValues={sublinkDraft}
        onSubmit={handleSublinkSubmit}
        onClose={closeSublinkDialog}
        isSubmitting={isSublinkSubmitting}
      />
    </main>
  );
}
