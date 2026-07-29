"use client";

import * as React from "react";
import { ChevronRight, Search, X } from "lucide-react";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type ManageListItem = {
  id: string;
  /** Primary line — what you scan for. */
  title: string;
  subtitle?: string | null;
  /** Right-aligned secondary fact: price, order, room count… */
  meta?: string | null;
  /** Optional bucket. When present, rows are grouped under collapsible headers. */
  group?: string | null;
  badge?: { label: string; variant?: BadgeProps["variant"] } | null;
  thumbnail?: string | null;
  /** Extra text folded into the search haystack (description, slug…). */
  search?: string | null;
  /** The edit form. Only mounted while the row is open. */
  children: React.ReactNode;
};

const ALL = "__all__";

type Persisted = {
  q?: string;
  group?: string;
  openId?: string | null;
  closedGroups?: string[];
};

/**
 * Compact, searchable record list where each row expands to its edit form.
 *
 * Replaces the "render every record as a full, always-open form stacked down
 * the page" pattern — which put 165 menu items × ~8 fields on one screen. Here
 * the page opens as one scannable line per record; exactly one form is open (and
 * mounted) at a time.
 *
 * Search / group filter / open row survive the save→redirect round trip via
 * sessionStorage, so editing item 90 of 165 doesn't bounce you back to the top.
 */
export function ManageList({
  items,
  storageKey,
  noun = "items",
  searchPlaceholder = "Search…",
  groupAllLabel = "All groups",
  emptyLabel = "Nothing here yet.",
  defaultGroupsOpen,
}: {
  items: ManageListItem[];
  /** Unique per page — namespaces the persisted search/open state. */
  storageKey: string;
  noun?: string;
  searchPlaceholder?: string;
  groupAllLabel?: string;
  emptyLabel?: string;
  defaultGroupsOpen?: boolean;
}) {
  const [query, setQuery] = React.useState("");
  const [group, setGroup] = React.useState<string>(ALL);
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [closedGroups, setClosedGroups] = React.useState<Record<string, boolean>>({});
  const hydrated = React.useRef(false);

  const groups = React.useMemo(() => {
    const seen: string[] = [];
    for (const i of items) {
      if (i.group && !seen.includes(i.group)) seen.push(i.group);
    }
    return seen;
  }, [items]);

  // Many groups (a food menu has a dozen) start collapsed; a handful stay open.
  const groupsOpenByDefault = defaultGroupsOpen ?? groups.length <= 4;

  // Restore after mount so server and first client render match.
  React.useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem(`manage-list:${storageKey}`);
      if (raw) {
        const saved = JSON.parse(raw) as Persisted;
        if (saved.q) setQuery(saved.q);
        if (saved.group) setGroup(saved.group);
        if (saved.openId) setOpenId(saved.openId);
        if (saved.closedGroups?.length) {
          setClosedGroups(Object.fromEntries(saved.closedGroups.map((g) => [g, true])));
        }
      }
    } catch {
      // Private mode / disabled storage — filters just start empty.
    }
    hydrated.current = true;
  }, [storageKey]);

  React.useEffect(() => {
    if (!hydrated.current) return;
    const payload: Persisted = {
      q: query,
      group,
      openId,
      closedGroups: Object.keys(closedGroups).filter((g) => closedGroups[g]),
    };
    try {
      window.sessionStorage.setItem(`manage-list:${storageKey}`, JSON.stringify(payload));
    } catch {
      // Non-fatal.
    }
  }, [storageKey, query, group, openId, closedGroups]);

  const q = query.trim().toLowerCase();
  const visible = React.useMemo(
    () =>
      items.filter((i) => {
        if (group !== ALL && (i.group ?? "") !== group) return false;
        if (!q) return true;
        return [i.title, i.subtitle, i.meta, i.group, i.search]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(q);
      }),
    [items, group, q],
  );

  // A search should surface matches wherever they live, so it overrides
  // whatever groups the user had collapsed.
  const isGroupOpen = (g: string) => (q ? true : !(closedGroups[g] ?? !groupsOpenByDefault));

  const toggleGroup = (g: string) =>
    setClosedGroups((prev) => ({ ...prev, [g]: !(prev[g] ?? !groupsOpenByDefault) }));

  const setAllGroups = (open: boolean) =>
    setClosedGroups(Object.fromEntries(groups.map((g) => [g, !open])));

  const anyGroupOpen = groups.some((g) => isGroupOpen(g));

  const visibleGroups = groups.filter((g) => visible.some((i) => i.group === g));
  const ungrouped = visible.filter((i) => !i.group);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search
            aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            className="h-10 w-full rounded-md border border-input bg-card pl-9 pr-9 text-sm shadow-sm transition-colors placeholder:text-muted-foreground/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background hover:border-foreground/30 [&::-webkit-search-cancel-button]:hidden"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {groups.length > 1 && (
          <select
            value={group}
            onChange={(e) => setGroup(e.target.value)}
            aria-label={groupAllLabel}
            className="h-10 rounded-md border border-input bg-card px-3 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring hover:border-foreground/30"
          >
            <option value={ALL}>{groupAllLabel}</option>
            {groups.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        )}

        {groups.length > 1 && !q && (
          <button
            type="button"
            onClick={() => setAllGroups(!anyGroupOpen)}
            className="h-10 rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            {anyGroupOpen ? "Collapse all" : "Expand all"}
          </button>
        )}

        <span className="ml-auto shrink-0 text-xs tabular-nums text-muted-foreground">
          {visible.length === items.length
            ? `${items.length} ${noun}`
            : `${visible.length} of ${items.length} ${noun}`}
        </span>
      </div>

      {visible.length === 0 ? (
        <p className="rounded-[4px] border border-dashed border-foreground/15 px-4 py-8 text-center text-sm text-muted-foreground">
          {items.length === 0 ? emptyLabel : `No ${noun} match “${query}”.`}
        </p>
      ) : (
        <div className="space-y-2">
          {ungrouped.length > 0 && (
            <Rows items={ungrouped} openId={openId} setOpenId={setOpenId} />
          )}

          {visibleGroups.map((g) => {
            const rows = visible.filter((i) => i.group === g);
            const open = isGroupOpen(g);
            return (
              <div
                key={g}
                className="overflow-hidden rounded-[4px] border border-foreground/10 bg-card"
              >
                <button
                  type="button"
                  onClick={() => toggleGroup(g)}
                  aria-expanded={open}
                  className="flex w-full items-center gap-2 bg-muted/40 px-3 py-2 text-left transition-colors hover:bg-muted/70"
                >
                  <ChevronRight
                    aria-hidden
                    className={cn(
                      "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                      open && "rotate-90",
                    )}
                  />
                  <span className="text-sm font-semibold">{g}</span>
                  <span className="ml-auto text-xs tabular-nums text-muted-foreground">
                    {rows.length}
                  </span>
                </button>
                {open && (
                  <Rows items={rows} openId={openId} setOpenId={setOpenId} bare />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Rows({
  items,
  openId,
  setOpenId,
  bare = false,
}: {
  items: ManageListItem[];
  openId: string | null;
  setOpenId: (id: string | null) => void;
  /** Already inside a bordered group container. */
  bare?: boolean;
}) {
  return (
    <div
      className={cn(
        "divide-y divide-border/60",
        !bare && "overflow-hidden rounded-[4px] border border-foreground/10 bg-card",
        bare && "border-t border-border/60",
      )}
    >
      {items.map((item) => {
        const open = openId === item.id;
        return (
          <div key={item.id}>
            <button
              type="button"
              onClick={() => setOpenId(open ? null : item.id)}
              aria-expanded={open}
              className={cn(
                "flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted/50",
                open && "bg-muted/50",
              )}
            >
              <ChevronRight
                aria-hidden
                className={cn(
                  "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                  open && "rotate-90",
                )}
              />
              {item.thumbnail && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.thumbnail}
                  alt=""
                  className="h-9 w-12 shrink-0 rounded border object-cover"
                />
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{item.title}</span>
                {item.subtitle && (
                  <span className="block truncate text-xs text-muted-foreground">
                    {item.subtitle}
                  </span>
                )}
              </span>
              {item.badge && (
                <Badge variant={item.badge.variant} className="shrink-0">
                  {item.badge.label}
                </Badge>
              )}
              {item.meta && (
                <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
                  {item.meta}
                </span>
              )}
            </button>
            {open && (
              <div className="border-t border-border/60 bg-muted/20 px-4 py-4">
                {item.children}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
