// Minimal in-memory fake of the Supabase JS query builder, shared across
// server-action tests. Supports exactly the chain shapes this codebase uses
// (eq/neq/ilike/in/lt/lte/gt/gte/is/order/limit + insert/update/delete +
// single/maybeSingle + bare await). Not a general Postgrest reimplementation.
type Row = Record<string, unknown>;
type Tables = Record<string, Row[]>;
type Op = "eq" | "neq" | "ilike" | "in" | "lt" | "lte" | "gt" | "gte" | "is";
type Filter = { col: string; op: Op; val: unknown };

let seq = 0;
function fakeId() {
  seq += 1;
  return `00000000-0000-0000-0000-${String(seq).padStart(12, "0")}`;
}

function matches(row: Row, filters: Filter[]): boolean {
  return filters.every(({ col, op, val }) => {
    const rowVal = row[col];
    switch (op) {
      case "eq":
        return rowVal === val;
      case "neq":
        return rowVal !== val;
      case "ilike":
        return String(rowVal ?? "").toLowerCase() === String(val).toLowerCase();
      case "in":
        return (val as unknown[]).includes(rowVal);
      case "lt":
        return rowVal !== undefined && rowVal !== null && (rowVal as string | number) < (val as string | number);
      case "lte":
        return rowVal !== undefined && rowVal !== null && (rowVal as string | number) <= (val as string | number);
      case "gt":
        return rowVal !== undefined && rowVal !== null && (rowVal as string | number) > (val as string | number);
      case "gte":
        return rowVal !== undefined && rowVal !== null && (rowVal as string | number) >= (val as string | number);
      case "is":
        return val === null ? rowVal === null || rowVal === undefined : rowVal === val;
      default:
        return true;
    }
  });
}

export type FakeUser = { id: string; email?: string } | null;

export type FakeSupabase = ReturnType<typeof createFakeSupabase>;

export function createFakeSupabase(
  tables: Tables,
  opts: {
    user?: FakeUser;
    onInviteUser?: (email: string) => { error: { message: string } | null };
  } = {},
) {
  function builder(table: string) {
    const filters: Filter[] = [];
    let mode: "select" | "insert" | "update" | "delete" = "select";
    let payload: Row | Row[] | null = null;

    const rows = () => tables[table] ?? (tables[table] = []);

    const clone = (r: Row): Row => JSON.parse(JSON.stringify(r));

    async function resolveMany(): Promise<{ data: Row[]; error: { message: string } | null; count: number }> {
      if (mode === "insert") {
        const list = (Array.isArray(payload) ? payload : [payload]) as Row[];
        const inserted = list.map((r) => ({ id: fakeId(), created_at: new Date(0).toISOString(), ...r }));
        rows().push(...inserted);
        return { data: inserted.map(clone), error: null, count: inserted.length };
      }
      if (mode === "update") {
        const matched = rows().filter((r) => matches(r, filters));
        matched.forEach((r) => Object.assign(r, payload));
        return { data: matched.map(clone), error: null, count: matched.length };
      }
      if (mode === "delete") {
        const matched = rows().filter((r) => matches(r, filters));
        tables[table] = rows().filter((r) => !matches(r, filters));
        return { data: matched.map(clone), error: null, count: matched.length };
      }
      const matched = rows().filter((r) => matches(r, filters));
      return { data: matched.map(clone), error: null, count: matched.length };
    }

    async function resolveSingle(maybe: boolean) {
      const { data, error } = await resolveMany();
      if (error) return { data: null, error };
      if (data.length === 0) return { data: null, error: maybe ? null : { message: `no rows in ${table}` } };
      if (data.length > 1 && !maybe) return { data: null, error: { message: `multiple rows in ${table}` } };
      return { data: data[0], error: null };
    }

    const api = {
      select() {
        return api;
      },
      eq(col: string, val: unknown) {
        filters.push({ col, op: "eq", val });
        return api;
      },
      neq(col: string, val: unknown) {
        filters.push({ col, op: "neq", val });
        return api;
      },
      ilike(col: string, val: unknown) {
        filters.push({ col, op: "ilike", val });
        return api;
      },
      in(col: string, val: unknown[]) {
        filters.push({ col, op: "in", val });
        return api;
      },
      lt(col: string, val: unknown) {
        filters.push({ col, op: "lt", val });
        return api;
      },
      lte(col: string, val: unknown) {
        filters.push({ col, op: "lte", val });
        return api;
      },
      gt(col: string, val: unknown) {
        filters.push({ col, op: "gt", val });
        return api;
      },
      gte(col: string, val: unknown) {
        filters.push({ col, op: "gte", val });
        return api;
      },
      is(col: string, val: unknown) {
        filters.push({ col, op: "is", val });
        return api;
      },
      order() {
        return api;
      },
      limit() {
        return api;
      },
      insert(p: Row | Row[]) {
        mode = "insert";
        payload = p;
        return api;
      },
      update(p: Row) {
        mode = "update";
        payload = p;
        return api;
      },
      delete() {
        mode = "delete";
        return api;
      },
      single() {
        return resolveSingle(false);
      },
      maybeSingle() {
        return resolveSingle(true);
      },
      then(resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) {
        return resolveMany().then(resolve, reject);
      },
    };
    return api;
  }

  return {
    from: (table: string) => builder(table),
    auth: {
      getUser: async () => ({ data: { user: opts.user ?? null } }),
      admin: {
        inviteUserByEmail: async (email: string) =>
          opts.onInviteUser?.(email) ?? { data: {}, error: null },
      },
    },
    __tables: tables,
  };
}
