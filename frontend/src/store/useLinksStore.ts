import { nanoid } from "nanoid";
import { create } from "zustand";

import { linkApi, type ApiLinkPayload } from "@/lib/api";
import type { Category, LinkItem } from "@/types/links";

type LoadOptions = {
  force?: boolean;
};

type StoreState = {
  categories: Category[];
  links: LinkItem[];
  activeCategoryId: string | null;
  isLoading: boolean;
  hasLoaded: boolean;
  error: string | null;
  getFilteredLinks: () => LinkItem[];
  setActiveCategory: (categoryId: string | null) => void;
  clearError: () => void;
  loadLinks: (options?: LoadOptions) => Promise<void>;
  addCategory: (name: string) => void;
  updateCategory: (categoryId: string, name: string) => void;
  deleteCategory: (categoryId: string) => Promise<void>;
  addLink: (payload: Omit<LinkItem, "id">) => Promise<void>;
  updateLink: (linkId: string, payload: Partial<Omit<LinkItem, "id">>) => Promise<void>;
  deleteLink: (linkId: string) => Promise<void>;
};

const DEFAULT_CATEGORIES: Category[] = [
  { id: "all", name: "Alle" },
  { id: "dev", name: "Dev" },
  { id: "design", name: "Design" },
  { id: "learn", name: "Lernen" }
];

const filteredLinks = (state: Pick<StoreState, "links" | "activeCategoryId">) => {
  if (!state.activeCategoryId || state.activeCategoryId === "all") {
    return state.links;
  }

  return state.links.filter((link) => link.categoryId === state.activeCategoryId);
};

const toTitleCase = (value: string) => {
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ")
    .trim();
};

const ensureCategory = (categories: Category[], categoryId: string): Category[] => {
  if (!categoryId || categoryId === "all") {
    return categories;
  }

  if (categories.some((category) => category.id === categoryId)) {
    return categories;
  }

  const name = toTitleCase(categoryId) || categoryId;
  return [...categories, { id: categoryId, name }];
};

const mergeCategoriesFromLinks = (categories: Category[], links: LinkItem[]) => {
  let nextCategories = categories;
  const processed = new Set<string>();

  for (const link of links) {
    if (processed.has(link.categoryId)) continue;
    processed.add(link.categoryId);
    nextCategories = ensureCategory(nextCategories, link.categoryId);
  }

  return nextCategories;
};

const sanitizePayload = (payload: Omit<LinkItem, "id">): ApiLinkPayload => {
  const trimmedName = payload.name.trim();
  const trimmedUrl = payload.url.trim();
  const rawDescription = payload.description;
  const trimmedDescription =
    typeof rawDescription === "string" ? rawDescription.trim() : "";

  if (!trimmedName) {
    throw new Error("Name darf nicht leer sein.");
  }

  if (trimmedName.length > 16) {
    throw new Error("Name darf maximal 16 Zeichen lang sein.");
  }

  if (!trimmedUrl) {
    throw new Error("URL darf nicht leer sein.");
  }

  const description =
    typeof rawDescription === "string"
      ? trimmedDescription.length > 0
        ? trimmedDescription
        : null
      : rawDescription ?? null;

  return {
    name: trimmedName,
    url: trimmedUrl,
    categoryId: payload.categoryId,
    description
  };
};

const sanitizeUpdatePayload = (
  payload: Partial<Omit<LinkItem, "id">>
): Partial<ApiLinkPayload> => {
  const result: Partial<ApiLinkPayload> = {};

  if (payload.name !== undefined) {
    const trimmed = payload.name.trim();
    if (!trimmed) {
      throw new Error("Name darf nicht leer sein.");
    }
    if (trimmed.length > 16) {
      throw new Error("Name darf maximal 16 Zeichen lang sein.");
    }
    result.name = trimmed;
  }

  if (payload.url !== undefined) {
    const trimmed = payload.url.trim();
    if (!trimmed) {
      throw new Error("URL darf nicht leer sein.");
    }
    result.url = trimmed;
  }

  if (payload.categoryId !== undefined) {
    result.categoryId = payload.categoryId;
  }

  if (payload.description !== undefined) {
    if (payload.description === null) {
      result.description = null;
    } else {
      const trimmed = payload.description.trim();
      result.description = trimmed.length > 0 ? trimmed : null;
    }
  }

  return result;
};

const withErrorHandling = async <T>(handler: () => Promise<T>, onError: (message: string) => void) => {
  try {
    return await handler();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unbekannter Fehler";
    onError(message);
    throw new Error(message);
  }
};

export const useLinksStore = create<StoreState>((set, get) => ({
  categories: DEFAULT_CATEGORIES,
  links: [],
  activeCategoryId: null,
  isLoading: false,
  hasLoaded: false,
  error: null,
  getFilteredLinks: () => filteredLinks(get()),
  setActiveCategory: (categoryId) => {
    set({ activeCategoryId: categoryId });
  },
  clearError: () => {
    set({ error: null });
  },
  loadLinks: async (options) => {
    const { force = false } = options ?? {};
    const { isLoading, hasLoaded } = get();

    if (isLoading || (hasLoaded && !force)) {
      return;
    }

    set({ isLoading: true, error: null });

    try {
      const links = await linkApi.list();
      set((state) => ({
        links,
        categories: mergeCategoriesFromLinks(state.categories, links),
        isLoading: false,
        hasLoaded: true,
        error: null
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Links konnten nicht geladen werden.";
      set({ isLoading: false, error: message, hasLoaded: force ? false : get().hasLoaded });
    }
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
      )
    }));
  },
  deleteCategory: async (categoryId) => {
    if (categoryId === "all") return;

    const state = get();
    const linksToDelete = state.links.filter((link) => link.categoryId === categoryId);

    set({ error: null });

    await withErrorHandling(
      async () => {
        for (const link of linksToDelete) {
          await linkApi.remove(link.id);
        }

        set((current) => ({
          categories: current.categories.filter((category) => category.id !== categoryId),
          links: current.links.filter((link) => link.categoryId !== categoryId),
          activeCategoryId: current.activeCategoryId === categoryId ? null : current.activeCategoryId
        }));
      },
      (message) => set({ error: message })
    );
  },
  addLink: async (payload) => {
    const sanitized = sanitizePayload(payload);

    set({ error: null });

    await withErrorHandling(
      async () => {
        const link = await linkApi.create(sanitized);
        set((state) => ({
          links: [...state.links, link],
          categories: ensureCategory(state.categories, link.categoryId)
        }));
      },
      (message) => set({ error: message })
    );
  },
  updateLink: async (linkId, payload) => {
    const sanitized = sanitizeUpdatePayload(payload);

    if (Object.keys(sanitized).length === 0) {
      return;
    }

    set({ error: null });

    await withErrorHandling(
      async () => {
        const updated = await linkApi.update(linkId, sanitized);
        set((state) => ({
          links: state.links.map((link) => (link.id === linkId ? updated : link)),
          categories: ensureCategory(state.categories, updated.categoryId)
        }));
      },
      (message) => set({ error: message })
    );
  },
  deleteLink: async (linkId) => {
    set({ error: null });

    await withErrorHandling(
      async () => {
        await linkApi.remove(linkId);
        set((state) => ({
          links: state.links.filter((link) => link.id !== linkId)
        }));
      },
      (message) => set({ error: message })
    );
  }
}));
