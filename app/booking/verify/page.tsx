import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { ShieldCheck } from "lucide-react";
import { createServerClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { verify as verifySignedCookie } from "@/lib/signed-cookie";
import { bookingIntentSchema, type BookingIntent } from "@/lib/validation/rooms";
import { resendBookingOtp, verifyAndCreateBooking } from "./actions";

const INTENT_COOKIE = "booking_intent";

export default async function BookingVerifyPage(props: {
  searchParams: Promise<{ email?: string; error?: string; resent?: string }>;
}) {
  const sp = await props.searchParams;

  const cookieStore = await cookies();
  const intent = verifySignedCookie<BookingIntent>(cookieStore.get(INTENT_COOKIE)?.value);
  const parsed = intent ? bookingIntentSchema.safeParse(intent) : null;
  if (!parsed?.success || parsed.data.expires_at < Date.now()) {
    redirect(`/rooms?error=${encodeURIComponent("Booking session expired — please try again.")}`);
  }
  const email = parsed.data.guest_email;

  const supabase = await createServerClient();
  const { data: settings } = await supabase
    .from("site_settings")
    .select("hotel_name")
    .single();
  const hotel = (settings?.hotel_name as string) ?? "Welcome";

  return (
    <main id="main" className="grid min-h-screen grid-cols-1 lg:grid-cols-2">
      <aside className="relative hidden overflow-hidden bg-primary text-primary-foreground lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-accent/30 blur-3xl" />
        <div className="absolute -bottom-32 -left-32 h-96 w-96 rounded-full bg-accent/20 blur-3xl" />

        <Link href="/" className="relative flex items-center gap-2">
          <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-full bg-accent" />
          <span className="font-display text-lg font-semibold">{hotel}</span>
        </Link>

        <div className="relative max-w-md">
          <p className="mb-4 text-xs font-medium uppercase tracking-wider text-primary-foreground/70">
            Almost booked
          </p>
          <h1 className="font-display text-display-lg font-semibold leading-tight">
            Confirm your email.
          </h1>
          <p className="mt-4 text-primary-foreground/80">
            We sent a 6-digit code to confirm the reservation. No account needed —
            the code is just to make sure the email is yours.
          </p>
        </div>

        <p className="relative text-xs text-primary-foreground/60">
          © {new Date().getFullYear()} {hotel}.
        </p>
      </aside>

      <section className="flex items-center justify-center px-6 py-12 lg:px-12">
        <div className="w-full max-w-sm">
          <div className="lg:hidden">
            <Link href="/" className="flex items-center gap-2">
              <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-full bg-accent" />
              <span className="font-display text-lg font-semibold">{hotel}</span>
            </Link>
          </div>

          <div className="mb-3 mt-6 inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs font-medium uppercase tracking-wider text-accent">
            <ShieldCheck className="h-3 w-3" />
            Confirm booking
          </div>
          <h2 className="font-display text-3xl font-semibold tracking-tight">
            Enter the code we emailed
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            We sent a 6-digit code to <strong>{email}</strong>. It expires in 15 minutes.
          </p>

          <form action={verifyAndCreateBooking} className="mt-8 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="token">Code</Label>
              <Input
                id="token"
                name="token"
                inputMode="numeric"
                pattern="\d{6}"
                maxLength={6}
                autoComplete="one-time-code"
                required
                placeholder="123456"
                className="text-center font-mono text-lg tracking-[0.4em]"
              />
            </div>
            {sp.error && (
              <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {sp.error}
              </p>
            )}
            {sp.resent === "1" && !sp.error && (
              <p className="rounded-md border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">
                A fresh code is on its way. Check your inbox.
              </p>
            )}
            <Button type="submit" size="lg" className="w-full">
              Confirm booking
            </Button>
          </form>

          <form action={resendBookingOtp} className="mt-4">
            <button
              type="submit"
              className="block w-full text-center text-xs text-muted-foreground underline hover:text-foreground"
            >
              Didn&apos;t get the code? Resend
            </button>
          </form>

          <p className="mt-2 text-center text-xs text-muted-foreground">
            <Link href="/rooms" className="underline">
              Pick a different room
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
