"use client";

import clsx from "clsx";

type LoadingSpinnerProps = {
  label?: string;
  className?: string;
  size?: "sm" | "md" | "lg";
};

const sizeStyles: Record<NonNullable<LoadingSpinnerProps["size"]>, string> = {
  sm: "h-5 w-5 border-2",
  md: "h-8 w-8 border-2",
  lg: "h-12 w-12 border-[3px]"
};

export function LoadingSpinner({ label, className, size = "md" }: LoadingSpinnerProps) {
  return (
    <div className={clsx("flex flex-col items-center gap-3 text-slate-300", className)}>
      <div
        className={clsx(
          "animate-spin rounded-full border-brand-400 border-t-transparent",
          sizeStyles[size]
        )}
      />
      {label ? <p className="text-sm text-slate-400">{label}</p> : null}
    </div>
  );
}
