import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { cva, type VariantProps } from "@/lib/cva";
import { cn } from "@/lib/utils";

/** Shared inline message banner — the info/warning/destructive/success
 * `border-*-border bg-*-bg text-*-text` panel pattern that was previously
 * hand-rolled per call site across the app. */
export const alertVariants = cva(
  "flex items-start gap-2.5 rounded-xl border p-3 text-sm",
  {
    variants: {
      variant: {
        info: "border-info-border bg-info-bg text-info-text",
        warning: "border-warning-border bg-warning-bg text-warning-text",
        destructive: "border-destructive-border bg-destructive-bg text-destructive-text",
        success: "border-success-border bg-success-bg text-success-text",
      },
    },
    defaultVariants: { variant: "info" },
  },
);

export interface AlertProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof alertVariants> {
  /** Optional leading icon, sized and aligned consistently. */
  icon?: LucideIcon;
}

const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  ({ className, variant, icon: Icon, children, ...props }, ref) => (
    <div ref={ref} role="alert" className={cn(alertVariants({ variant }), className)} {...props}>
      {Icon && <Icon className="mt-0.5 h-4 w-4 shrink-0" />}
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  ),
);
Alert.displayName = "Alert";

export { Alert };
