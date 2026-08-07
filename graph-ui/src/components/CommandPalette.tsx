import { type RefObject, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

export interface CommandAction {
  id: string;
  label: string;
  keywords?: string[];
  run: () => void;
}

interface CommandPaletteProps {
  open: boolean;
  actions: CommandAction[];
  onOpenChange: (open: boolean) => void;
  fallbackFocusRef?: RefObject<HTMLElement | null>;
}

export function CommandPalette({
  open,
  actions,
  onOpenChange,
  fallbackFocusRef,
}: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const activeOptionRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    setQuery("");
    setActiveIndex(0);
    inputRef.current?.focus();

    const dialog = dialogRef.current;
    const backgroundElements = Array.from(document.body.children).filter(
      (element): element is HTMLElement => element instanceof HTMLElement && element !== dialog,
    );
    const backgroundState = backgroundElements.map((element) => ({
      element,
      inert: element.getAttribute("inert"),
      ariaHidden: element.getAttribute("aria-hidden"),
    }));
    for (const element of backgroundElements) {
      element.setAttribute("inert", "");
      element.setAttribute("aria-hidden", "true");
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onOpenChange(false);
      } else if (event.key === "Tab" && dialog) {
        const focusable = Array.from(
          dialog.querySelectorAll<HTMLElement>(
            'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
          ),
        );
        if (focusable.length === 0) {
          event.preventDefault();
          return;
        }
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      for (const { element, inert, ariaHidden } of backgroundState) {
        if (inert === null) element.removeAttribute("inert");
        else element.setAttribute("inert", inert);
        if (ariaHidden === null) element.removeAttribute("aria-hidden");
        else element.setAttribute("aria-hidden", ariaHidden);
      }
      const previousFocus = previousFocusRef.current;
      const focusTarget = previousFocus?.isConnected
        ? previousFocus
        : fallbackFocusRef?.current;
      focusTarget?.focus();
    };
  }, [fallbackFocusRef, open, onOpenChange]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return actions;
    return actions.filter((action) =>
      [action.label, ...(action.keywords ?? [])].some((value) =>
        value.toLowerCase().includes(needle),
      ),
    );
  }, [actions, query]);

  useEffect(() => {
    if (open) activeOptionRef.current?.scrollIntoView?.({ block: "nearest" });
  }, [activeIndex, filtered, open]);

  if (!open) return null;

  return createPortal(
    <div
      ref={dialogRef}
      className="fixed inset-0 z-[100] flex items-start justify-center bg-black/55 px-4 pt-[15vh] backdrop-blur-sm"
      role="dialog"
      aria-label="Command palette"
      aria-modal="true"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onOpenChange(false);
      }}
    >
      <div className="w-full max-w-xl overflow-hidden rounded-xl border border-border/80 bg-card/95 shadow-2xl shadow-black/50">
        <input
          ref={inputRef}
          role="combobox"
          aria-label="Search commands"
          aria-controls="jynx-command-list"
          aria-activedescendant={filtered[activeIndex] ? `jynx-command-${filtered[activeIndex].id}` : undefined}
          aria-expanded="true"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActiveIndex(0);
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown" && filtered.length > 0) {
              event.preventDefault();
              setActiveIndex((index) => (index + 1) % filtered.length);
            } else if (event.key === "ArrowUp" && filtered.length > 0) {
              event.preventDefault();
              setActiveIndex((index) => (index - 1 + filtered.length) % filtered.length);
            } else if (event.key === "Enter" && filtered[activeIndex]) {
              event.preventDefault();
              filtered[activeIndex].run();
              onOpenChange(false);
            }
          }}
          placeholder="Search commands…"
          className="h-12 w-full border-b border-border/60 bg-transparent px-4 text-sm text-foreground outline-none placeholder:text-muted-foreground"
        />
        <div id="jynx-command-list" role="listbox" className="max-h-80 overflow-y-auto p-2">
          {filtered.map((action, index) => (
            <button
              key={action.id}
              ref={index === activeIndex ? activeOptionRef : undefined}
              id={`jynx-command-${action.id}`}
              type="button"
              role="option"
              aria-selected={index === activeIndex}
              aria-label={action.label}
              className={`flex w-full items-center rounded-lg px-3 py-2.5 text-left text-sm transition-colors focus-visible:outline-none ${
                index === activeIndex
                  ? "bg-primary/15 text-foreground"
                  : "text-foreground/75 hover:bg-primary/10 hover:text-foreground"
              }`}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => {
                action.run();
                onOpenChange(false);
              }}
            >
              {action.label}
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">No commands found</p>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
