import Link from "next/link";

export default function NotFound() {
  return (
    <main className="container mx-auto flex min-h-screen flex-col items-center justify-center gap-4 py-16 text-center">
      <h1 className="text-4xl font-bold">404</h1>
      <p className="text-muted-foreground">This page could not be found.</p>
      <Link href="/" className="underline">
        Back to home
      </Link>
    </main>
  );
}
