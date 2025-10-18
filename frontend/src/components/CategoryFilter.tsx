"use client";

import clsx from "clsx";
import { useLinksStore } from "@/store/useLinksStore";

export function CategoryFilter() {
  const { categories, activeCategoryId, setActiveCategory } = useLinksStore((state) => ({
    categories: state.categories,
    activeCategoryId: state.activeCategoryId,
    setActiveCategory: state.setActiveCategory
  }));

  return (
    <div className="flex flex-wrap gap-2">
      {categories.map((category) => (
        <button
          key={category.id}
          type="button"
          onClick={() => setActiveCategory(category.id === "all" ? null : category.id)}
          className={clsx(
            "rounded-full border px-4 py-2 text-sm font-medium transition",
            category.id === "all" && activeCategoryId === null
              ? "border-brand-400 bg-brand-500/20 text-brand-200"
              : activeCategoryId === category.id
              ? "border-brand-400 bg-brand-500/20 text-brand-200"
              : "border-slate-700 bg-slate-900 text-slate-200 hover:border-brand-400 hover:text-brand-100"
          )}
        >
          {category.name}
        </button>
      ))}
    </div>
  );
}
