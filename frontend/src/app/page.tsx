"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Cog6ToothIcon, PlusIcon } from "@heroicons/react/24/outline";
import { CategoryFilter } from "@/components/CategoryFilter";
import { CategoryFormDialog } from "@/components/CategoryFormDialog";
import { LinkFormDialog } from "@/components/LinkFormDialog";
import { LinkTile } from "@/components/LinkTile";
import { useLinksStore, type LinkItem } from "@/store/useLinksStore";

export default function HomePage() {
  const {
    links,
    categories,
    activeCategoryId,
    addCategory,
    updateCategory,
    deleteCategory,
    addLink,
    updateLink,
    deleteLink
  } = useLinksStore((state) => ({
    links: state.links,
    categories: state.categories,
    activeCategoryId: state.activeCategoryId,
    addCategory: state.addCategory,
    updateCategory: state.updateCategory,
    deleteCategory: state.deleteCategory,
    addLink: state.addLink,
    updateLink: state.updateLink,
    deleteLink: state.deleteLink
  }));

  const filteredLinks = useMemo(() => {
    if (!activeCategoryId || activeCategoryId === "all") {
      return links;
    }
    return links.filter((link) => link.categoryId === activeCategoryId);
  }, [links, activeCategoryId]);

  const [isCategoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [categoryDialogMode, setCategoryDialogMode] = useState<"create" | "edit">("create");
  const [categoryDialogId, setCategoryDialogId] = useState<string | null>(null);

  const [isLinkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkDialogMode, setLinkDialogMode] = useState<"create" | "edit">("create");
  const [editingLink, setEditingLink] = useState<LinkItem | null>(null);

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

  const handleCategorySubmit = (name: string) => {
    if (categoryDialogMode === "create") {
      addCategory(name);
    } else if (categoryDialogMode === "edit" && categoryDialogId) {
      updateCategory(categoryDialogId, name);
    }
  };

  const handleLinkSubmit = (values: Omit<LinkItem, "id">) => {
    if (linkDialogMode === "create") {
      addLink(values);
    } else if (linkDialogMode === "edit" && editingLink) {
      updateLink(editingLink.id, values);
    }
  };

  const handleDeleteCategory = (categoryId: string) => {
    const category = categories.find((item) => item.id === categoryId);
    if (!category) return;
    if (confirm(`Kategorie "${category.name}" wirklich löschen?`)) {
      deleteCategory(categoryId);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-10 px-4 py-10 sm:px-8">
      <header className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-50 sm:text-4xl">BrainPin</h1>
          <p className="mt-2 max-w-xl text-base text-slate-300 sm:text-lg">
            Deine persönliche Startseite für kuratierte Links – kategorisiert, kompakt und überall schnell erreichbar.
          </p>
        </div>
        <Link
          href="/settings"
          className="inline-flex items-center gap-2 self-start rounded-full border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-brand-400 hover:text-brand-100"
        >
          <Cog6ToothIcon className="h-5 w-5" />
          Einstellungen
        </Link>
      </header>

      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-xl font-semibold text-slate-100">Kategorien</h2>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={openCreateCategory}
              className="inline-flex items-center gap-2 rounded-full border border-dashed border-brand-500/70 px-4 py-2 text-sm font-medium text-brand-200 hover:border-brand-400 hover:text-brand-100"
            >
              <PlusIcon className="h-4 w-4" /> Kategorie
            </button>
          </div>
        </div>
        <CategoryFilter />
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {categories
            .filter((category) => category.id !== "all")
            .map((category) => (
              <div
                key={category.id}
                className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3 text-sm text-slate-200"
              >
                <span className="font-medium">{category.name}</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openEditCategory(category.id)}
                    className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-300 hover:border-brand-500 hover:text-brand-200"
                  >
                    Bearbeiten
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteCategory(category.id)}
                    className="rounded-full border border-rose-600 px-3 py-1 text-xs text-rose-300 hover:bg-rose-600/10 hover:text-rose-200"
                  >
                    Löschen
                  </button>
                </div>
              </div>
            ))}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-100">Links</h2>
            <p className="text-sm text-slate-400">
              Zeigt {filteredLinks.length} Link{filteredLinks.length === 1 ? "" : "s"} – gefiltert nach ausgewählter Kategorie.
            </p>
          </div>
          <button
            type="button"
            onClick={openCreateLink}
            className="inline-flex items-center gap-2 rounded-full bg-brand-500 px-4 py-2 text-sm font-semibold text-slate-950 shadow-lg shadow-brand-500/30 transition hover:bg-brand-400"
          >
            <PlusIcon className="h-4 w-4" /> Link
          </button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filteredLinks.map((link) => (
            <LinkTile key={link.id} link={link} onEdit={openEditLink} />
          ))}
          {filteredLinks.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/60 p-6 text-sm text-slate-400">
              Noch keine Links in dieser Kategorie. Füge neue Links hinzu, um deine Sammlung zu erweitern.
            </p>
          ) : null}
        </div>
      </section>

      <CategoryFormDialog
        open={isCategoryDialogOpen}
        mode={categoryDialogMode}
        initialName={categoryDialogMode === "edit" ? categories.find((category) => category.id === categoryDialogId)?.name : ""}
        onSubmit={handleCategorySubmit}
        onClose={() => setCategoryDialogOpen(false)}
      />

      <LinkFormDialog
        open={isLinkDialogOpen}
        mode={linkDialogMode}
        initialValues={
          linkDialogMode === "edit" && editingLink
            ? {
                name: editingLink.name,
                url: editingLink.url,
                description: editingLink.description,
                categoryId: editingLink.categoryId
              }
            : undefined
        }
        onSubmit={handleLinkSubmit}
        onDelete={
          linkDialogMode === "edit" && editingLink
            ? () => {
                deleteLink(editingLink.id);
                setLinkDialogOpen(false);
              }
            : undefined
        }
        onClose={() => setLinkDialogOpen(false)}
      />
    </main>
  );
}
