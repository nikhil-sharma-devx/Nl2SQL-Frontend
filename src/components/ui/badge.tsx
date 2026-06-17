import * as React from "react";
import { cva, type VariantProps } from "@/lib/cva";
import { cn } from "@/lib/utils";

export const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider transition-colors [&_svg]:size-3 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "border-primary/25 bg-primary/10 text-primary",
        secondary: "border-border bg-foreground/5 text-foreground/85",
        info: "border-info-border bg-info-bg text-info-text",
        violet: "border-violet-border bg-violet-bg text-violet-text",
        warning: "border-warning-border bg-warning-bg text-warning-text",
        destructive: "border-destructive-border bg-destructive-bg text-destructive-text",
        outline: "border-border bg-transparent text-foreground/85",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge };
