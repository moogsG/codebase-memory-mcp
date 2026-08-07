import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GraphTab } from "./components/GraphTab";
import { StatsTab } from "./components/StatsTab";
import { ControlTab } from "./components/ControlTab";
import { ThemeSelector } from "./components/ThemeSelector";
import { BrandMark } from "./components/BrandMark";
import { CommandPalette, type CommandAction } from "./components/CommandPalette";
import type { TabId } from "./lib/types";
import { useUiMessages } from "./lib/i18n";
import {
  DEFAULT_THEME_ID,
  THEMES,
  isThemeId,
  setTheme as persistTheme,
  type ThemeId,
} from "./lib/themes";

const TAB_IDS: TabId[] = ["graph", "stats", "control"];

interface RouteState {
  tab: TabId;
  project: string | null;
}

/* Read the active tab + selected project from the URL query string so the
 * current view survives refreshes and can be bookmarked or shared. */
function readRoute(): RouteState {
  const params = new URLSearchParams(window.location.search);
  const rawTab = params.get("tab");
  const tab = TAB_IDS.includes(rawTab as TabId) ? (rawTab as TabId) : "stats";
  const project = params.get("project");
  return { tab, project: project ? project : null };
}

/* Build the canonical URL for a route, preserving the path and hash. */
function routeUrl(tab: TabId, project: string | null): string {
  const params = new URLSearchParams();
  params.set("tab", tab);
  if (project) params.set("project", project);
  return `${window.location.pathname}?${params.toString()}${window.location.hash}`;
}

export function App() {
  const t = useUiMessages();
  const [route, setRoute] = useState<RouteState>(readRoute);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const exitFocusButtonRef = useRef<HTMLButtonElement>(null);
  const [theme, setTheme] = useState<ThemeId>(() => {
    const active = document.documentElement.dataset.theme;
    return isThemeId(active) ? active : DEFAULT_THEME_ID;
  });
  const { tab: activeTab, project: selectedProject } = route;
  const graphFocusMode = activeTab === "graph" && focusMode;

  const changeTheme = useCallback((nextTheme: ThemeId) => {
    persistTheme(nextTheme);
    setTheme(nextTheme);
  }, []);

  /* Normalize the URL on first load so it always carries the current route. */
  useEffect(() => {
    const initial = readRoute();
    window.history.replaceState(null, "", routeUrl(initial.tab, initial.project));
  }, []);

  /* Sync state when the user navigates with the browser back/forward buttons. */
  useEffect(() => {
    const onPopState = () => setRoute(readRoute());
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    if (activeTab !== "graph") setFocusMode(false);
  }, [activeTab]);

  /* Change the route and push a history entry (skips no-op navigations). */
  const navigate = useCallback((tab: TabId, project: string | null) => {
    const url = routeUrl(tab, project);
    const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (url === current) return;
    window.history.pushState(null, "", url);
    setRoute({ tab, project });
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandPaletteOpen((open) => !open);
      } else if (event.key === "Escape" && graphFocusMode && !commandPaletteOpen) {
        event.preventDefault();
        setFocusMode(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [commandPaletteOpen, graphFocusMode]);

  const commands = useMemo<CommandAction[]>(
    () => [
      {
        id: "open-projects",
        label: "Open Projects",
        keywords: ["stats", "repositories"],
        run: () => navigate("stats", null),
      },
      ...(selectedProject
        ? [
            {
              id: "open-graph",
              label: "Open Graph",
              keywords: ["project", "observatory", selectedProject],
              run: () => navigate("graph", selectedProject),
            },
          ]
        : []),
      {
        id: "open-control",
        label: "Open Control",
        keywords: ["processes", "system"],
        run: () => navigate("control", selectedProject),
      },
      ...(activeTab === "graph" && selectedProject
        ? [
            {
              id: "toggle-focus-mode",
              label: graphFocusMode ? "Exit Focus Mode" : "Enter Focus Mode",
              keywords: ["focus", "zen", "fullscreen", "distraction"],
              run: () => setFocusMode((enabled) => !enabled),
            },
          ]
        : []),
      ...THEMES.map((definition) => ({
        id: `theme-${definition.id}`,
        label: `Apply ${definition.name} Theme`,
        keywords: ["theme", "appearance", definition.id],
        run: () => changeTheme(definition.id),
      })),
    ],
    [activeTab, changeTheme, graphFocusMode, navigate, selectedProject],
  );

  const tabs: { id: TabId; label: string }[] = [
    { id: "graph", label: t.tabs.graph },
    { id: "stats", label: t.tabs.projects },
    { id: "control", label: t.tabs.control },
  ];

  return (
    <div className="h-screen flex flex-col bg-background text-foreground">
      {/* Header */}
      {!graphFocusMode && (
        <header className="relative z-50 flex items-center justify-between px-5 h-12 border-b border-border bg-sidebar/80 backdrop-blur-md shrink-0">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2.5">
            <BrandMark className="h-5 w-5 shrink-0" />
            <div className="flex items-baseline gap-2">
              <span className="text-[13px] font-semibold text-foreground/90 tracking-tight">
                Jynx Observatory
              </span>
              <span className="hidden text-[8px] font-semibold uppercase tracking-[0.2em] text-primary/70 lg:inline">
                Jynx edition
              </span>
            </div>
          </div>

          {/* Tabs inline in header */}
          <nav className="flex items-center gap-0.5">
            {tabs.map((tab) => {
              const disabled = tab.id === "graph" && !selectedProject;
              return (
                <button
                  key={tab.id}
                  onClick={() => navigate(tab.id, tab.id === "stats" ? null : selectedProject)}
                  disabled={disabled}
                  title={disabled ? "Select a project first" : undefined}
                  className={`px-3 py-1 rounded-md text-[12px] font-medium transition-all ${
                    disabled
                      ? "text-muted-foreground/30 cursor-not-allowed"
                      : activeTab === tab.id
                        ? "bg-primary/15 text-primary"
                        : "text-muted-foreground hover:text-foreground hover:bg-white/[0.04]"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          {selectedProject && (
            <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-foreground/[0.04] border border-border/30">
              <span className="text-[10px] text-foreground/30 uppercase tracking-wider">
                {t.graph.selectedLabel}
              </span>
              <span className="text-[11px] text-primary font-mono truncate max-w-[300px]">
                {selectedProject}
              </span>
              <button
                onClick={() => navigate("stats", null)}
                className="text-foreground/20 hover:text-foreground/50 text-[12px] ml-1 transition-colors"
              >
                ×
              </button>
            </div>
          )}
          <button
            type="button"
            aria-label="Open command palette"
            aria-keyshortcuts="Meta+K Control+K"
            onClick={(event) => {
              event.currentTarget.focus();
              setCommandPaletteOpen(true);
            }}
            className="hidden h-8 items-center gap-2 rounded-md border border-border/60 bg-card/55 px-2.5 text-[11px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:flex"
          >
            <span>Commands</span>
            <kbd className="rounded border border-border/70 bg-background/70 px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground">
              ⌘K
            </kbd>
          </button>
          <ThemeSelector value={theme} onChange={changeTheme} />
        </div>
        </header>
      )}

      {/* Content */}
      <main className="flex-1 min-h-0">
        {activeTab === "graph" ? (
          <GraphTab project={selectedProject} focusMode={graphFocusMode} />
        ) : activeTab === "control" ? (
          <ControlTab />
        ) : (
          <StatsTab
            onSelectProject={(p) => navigate("graph", p)}
          />
        )}
      </main>
      {graphFocusMode && (
        <button
          ref={exitFocusButtonRef}
          type="button"
          aria-label="Exit Focus Mode"
          onClick={() => setFocusMode(false)}
          className="fixed right-3 top-3 z-50 rounded-md border border-border/60 bg-card/75 px-2.5 py-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground opacity-55 backdrop-blur-md transition-all hover:border-primary/45 hover:text-foreground hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Exit focus <kbd className="ml-1 font-mono normal-case">Esc</kbd>
        </button>
      )}
      <CommandPalette
        open={commandPaletteOpen}
        actions={commands}
        onOpenChange={setCommandPaletteOpen}
        fallbackFocusRef={exitFocusButtonRef}
      />
    </div>
  );
}
