import * as React from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

/**
 * Composable dropdown menu (shadcn-style API) without external deps.
 * The content is rendered in a portal with fixed positioning so it is never
 * clipped or trapped by an ancestor's overflow / backdrop-blur stacking context.
 */
interface Rect {
  top: number;
  bottom: number;
  left: number;
  right: number;
  width: number;
}
interface DropdownContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
  rect: Rect | null;
  setRect: (rect: Rect | null) => void;
}
const DropdownContext = React.createContext<DropdownContextValue | null>(null);
const useDropdown = () => {
  const ctx = React.useContext(DropdownContext);
  if (!ctx) throw new Error("DropdownMenu components must be used within <DropdownMenu>");
  return ctx;
};

function DropdownMenu({ className, children }: { className?: string; children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const [rect, setRect] = React.useState<Rect | null>(null);
  const triggerRef = React.useRef<HTMLButtonElement | null>(null);
  return (
    <DropdownContext.Provider value={{ open, setOpen, triggerRef, rect, setRect }}>
      <div className={cn("relative inline-block", className)}>{children}</div>
    </DropdownContext.Provider>
  );
}

const DropdownMenuTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, onClick, ...props }, _ref) => {
  const { open, setOpen, triggerRef, setRect } = useDropdown();
  const measure = () => {
    const el = triggerRef.current;
    if (el) {
      const r = el.getBoundingClientRect();
      setRect({ top: r.top, bottom: r.bottom, left: r.left, right: r.right, width: r.width });
    }
  };
  return (
    <button
      ref={triggerRef}
      type="button"
      aria-haspopup="menu"
      aria-expanded={open}
      className={className}
      onClick={(e) => {
        measure();
        setOpen(!open);
        onClick?.(e);
      }}
      {...props}
    />
  );
});
DropdownMenuTrigger.displayName = "DropdownMenuTrigger";

interface DropdownMenuContentProps extends React.HTMLAttributes<HTMLDivElement> {
  align?: "start" | "end";
}
const DropdownMenuContent = React.forwardRef<HTMLDivElement, DropdownMenuContentProps>(
  ({ className, align = "start", style, ...props }, _ref) => {
    const { open, setOpen, triggerRef, rect, setRect } = useDropdown();
    const contentRef = React.useRef<HTMLDivElement | null>(null);

    React.useEffect(() => {
      if (!open) return;
      const remeasure = () => {
        const el = triggerRef.current;
        if (el) {
          const r = el.getBoundingClientRect();
          setRect({ top: r.top, bottom: r.bottom, left: r.left, right: r.right, width: r.width });
        }
      };
      const onPointer = (e: MouseEvent) => {
        const t = e.target as Node;
        if (contentRef.current?.contains(t) || triggerRef.current?.contains(t)) return;
        setOpen(false);
      };
      const onKey = (e: KeyboardEvent) => {
        if (e.key === "Escape") setOpen(false);
      };
      window.addEventListener("resize", remeasure);
      window.addEventListener("scroll", remeasure, true);
      document.addEventListener("mousedown", onPointer);
      document.addEventListener("keydown", onKey);
      return () => {
        window.removeEventListener("resize", remeasure);
        window.removeEventListener("scroll", remeasure, true);
        document.removeEventListener("mousedown", onPointer);
        document.removeEventListener("keydown", onKey);
      };
    }, [open, setOpen, triggerRef, setRect]);

    if (!open || !rect) return null;

    const spaceBelow = window.innerHeight - rect.bottom;
    const openUp = spaceBelow < 280 && rect.top > spaceBelow;
    const positionStyle: React.CSSProperties = {
      position: "fixed",
      ...(openUp ? { bottom: window.innerHeight - rect.top + 6 } : { top: rect.bottom + 6 }),
      ...(align === "end"
        ? { right: Math.max(8, window.innerWidth - rect.right) }
        : { left: Math.max(8, rect.left) }),
      minWidth: rect.width,
      ...style,
    };

    return createPortal(
      <div
        ref={contentRef}
        role="menu"
        style={positionStyle}
        className={cn(
          "z-[120] max-h-[60vh] min-w-[12rem] overflow-y-auto custom-scrollbar rounded-xl border border-border bg-popover/95 p-1 shadow-[0_24px_70px_-18px_rgba(0,0,0,0.6)] backdrop-blur-2xl animate-slide-up",
          className,
        )}
        {...props}
      />,
      document.body,
    );
  },
);
DropdownMenuContent.displayName = "DropdownMenuContent";

const DropdownMenuItem = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, onClick, ...props }, ref) => {
  const { setOpen } = useDropdown();
  return (
    <button
      ref={ref}
      type="button"
      role="menuitem"
      className={cn(
        "flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm text-foreground/80 transition-colors hover:bg-foreground/[0.06] hover:text-foreground focus:bg-foreground/[0.06] focus:outline-none disabled:pointer-events-none disabled:opacity-50",
        className,
      )}
      onClick={(e) => {
        onClick?.(e);
        setOpen(false);
      }}
      {...props}
    />
  );
});
DropdownMenuItem.displayName = "DropdownMenuItem";

function DropdownMenuLabel({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground", className)}
      {...props}
    />
  );
}

function DropdownMenuSeparator({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("my-1 h-px bg-border", className)} {...props} />;
}

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
};
