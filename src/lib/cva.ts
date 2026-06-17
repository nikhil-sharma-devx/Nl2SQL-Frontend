import { clsx, type ClassValue } from "clsx";

/**
 * Minimal, dependency-free implementation of `class-variance-authority`'s
 * `cva` / `VariantProps`, providing the same authoring API used by shadcn/ui
 * components. (The registry build of `class-variance-authority` is not
 * installable in this environment, so this local shim is used instead.)
 */

type ConfigSchema = Record<string, Record<string, ClassValue>>;
type ConfigVariants<T extends ConfigSchema> = {
  [K in keyof T]?: keyof T[K] | null | undefined;
};
type Extra = { class?: ClassValue; className?: ClassValue };

interface CvaConfig<T extends ConfigSchema> {
  variants?: T;
  defaultVariants?: ConfigVariants<T>;
  compoundVariants?: (ConfigVariants<T> & Extra)[];
}

export type VariantProps<T extends (...args: never[]) => string> = Omit<
  NonNullable<Parameters<T>[0]>,
  "class" | "className"
>;

export function cva<T extends ConfigSchema>(
  base?: ClassValue,
  config?: CvaConfig<T>,
) {
  return (props?: ConfigVariants<T> & Extra): string => {
    const variants = config?.variants;
    if (!variants) return clsx(base, props?.class, props?.className);

    const defaults = config?.defaultVariants;
    const variantClasses = Object.keys(variants).map((variant) => {
      const fromProps = (props as Record<string, unknown> | undefined)?.[variant];
      const value = (fromProps ?? (defaults as Record<string, unknown> | undefined)?.[variant]) as
        | string
        | null
        | undefined;
      if (value == null) return undefined;
      return (variants[variant] as Record<string, ClassValue>)[value];
    });

    const compound = (config?.compoundVariants ?? []).map((cv) => {
      const { class: c, className: cn2, ...conditions } = cv as Extra & Record<string, unknown>;
      const matches = Object.keys(conditions).every((key) => {
        const current =
          (props as Record<string, unknown> | undefined)?.[key] ??
          (defaults as Record<string, unknown> | undefined)?.[key];
        return current === conditions[key];
      });
      return matches ? [c, cn2] : undefined;
    });

    return clsx(base, variantClasses, compound, props?.class, props?.className);
  };
}
