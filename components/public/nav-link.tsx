"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";
import { cn } from "@/lib/utils";

export function NavLink({
  href,
  children,
  variant = "sidebar",
  className,
  exact = false,
}: {
  href: string;
  children: React.ReactNode;
  variant?: "sidebar" | "public";
  className?: string;
  exact?: boolean;
}) {
  const pathname = usePathname();
  const active = exact
    ? pathname === href
    : pathname === href || (href !== "/" && pathname?.startsWith(href + "/"));

  if (variant === "public") {
    return (
      <Link
        href={href}
        className={cn(
          "rounded-md px-3 py-2 text-sm font-medium transition-colors",
          active
            ? "text-foreground"
            : "text-muted-foreground hover:text-foreground",
          className,
        )}
      >
        {children}
        {active && (
          <span aria-hidden className="ml-2 inline-block h-1 w-1 rounded-full bg-accent align-middle" />
        )}
      </Link>
    );
  }

  return (
    <Link
      href={href}
      className={cn(
        "group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-all",
        active
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
        className,
      )}
    >
      {children}
    </Link>
  );
}
