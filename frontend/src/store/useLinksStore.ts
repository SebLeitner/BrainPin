import { create } from "zustand";
import { nanoid } from "nanoid";

export type Category = {
  id: string;
  name: string;
};

export type LinkItem = {
  id: string;
  name: string;
  url: string;
  categoryId: string;
  description?: string;
};

type StoreState = {
  categories: Category[];
  links: LinkItem[];
  activeCategoryId: string | null;
  getFilteredLinks: () => LinkItem[];
  setActiveCategory: (categoryId: string | null) => void;
  addCategory: (name: string) => void;
  updateCategory: (categoryId: string, name: string) => void;
  deleteCategory: (categoryId: string) => void;
  addLink: (payload: Omit<LinkItem, "id">) => void;
  updateLink: (linkId: string, payload: Partial<Omit<LinkItem, "id">>) => void;
  deleteLink: (linkId: string) => void;
};

const initialCategories: Category[] = [
  { id: "all", name: "Alle" },
  { id: "dev", name: "Dev" },
  { id: "design", name: "Design" },
  { id: "learn", name: "Lernen" }
];

const initialLinks: LinkItem[] = [
  {
    id: "lnk-1",
    name: "Next Docs",
    url: "https://nextjs.org/docs",
    categoryId: "dev",
    description: "Aktuelle Next.js Dokumentation"
  },
  {
    id: "lnk-2",
    name: "Figma",
    url: "https://www.figma.com",
    categoryId: "design",
    description: "Design-Tool"
  },
  {
    id: "lnk-3",
    name: "egghead",
    url: "https://egghead.io",
    categoryId: "learn",
    description: "Lernplattform"
  }
];

const filteredLinks = (state: Pick<StoreState, "links" | "activeCategoryId">) => {
  if (!state.activeCategoryId || state.activeCategoryId === "all") {
    return state.links;
  }

  return state.links.filter((link) => link.categoryId === state.activeCategoryId);
};

export const useLinksStore = create<StoreState>((set, get) => ({
  categories: initialCategories,
  links: initialLinks,
  activeCategoryId: null,
  getFilteredLinks: () => filteredLinks(get()),
  setActiveCategory: (categoryId) => {
    set({ activeCategoryId: categoryId });
  },
  addCategory: (name) => {
    const trimmed = name.trim();
    if (!trimmed || trimmed.length > 16) return;
    set((state) => ({
      categories: [...state.categories, { id: nanoid(6), name: trimmed }]
    }));
  },
  updateCategory: (categoryId, name) => {
    const trimmed = name.trim();
    if (!trimmed || trimmed.length > 16) return;
    set((state) => ({
      categories: state.categories.map((category) =>
        category.id === categoryId ? { ...category, name: trimmed } : category
      ),
      links: state.links.map((link) =>
        link.categoryId === categoryId ? { ...link, categoryId } : link
      )
    }));
  },
  deleteCategory: (categoryId) => {
    if (categoryId === "all") return;
    set((state) => ({
      categories: state.categories.filter((category) => category.id !== categoryId),
      links: state.links.filter((link) => link.categoryId !== categoryId),
      activeCategoryId:
        state.activeCategoryId === categoryId ? null : state.activeCategoryId
    }));
  },
  addLink: (payload) => {
    const trimmed = payload.name.trim();
    if (!trimmed || trimmed.length > 16) return;
    set((state) => ({
      links: [...state.links, { ...payload, name: trimmed, id: nanoid(8) }]
    }));
  },
  updateLink: (linkId, payload) => {
    const nextName = payload.name?.trim();
    if (typeof nextName === "string" && (!nextName || nextName.length > 16)) {
      return;
    }

    set((state) => ({
      links: state.links.map((link) =>
        link.id === linkId
          ? {
              ...link,
              ...payload,
              name: nextName ? nextName : link.name
            }
          : link
      )
    }));
  },
  deleteLink: (linkId) => {
    set((state) => ({
      links: state.links.filter((link) => link.id !== linkId)
    }));
  }
}));
