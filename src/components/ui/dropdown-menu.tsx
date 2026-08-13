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
  /** Closes the menu and returns focus to the trigger — the only path that should
      run on Escape, outside-click, or item activation, so keyboard users never
      lose their place. */
  close: () => void;
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
  const close = React.useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, []);
  return (
    <DropdownContext.Provider value={{ open, setOpen, close, triggerRef, rect, setRect }}>
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
    const { open, setOpen, close, triggerRef, rect, setRect } = useDropdown();
    const contentRef = React.useRef<HTMLDivElement | null>(null);

    const menuItems = () =>
      Array.from(contentRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])') ?? []);

    // Move focus onto the first item the moment the menu opens (keyboard or mouse),
    // so arrow keys work immediately without a prior Tab.
    React.useEffect(() => {
      if (!open) return;
      const id = requestAnimationFrame(() => menuItems()[0]?.focus());
      return () => cancelAnimationFrame(id);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

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
        const items = menuItems();
        const currentIndex = items.indexOf(document.activeElement as HTMLElement);
        if (e.key === "Escape") {
          e.preventDefault();
          close();
        } else if (e.key === "ArrowDown") {
          e.preventDefault();
          items[(currentIndex + 1 + items.length) % items.length]?.focus();
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          items[(currentIndex - 1 + items.length) % items.length]?.focus();
        } else if (e.key === "Home") {
          e.preventDefault();
          items[0]?.focus();
        } else if (e.key === "End") {
          e.preventDefault();
          items[items.length - 1]?.focus();
        } else if (e.key === "Tab") {
          // Tabbing out of an open menu should close it rather than leave it floating.
          setOpen(false);
        }
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
    }, [open, setOpen, close, triggerRef, setRect]);

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
          "glass-strong z-[120] max-h-[60vh] min-w-[12rem] overflow-y-auto custom-scrollbar rounded-xl p-1 animate-slide-up",
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
  const { close } = useDropdown();
  return (
    <button
      ref={ref}
      type="button"
      role="menuitem"
      tabIndex={-1}
      className={cn(
        "flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm text-foreground/80 transition-colors hover:bg-foreground/[0.06] hover:text-foreground focus:bg-primary/10 focus:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70 focus-visible:ring-inset disabled:pointer-events-none disabled:opacity-50",
        className,
      )}
      onClick={(e) => {
        onClick?.(e);
        close();
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
