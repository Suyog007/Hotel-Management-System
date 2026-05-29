import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium",
  {
    variants: {
      variant: {
        default: "border-border bg-muted text-foreground/80",
        success: "border-success/25 bg-success/12 text-success",
        warning: "border-warning/30 bg-warning/15 text-warning-foreground",
        danger: "border-danger/25 bg-danger/12 text-danger",
        info: "border-accent/30 bg-accent/12 text-accent-foreground",
        outline: "border-border bg-transparent text-muted-foreground",
        solid: "border-transparent bg-primary text-primary-foreground",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export type BadgeProps = React.HTMLAttributes<HTMLSpanElement> &
  VariantProps<typeof badgeVariants>;

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export type StatusVariant = NonNullable<BadgeProps["variant"]>;

/** Map a booking status enum value to a Badge variant + readable label. */
export function bookingStatusBadge(status: string): { variant: StatusVariant; label: string } {
  switch (status) {
    case "pending":
      return { variant: "warning", label: "Pending" };
    case "confirmed":
      return { variant: "info", label: "Confirmed" };
    case "checked_in":
      return { variant: "success", label: "Checked in" };
    case "checked_out":
      return { variant: "outline", label: "Checked out" };
    case "cancelled":
      return { variant: "danger", label: "Cancelled" };
    default:
      return { variant: "default", label: status };
  }
}

export function paymentStatusBadge(status: string): { variant: StatusVariant; label: string } {
  switch (status) {
    case "paid":
      return { variant: "success", label: "Paid" };
    case "unpaid":
      return { variant: "warning", label: "Unpaid" };
    case "refunded":
      return { variant: "outline", label: "Refunded" };
    case "partially_refunded":
      return { variant: "outline", label: "Partially refunded" };
    case "failed":
      return { variant: "danger", label: "Failed" };
    default:
      return { variant: "default", label: status };
  }
}

export function roomStatusBadge(status: string): { variant: StatusVariant; label: string } {
  switch (status) {
    case "available":
      return { variant: "success", label: "Available" };
    case "occupied":
      return { variant: "info", label: "Occupied" };
    case "cleaning":
      return { variant: "warning", label: "Cleaning" };
    case "maintenance":
      return { variant: "danger", label: "Maintenance" };
    default:
      return { variant: "default", label: status };
  }
}

export function requestStatusBadge(status: string): { variant: StatusVariant; label: string } {
  switch (status) {
    case "requested":
      return { variant: "warning", label: "Requested" };
    case "scheduled":
      return { variant: "info", label: "Scheduled" };
    case "in_progress":
      return { variant: "info", label: "In progress" };
    case "completed":
      return { variant: "success", label: "Completed" };
    case "cancelled":
      return { variant: "danger", label: "Cancelled" };
    default:
      return { variant: "default", label: status };
  }
}
