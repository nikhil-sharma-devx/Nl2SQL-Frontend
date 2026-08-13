import * as React from "react";
import { cva, type VariantProps } from "@/lib/cva";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 select-none",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground font-semibold shadow-[0_8px_24px_-12px_color-mix(in_srgb,var(--primary)_70%,transparent)] hover:opacity-90 hover:-translate-y-px active:translate-y-0",
        gradient:
          "text-primary-foreground font-semibold bg-[linear-gradient(135deg,var(--primary)_0%,var(--chart-2)_100%)] shadow-[0_10px_32px_-10px_color-mix(in_srgb,var(--primary)_65%,transparent)] hover:shadow-[0_14px_44px_-10px_color-mix(in_srgb,var(--primary)_75%,transparent)] hover:-translate-y-px active:translate-y-0",
        secondary:
          "bg-secondary text-secondary-foreground border border-border hover:bg-accent",
        outline:
          "border border-border bg-foreground/[0.02] text-foreground hover:bg-foreground/[0.06] hover:border-border",
        ghost: "text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground",
        destructive:
          "bg-destructive text-destructive-foreground font-semibold shadow-[0_8px_24px_-12px_color-mix(in_srgb,var(--destructive)_65%,transparent)] hover:opacity-90",
        "destructive-ghost":
          "bg-destructive-bg text-destructive-text border border-destructive-border hover:bg-destructive/20 hover:border-destructive-text/50",
        link: "text-primary underline-offset-4 hover:underline hover:text-primary",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-11 rounded-lg px-6 text-base",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
  ),
);
Button.displayName = "Button";

export { Button };
