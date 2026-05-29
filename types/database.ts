/**
 * Placeholder Supabase types. Regenerate from the live schema with:
 *   npm run db:types
 * which runs:
 *   supabase gen types typescript --linked > types/supabase.ts
 *
 * Until that file exists this loose `Database` shape lets the app compile.
 * Replace the export below with `export type { Database } from "./supabase";`
 * once the real types are generated.
 */
export type Database = {
  public: {
    Tables: Record<string, { Row: Record<string, unknown>; Insert: Record<string, unknown>; Update: Record<string, unknown> }>;
    Views: Record<string, { Row: Record<string, unknown> }>;
    Functions: Record<string, unknown>;
    Enums: Record<string, string>;
  };
};
