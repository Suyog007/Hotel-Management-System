import Link from "next/link";
import { redirect } from "next/navigation";
import { Mail } from "lucide-react";
import { createServerClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requestOtp } from "./actions";

export default async function LoginPage(props: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const sp = await props.searchParams;

  const supabase = await createServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (auth.user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("auth_user_id", auth.user.id)
      .single();
    const role = (profile?.role as string | undefined) ?? "guest";
    if (sp.next) redirect(sp.next);
    if (role === "super_admin") redirect("/admin");
    if (role === "manager" || role === "receptionist") redirect("/dashboard");
    redirect("/");
  }

  const { data: settings } = await supabase
    .from("site_settings")
    .select("hotel_name, tagline")
    .single();
  const hotel = (settings?.hotel_name as string) ?? "Welcome";
  const tagline = (settings?.tagline as string) ?? "Boutique hospitality, made simple.";

  return (
    <main id="main" className="grid min-h-screen grid-cols-1 lg:grid-cols-2">
      {/* Left side — hero */}
      <aside className="relative hidden overflow-hidden bg-primary text-primary-foreground lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-accent/30 blur-3xl" />
        <div className="absolute -bottom-32 -left-32 h-96 w-96 rounded-full bg-accent/20 blur-3xl" />

        <Link href="/" className="relative flex items-center gap-2">
          <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-full bg-accent" />
          <span className="font-display text-lg font-semibold">{hotel}</span>
        </Link>

        <div className="relative max-w-md">
          <p className="mb-4 text-xs font-medium uppercase tracking-wider text-primary-foreground/70">
            Sign in
          </p>
          <h1 className="font-display text-display-lg font-semibold leading-tight">
            {tagline}
          </h1>
          <p className="mt-4 text-primary-foreground/80">
            Verify with an email code — no passwords, no fuss.
          </p>
        </div>

        <p className="relative text-xs text-primary-foreground/60">
          © {new Date().getFullYear()} {hotel}.
        </p>
      </aside>

      {/* Right side — form */}
      <section className="flex items-center justify-center px-6 py-12 lg:px-12">
        <div className="w-full max-w-sm">
          <div className="lg:hidden">
            <Link href="/" className="flex items-center gap-2">
              <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-full bg-accent" />
              <span className="font-display text-lg font-semibold">{hotel}</span>
            </Link>
          </div>

          <div className="mb-3 mt-6 inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs font-medium uppercase tracking-wider text-accent">
            <Mail className="h-3 w-3" />
            Email OTP
          </div>
          <h2 className="font-display text-3xl font-semibold tracking-tight">Sign in</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Enter your email and we&apos;ll send a 6-digit code.
          </p>

          <form action={requestOtp} className="mt-8 space-y-4">
            {sp.next && <input type="hidden" name="next" value={sp.next} />}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="you@example.com"
              />
            </div>
            {sp.error && (
              <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {sp.error}
              </p>
            )}
            <Button type="submit" size="lg" className="w-full">
              Send verification code
            </Button>
          </form>

          <p className="mt-8 text-center text-xs text-muted-foreground">
            New here?{" "}
            <Link href="/rooms" className="font-medium text-foreground underline">
              Book a room
            </Link>{" "}
            and we&apos;ll send you a code at checkout.
          </p>
        </div>
      </section>
    </main>
  );
}
