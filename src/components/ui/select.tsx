import * as React from "react";
import { cva, type VariantProps } from "@/lib/cva";
import { cn } from "@/lib/utils";

/**
 * A styled wrapper around the native <select> — deliberately not a custom
 * listbox. Keeping the real element preserves native mobile pickers,
 * keyboard behavior, and form semantics for free; only the chrome (border,
 * background, focus ring, sizing) is centralized here instead of being
 * hand-rolled per call site.
 */
export const selectVariants = cva(
  "rounded-lg border border-border bg-background/60 text-foreground transition-colors focus:outline-none focus:ring-1 focus:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-50 [&>option]:bg-popover",
  {
    variants: {
      uiSize: {
        default: "h-10 px-3 py-2 text-sm",
        sm: "rounded px-2 py-1.5 text-xs",
        xs: "rounded px-1.5 py-0.5 font-mono text-[9px]",
      },
    },
    defaultVariants: { uiSize: "default" },
  },
);

// The variant is named uiSize (not size) because SelectHTMLAttributes already
// defines a native `size` attribute (visible row count), which this would
// otherwise collide with.
export interface SelectProps
  extends React.SelectHTMLAttributes<HTMLSelectElement>,
    VariantProps<typeof selectVariants> {}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, uiSize, ...props }, ref) => (
    <select ref={ref} className={cn(selectVariants({ uiSize }), className)} {...props} />
  ),
);
Select.displayName = "Select";

export { Select };
