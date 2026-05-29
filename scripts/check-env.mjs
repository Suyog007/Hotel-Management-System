#!/usr/bin/env node
// Diagnose env configuration. Run with: npm run check
// No dependencies — parses .env files itself.

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = process.cwd();

function loadEnvFile(filename) {
  const path = resolve(ROOT, filename);
  if (!existsSync(path)) return false;
  const content = readFileSync(path, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
  return true;
}

const envFiles = [".env", ".env.local", ".env.development", ".env.development.local"];
const loaded = envFiles.filter(loadEnvFile);

const c = {
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
};

function mask(v) {
  if (!v) return c.dim("(not set)");
  if (v.length <= 8) return v;
  return `${v.slice(0, 4)}…${v.slice(-4)} ${c.dim(`(${v.length} chars)`)}`;
}

function row(label, value, status) {
  const marker =
    status === "ok"
      ? c.green("✓")
      : status === "warn"
        ? c.yellow("!")
        : status === "bad"
          ? c.red("✗")
          : " ";
  console.log(`  ${marker} ${label.padEnd(32)} ${value}`);
}

console.log(`\n${c.bold("=== Env files ===")}`);
if (loaded.length) {
  for (const f of loaded) console.log(`  ${c.green("✓")} ${f}`);
} else {
  console.log(`  ${c.red("✗")} No .env files found.`);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
const gmailUser = process.env.GMAIL_USER;
const gmailPass = process.env.GMAIL_APP_PASSWORD;
const session = process.env.SESSION_COOKIE_SECRET;
const cronSecret = process.env.CRON_SECRET;
const googleKey = process.env.GOOGLE_PLACES_API_KEY;

console.log(`\n${c.bold("=== Required ===")}`);
row("NEXT_PUBLIC_SUPABASE_URL", url || c.dim("(not set)"), url ? "ok" : "bad");
row("NEXT_PUBLIC_SUPABASE_ANON_KEY", mask(anon), anon ? "ok" : "bad");
row("SUPABASE_SERVICE_ROLE_KEY", mask(service), service ? "ok" : "bad");
row(
  "SESSION_COOKIE_SECRET",
  session ? c.dim(`(${session.length} chars)`) : c.dim("(not set)"),
  session && session.length >= 16 ? "ok" : "bad",
);

console.log(`\n${c.bold("=== Optional (features unlock when set) ===")}`);
row("GMAIL_USER", gmailUser || c.dim("(not set)"), gmailUser ? "ok" : "warn");
row("GMAIL_APP_PASSWORD", mask(gmailPass), gmailPass ? "ok" : "warn");
row("CRON_SECRET", mask(cronSecret), cronSecret ? "ok" : " ");
row("GOOGLE_PLACES_API_KEY", mask(googleKey), googleKey ? "ok" : " ");

const missingRequired =
  !url || !anon || !service || !session || session.length < 16;

if (missingRequired) {
  console.log(
    `\n${c.red("✗")} Required env vars are missing. The dev server will throw at boot.`,
  );
  console.log(
    `  Fill the ${c.bold("Required")} keys above in ${c.bold(".env")} or ${c.bold(".env.local")} and re-run.`,
  );
  process.exit(1);
}

console.log(`\n${c.bold("=== Supabase connectivity ===")}`);

try {
  new URL(url);
  row("URL parses", url, "ok");
} catch {
  row("URL parses", c.red(url), "bad");
  process.exit(1);
}

try {
  const res = await fetch(`${url}/auth/v1/settings`, {
    headers: { apikey: anon },
  });
  const data = await res.json().catch(() => null);
  if (res.ok) {
    row("GET /auth/v1/settings", `HTTP ${res.status}`, "ok");
    if (data) {
      console.log(
        `     ${c.dim(`mailer_autoconfirm: ${data.mailer_autoconfirm}, email_enabled: ${data.external_email_enabled ?? data.email_enabled}`)}`,
      );
    }
  } else {
    row("GET /auth/v1/settings", `HTTP ${res.status}`, "bad");
    console.log(`     ${c.red("Anon key may be wrong or project is paused.")}`);
  }
} catch (err) {
  row("Reach Supabase", err.message, "bad");
}

try {
  const res = await fetch(`${url}/rest/v1/site_settings?select=hotel_name`, {
    headers: { apikey: anon, Authorization: `Bearer ${anon}` },
  });
  const text = await res.text();
  if (res.ok) {
    row("Read site_settings (anon)", `HTTP ${res.status}`, "ok");
    try {
      const rows = JSON.parse(text);
      if (Array.isArray(rows) && rows.length > 0) {
        console.log(`     ${c.dim(`hotel_name: ${rows[0].hotel_name}`)}`);
      } else if (Array.isArray(rows)) {
        console.log(
          `     ${c.yellow("Table is empty — did you run the 0003 seed migration?")}`,
        );
      }
    } catch {}
  } else {
    row("Read site_settings (anon)", `HTTP ${res.status}`, "bad");
    console.log(`     ${c.red(text.slice(0, 200))}`);
    console.log(
      `     ${c.yellow("Did you apply the SQL migrations 0001–0007 in the Supabase dashboard?")}`,
    );
  }
} catch (err) {
  row("Read site_settings", err.message, "bad");
}

try {
  const res = await fetch(`${url}/auth/v1/admin/users?per_page=1`, {
    headers: {
      apikey: service,
      Authorization: `Bearer ${service}`,
    },
  });
  if (res.ok) {
    const data = await res.json().catch(() => ({}));
    const count = data.users?.length ?? 0;
    row(
      "Admin API (service role)",
      `HTTP ${res.status}, ${data.total ?? count} user(s)`,
      "ok",
    );
    if ((data.total ?? count) === 0) {
      console.log(
        `     ${c.yellow("No Supabase Auth users yet. /login uses shouldCreateUser:false,")}`,
      );
      console.log(
        `     ${c.yellow("so a user MUST exist before you can sign in. Create one at")}`,
      );
      console.log(
        `     ${c.yellow("Dashboard → Authentication → Users. (Booking flow auto-creates.)")}`,
      );
    }
  } else {
    row("Admin API (service role)", `HTTP ${res.status}`, "bad");
    console.log(`     ${c.red("Service role key may be wrong.")}`);
  }
} catch (err) {
  row("Admin API", err.message, "bad");
}

console.log(`\n${c.bold("=== Email-template check (manual) ===")}`);
console.log(`  Open Supabase Dashboard → Authentication → Email Templates → Magic Link.`);
console.log(`  The body MUST contain ${c.bold("{{ .Token }}")} so users see a 6-digit code.`);
console.log(`  If it still has ${c.bold("{{ .ConfirmationURL }}")}, users get a magic link instead.`);
console.log(`  ${c.dim("(This script can't read template content via the public API.)")}`);

console.log(`\n${c.bold("=== If OTPs still don't arrive ===")}`);
console.log(`  1. ${c.yellow("Email landed in spam")} — check your spam folder.`);
console.log(`  2. ${c.yellow("Supabase default SMTP is rate-limited to ~3-4/hr")} — configure custom SMTP (Gmail or otherwise) in Project Settings → Auth.`);
console.log(`  3. ${c.yellow("Auth Magic Link template still uses {{ .ConfirmationURL }}")} — swap it for {{ .Token }}.`);
console.log(`  4. ${c.yellow("User doesn't exist in auth.users")} (only matters for /login, not booking) — create the user first.`);
console.log("");
