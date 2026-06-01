import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

// Posix-normalised absolute project root (Vite aliases use posix separators).
const root = fileURLToPath(new URL(".", import.meta.url))
  .replace(/\\/g, "/")
  .replace(/\/$/, "");

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      // Next's `server-only` guard throws outside an RSC bundler; stub it so
      // server modules (signed-cookie, availability, …) import cleanly in Node.
      { find: /^server-only$/, replacement: `${root}/test/stubs/server-only.ts` },
      // Mirror tsconfig's `@/*` -> project root path alias.
      { find: /^@\//, replacement: `${root}/` },
    ],
  },
  test: {
    environment: "node",
    globals: true,
    setupFiles: ["./test/setup.ts"],
    include: ["test/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["lib/**/*.ts", "components/ui/badge.tsx"],
      // Thin I/O wrappers (network/SMTP/cookies) are exercised via integration
      // tests, not unit tests — exclude from the unit coverage denominator.
      exclude: ["lib/supabase/**", "lib/email.ts", "lib/storage.ts", "lib/email-from-template.ts"],
    },
  },
});
