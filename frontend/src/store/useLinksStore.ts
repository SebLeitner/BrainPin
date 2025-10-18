import { create } from "zustand";

import { categoryApi, linkApi, type ApiLinkPayload } from "@/lib/api";
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
  addCategory: (name: string) => Promise<void>;
  updateCategory: (categoryId: string, name: string) => Promise<void>;
  deleteCategory: (categoryId: string) => Promise<void>;
  addLink: (payload: Omit<LinkItem, "id">) => Promise<void>;
  updateLink: (linkId: string, payload: Partial<Omit<LinkItem, "id">>) => Promise<void>;
  deleteLink: (linkId: string) => Promise<void>;
};

const ALL_CATEGORY: Category = { id: "all", name: "Alle" };

const withoutAll = (categories: Category[]) =>
  categories.filter((category) => category.id !== ALL_CATEGORY.id);

const withAllPrefix = (categories: Category[]) => [ALL_CATEGORY, ...withoutAll(categories)];

const filteredLinks = (state: Pick<StoreState, "links" | "activeCategoryId">) => {
  if (!state.activeCategoryId || state.activeCategoryId === "all") {
    return state.links;
  }

  return state.links.filter((link) => link.categoryId === state.activeCategoryId);
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
  categories: [ALL_CATEGORY],
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
      const [links, categories] = await Promise.all([
        linkApi.list(),
        categoryApi.list()
      ]);

      set((state) => {
        const nextCategories = withAllPrefix(categories);
        const activeCategoryId = state.activeCategoryId;
        const isActiveCategoryValid =
          !activeCategoryId ||
          nextCategories.some((category) => category.id === activeCategoryId);

        return {
          links,
          categories: nextCategories,
          activeCategoryId: isActiveCategoryValid ? activeCategoryId : null,
          isLoading: false,
          hasLoaded: true,
          error: null
        };
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Links konnten nicht geladen werden.";
      set({ isLoading: false, error: message, hasLoaded: force ? false : get().hasLoaded });
    }
  },
  addCategory: async (name) => {
    const trimmed = name.trim();
    if (!trimmed || trimmed.length > 16) {
      throw new Error("Name darf nicht leer sein und maximal 16 Zeichen lang sein.");
    }

    set({ error: null });

    await withErrorHandling(
      async () => {
        const category = await categoryApi.create({ name: trimmed });
        set((state) => ({
          categories: withAllPrefix([...withoutAll(state.categories), category])
        }));
      },
      (message) => set({ error: message })
    );
  },
  updateCategory: async (categoryId, name) => {
    const trimmed = name.trim();
    if (!trimmed || trimmed.length > 16) {
      throw new Error("Name darf nicht leer sein und maximal 16 Zeichen lang sein.");
    }

    set({ error: null });

    await withErrorHandling(
      async () => {
        const category = await categoryApi.update(categoryId, { name: trimmed });
        set((state) => ({
          categories: withAllPrefix(
            withoutAll(state.categories).map((item) =>
              item.id === categoryId ? category : item
            )
          )
        }));
      },
      (message) => set({ error: message })
    );
  },
  deleteCategory: async (categoryId) => {
    if (categoryId === "all") return;
    set({ error: null });

    await withErrorHandling(
      async () => {
        await categoryApi.remove(categoryId);
        set((current) => ({
          categories: current.categories.filter((category) => category.id !== categoryId),
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
          links: [...state.links, link]
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
          links: state.links.map((link) => (link.id === linkId ? updated : link))
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
