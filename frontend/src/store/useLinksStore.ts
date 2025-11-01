import { create } from "zustand";

import {
  categoryApi,
  linkApi,
  type ApiLinkPayload,
  type ApiSublinkPayload
} from "@/lib/api";
import type { Category, LinkItem, SublinkItem } from "@/types/links";

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
  getCategoryNameById: (categoryId: string) => string | undefined;
  getCategoryNamesByIds: (categoryIds: readonly string[]) => string[];
  getSublinksByLinkId: (linkId: string) => SublinkItem[];
  setActiveCategory: (categoryId: string | null) => void;
  clearError: () => void;
  loadLinks: (options?: LoadOptions) => Promise<void>;
  addCategory: (name: string) => Promise<void>;
  updateCategory: (categoryId: string, name: string) => Promise<void>;
  deleteCategory: (categoryId: string) => Promise<void>;
  addLink: (payload: Omit<LinkItem, "id">) => Promise<void>;
  updateLink: (linkId: string, payload: Partial<Omit<LinkItem, "id">>) => Promise<void>;
  deleteLink: (linkId: string) => Promise<void>;
  addSublink: (linkId: string, payload: Omit<SublinkItem, "id">) => Promise<LinkItem>;
  updateSublink: (
    linkId: string,
    sublinkId: string,
    payload: Partial<Omit<SublinkItem, "id">>
  ) => Promise<LinkItem>;
  deleteSublink: (linkId: string, sublinkId: string) => Promise<LinkItem>;
};

const ALL_CATEGORY: Category = { id: "all", name: "Alle" };

const withoutAll = (categories: Category[]) =>
  categories.filter((category) => category.id !== ALL_CATEGORY.id);

const withAllPrefix = (categories: Category[]) => [ALL_CATEGORY, ...withoutAll(categories)];

const filteredLinks = (state: Pick<StoreState, "links" | "activeCategoryId">) => {
  if (!state.activeCategoryId || state.activeCategoryId === "all") {
    return state.links;
  }

  const activeCategoryId = state.activeCategoryId as string;
  return state.links.filter((link) => link.categoryIds.includes(activeCategoryId));
};

const sanitizeSublinks = (sublinks?: SublinkItem[]): SublinkItem[] => {
  if (!sublinks) {
    return [];
  }

  return sublinks.map((sublink) => {
    const trimmedId = sublink.id.trim();
    const trimmedName = sublink.name.trim();
    const trimmedUrl = sublink.url.trim();
    const rawDescription = sublink.description;
    const trimmedDescription =
      typeof rawDescription === "string" ? rawDescription.trim() : "";

    if (!trimmedId) {
      throw new Error("Sublink benötigt eine gültige ID.");
    }
    if (!trimmedName) {
      throw new Error("Sublink-Name darf nicht leer sein.");
    }
    if (!trimmedUrl) {
      throw new Error("Sublink-URL darf nicht leer sein.");
    }

    return {
      id: trimmedId,
      name: trimmedName,
      url: trimmedUrl,
      description:
        typeof rawDescription === "string"
          ? trimmedDescription.length > 0
            ? trimmedDescription
            : null
          : rawDescription ?? null
    };
  });
};

const sanitizeSublinkPayload = (payload: Omit<SublinkItem, "id">): ApiSublinkPayload => {
  const trimmedName = payload.name.trim();
  const trimmedUrl = payload.url.trim();
  const rawDescription = payload.description;
  const trimmedDescription =
    typeof rawDescription === "string" ? rawDescription.trim() : "";

  if (!trimmedName) {
    throw new Error("Sublink-Name darf nicht leer sein.");
  }

  if (!trimmedUrl) {
    throw new Error("Sublink-URL darf nicht leer sein.");
  }

  return {
    name: trimmedName,
    url: trimmedUrl,
    description:
      typeof rawDescription === "string"
        ? trimmedDescription.length > 0
          ? trimmedDescription
          : null
        : rawDescription ?? null
  };
};

const sanitizeSublinkUpdatePayload = (
  payload: Partial<Omit<SublinkItem, "id">>
): Partial<ApiSublinkPayload> => {
  const result: Partial<ApiSublinkPayload> = {};

  if (payload.name !== undefined) {
    const trimmed = payload.name.trim();
    if (!trimmed) {
      throw new Error("Sublink-Name darf nicht leer sein.");
    }
    result.name = trimmed;
  }

  if (payload.url !== undefined) {
    const trimmed = payload.url.trim();
    if (!trimmed) {
      throw new Error("Sublink-URL darf nicht leer sein.");
    }
    result.url = trimmed;
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

const normalizeLink = (link: LinkItem): LinkItem => {
  const sanitizedSublinks = sanitizeSublinks(link.sublinks);
  return {
    ...link,
    categoryIds: [...link.categoryIds],
    sublinks: sanitizedSublinks.map((sublink) => ({ ...sublink }))
  };
};

const cloneLink = (link: LinkItem): LinkItem => ({
  ...link,
  categoryIds: [...link.categoryIds],
  sublinks: link.sublinks.map((sublink) => ({ ...sublink }))
});

const EMPTY_SUBLINKS: SublinkItem[] = [];

const sanitizeCategoryIds = (categoryIds: readonly string[]): string[] => {
  const normalizedIds = categoryIds
    .map((categoryId) => (typeof categoryId === "string" ? categoryId.trim() : ""))
    .filter((categoryId) => categoryId.length > 0);

  const uniqueIds = Array.from(new Set(normalizedIds));

  if (uniqueIds.length === 0) {
    throw new Error("Mindestens eine Kategorie auswählen.");
  }

  return uniqueIds;
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
    categoryIds: sanitizeCategoryIds(payload.categoryIds),
    description,
    sublinks: sanitizeSublinks(payload.sublinks)
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

  if (payload.categoryIds !== undefined) {
    result.categoryIds = sanitizeCategoryIds(payload.categoryIds);
  }

  if (payload.description !== undefined) {
    if (payload.description === null) {
      result.description = null;
    } else {
      const trimmed = payload.description.trim();
      result.description = trimmed.length > 0 ? trimmed : null;
    }
  }

  if (payload.sublinks !== undefined) {
    result.sublinks = sanitizeSublinks(payload.sublinks);
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
  getFilteredLinks: () => filteredLinks(get()).map((link) => cloneLink(link)),
  getCategoryNameById: (categoryId) =>
    get()
      .categories.find((category) => category.id === categoryId)
      ?.name,
  getCategoryNamesByIds: (categoryIds) => {
    const categoryMap = new Map(
      get().categories.map((category) => [category.id, category.name] as const)
    );

    return categoryIds.reduce<string[]>((accumulator, categoryId) => {
      const name = categoryMap.get(categoryId);
      if (name) {
        accumulator.push(name);
      }
      return accumulator;
    }, []);
  },
  getSublinksByLinkId: (linkId) => {
    const link = get().links.find((item) => item.id === linkId);
    return link ? link.sublinks.map((sublink) => ({ ...sublink })) : [];
  },
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
          links: links.map((link) => normalizeLink(link)),
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
          links: [...state.links, normalizeLink(link)]
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
          links: state.links.map((link) =>
            link.id === linkId ? normalizeLink(updated) : link
          )
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
  },
  addSublink: async (linkId, payload) => {
    const sanitized = sanitizeSublinkPayload(payload);

    set({ error: null });

    return await withErrorHandling(
      async () => {
        const updated = await linkApi.addSublink(linkId, sanitized);
        const normalized = normalizeLink(updated);
        set((state) => ({
          links: state.links.map((link) => (link.id === linkId ? normalized : link))
        }));
        return normalized;
      },
      (message) => set({ error: message })
    );
  },
  updateSublink: async (linkId, sublinkId, payload) => {
    const sanitized = sanitizeSublinkUpdatePayload(payload);

    if (Object.keys(sanitized).length === 0) {
      const current = get().links.find((link) => link.id === linkId);
      if (!current) {
        throw new Error("Link wurde nicht gefunden.");
      }
      return current;
    }

    set({ error: null });

    return await withErrorHandling(
      async () => {
        const updated = await linkApi.updateSublink(linkId, sublinkId, sanitized);
        const normalized = normalizeLink(updated);
        set((state) => ({
          links: state.links.map((link) => (link.id === linkId ? normalized : link))
        }));
        return normalized;
      },
      (message) => set({ error: message })
    );
  },
  deleteSublink: async (linkId, sublinkId) => {
    set({ error: null });

    return await withErrorHandling(
      async () => {
        const updated = await linkApi.removeSublink(linkId, sublinkId);
        const normalized = normalizeLink(updated);
        set((state) => ({
          links: state.links.map((link) => (link.id === linkId ? normalized : link))
        }));
        return normalized;
      },
      (message) => set({ error: message })
    );
  }
}));

export const selectCategoryNameById = (categoryId: string) => (state: StoreState) =>
  state.getCategoryNameById(categoryId);

export const selectSublinksByLinkId = (linkId: string) => (state: StoreState) => {
  const link = state.links.find((item) => item.id === linkId);
  return link ? link.sublinks : EMPTY_SUBLINKS;
};

export const selectHasSublinksByLinkId = (linkId: string) => (state: StoreState) =>
  (state.links.find((item) => item.id === linkId)?.sublinks.length ?? 0) > 0;
