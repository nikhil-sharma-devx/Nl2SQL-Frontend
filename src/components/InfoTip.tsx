export default function InfoTip({ text }: { text: string }) {
  return (
    <span className="group relative ml-1.5 inline-flex items-center align-middle">
      {/* A real, focusable button (not a hover-only span) so keyboard users can
          reach and reveal the tip — hover is never the only way in. */}
      <button
        type="button"
        aria-label={text}
        className="flex h-4 w-4 cursor-default select-none items-center justify-center rounded-full border border-muted-foreground/25 bg-transparent p-0 text-[10px] font-semibold leading-none text-muted-foreground/45 transition-colors hover:border-primary/50 hover:text-primary/70 focus-visible:border-primary/50 focus-visible:text-primary/70"
      >
        i
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-0 z-50 mb-2 w-60 rounded-lg border border-border bg-popover px-3 py-2 text-xs leading-relaxed text-muted-foreground opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
      >
        {text}
      </span>
    </span>
  );
}
