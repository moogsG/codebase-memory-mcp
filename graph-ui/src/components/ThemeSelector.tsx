import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Check, ChevronDown, Palette } from "lucide-react";
import { THEMES, type ThemeId } from "../lib/themes";

interface ThemeSelectorProps {
  value: ThemeId;
  onChange: (theme: ThemeId) => void;
}

export function ThemeSelector({ value, onChange }: ThemeSelectorProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const openingFocusRef = useRef<"selected" | "first" | "last">("selected");
  const active = useMemo(
    () => THEMES.find((theme) => theme.id === value) ?? THEMES[0],
    [value],
  );

  useEffect(() => {
    if (!open) return;
    const selectedIndex = THEMES.findIndex((theme) => theme.id === value);
    const focusIndex =
      openingFocusRef.current === "first"
        ? 0
        : openingFocusRef.current === "last"
          ? THEMES.length - 1
          : Math.max(0, selectedIndex);
    itemRefs.current[focusIndex]?.focus();
    openingFocusRef.current = "selected";

    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open, value]);

  const closeAndRestoreFocus = () => {
    setOpen(false);
    triggerRef.current?.focus();
  };

  const onMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const items = itemRefs.current.filter(
      (item): item is HTMLButtonElement => item !== null,
    );
    const currentIndex = Math.max(
      0,
      items.indexOf(document.activeElement as HTMLButtonElement),
    );
    let nextIndex: number | null = null;

    switch (event.key) {
      case "ArrowDown":
        nextIndex = (currentIndex + 1) % items.length;
        break;
      case "ArrowUp":
        nextIndex = (currentIndex - 1 + items.length) % items.length;
        break;
      case "Home":
        nextIndex = 0;
        break;
      case "End":
        nextIndex = items.length - 1;
        break;
      case "Escape":
        event.preventDefault();
        closeAndRestoreFocus();
        return;
      case "Tab":
        setOpen(false);
        return;
      default:
        return;
    }

    event.preventDefault();
    items[nextIndex]?.focus();
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-label={`Theme: ${active.name}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(event) => {
          if (!open) {
            openingFocusRef.current = event.detail === 0 ? "first" : "selected";
          }
          setOpen((current) => !current);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            openingFocusRef.current = "first";
            setOpen(true);
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            openingFocusRef.current = "last";
            setOpen(true);
          } else if ((event.key === "Enter" || event.key === " ") && !open) {
            openingFocusRef.current = "first";
          } else if (event.key === "Escape" && open) {
            event.preventDefault();
            closeAndRestoreFocus();
          }
        }}
        className="group flex h-8 items-center gap-2 rounded-md border border-border/70 bg-card/70 px-2.5 text-[11px] font-medium text-muted-foreground shadow-sm transition-all hover:border-primary/45 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Palette className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
        <span className="hidden sm:inline">{active.name}</span>
        <span className="flex -space-x-1" aria-hidden="true">
          {active.swatches.slice(1, 4).map((color) => (
            <span
              key={color}
              className="h-2.5 w-2.5 rounded-full border border-background/80"
              style={{ backgroundColor: color }}
            />
          ))}
        </span>
        <ChevronDown
          className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Choose theme"
          onKeyDown={onMenuKeyDown}
          className="absolute right-0 top-10 z-50 w-72 overflow-hidden rounded-xl border border-border/80 bg-popover/95 p-1.5 shadow-2xl backdrop-blur-xl"
        >
          <div className="px-2.5 pb-2 pt-1.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Interface theme
          </div>
          {THEMES.map((theme, index) => {
            const selected = theme.id === value;
            return (
              <button
                ref={(node) => {
                  itemRefs.current[index] = node;
                }}
                key={theme.id}
                type="button"
                role="menuitemradio"
                aria-checked={selected}
                tabIndex={selected ? 0 : -1}
                aria-label={`${theme.name}: ${theme.description}`}
                onClick={() => {
                  onChange(theme.id);
                  closeAndRestoreFocus();
                }}
                className={`flex w-full items-center gap-3 rounded-lg px-2.5 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring ${
                  selected
                    ? "bg-primary/12 text-foreground"
                    : "text-muted-foreground hover:bg-foreground/[0.045] hover:text-foreground"
                }`}
              >
                <span
                  className="flex h-8 w-11 shrink-0 items-center justify-center gap-0.5 rounded-md border border-border/60"
                  style={{ backgroundColor: theme.swatches[0] }}
                  aria-hidden="true"
                >
                  {theme.swatches.slice(1, 4).map((color) => (
                    <span
                      key={color}
                      className="h-3 w-2 rounded-sm"
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[11px] font-semibold">{theme.name}</span>
                  <span className="mt-0.5 block truncate text-[9px] text-muted-foreground">
                    {theme.description}
                  </span>
                </span>
                <Check
                  className={`h-3.5 w-3.5 text-primary ${selected ? "opacity-100" : "opacity-0"}`}
                  aria-hidden="true"
                />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
