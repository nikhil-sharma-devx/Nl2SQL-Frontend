import * as React from "react";
import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface FormMessageProps extends React.HTMLAttributes<HTMLParagraphElement> {
  children?: React.ReactNode;
}

/**
 * The one inline form-error primitive for the app (audit #2). Renders nothing
 * when there's no message, so callers can pass `error` straight through:
 *   <FormMessage>{errors.email}</FormMessage>
 * `role="alert"` + `aria-live="assertive"` announces it to screen readers the
 * instant it appears — plain DOM text never does.
 */
const FormMessage = React.forwardRef<HTMLParagraphElement, FormMessageProps>(
  ({ className, children, ...props }, ref) => {
    if (!children) return null;
    return (
      <p
        ref={ref}
        role="alert"
        aria-live="assertive"
        className={cn("flex items-start gap-1.5 text-xs font-medium text-destructive-text", className)}
        {...props}
      >
        <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span>{children}</span>
      </p>
    );
  },
);
FormMessage.displayName = "FormMessage";

export { FormMessage };
