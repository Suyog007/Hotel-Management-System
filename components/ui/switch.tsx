import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Lightweight switch built on a native checkbox to avoid pulling in
 * @radix-ui/react-switch this early. Visually styled like shadcn's Switch.
 */
export interface SwitchProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {}

export const Switch = React.forwardRef<HTMLInputElement, SwitchProps>(
  ({ className, ...props }, ref) => (
    <label className={cn("relative inline-flex h-6 w-11 cursor-pointer items-center", className)}>
      <input ref={ref} type="checkbox" className="peer sr-only" {...props} />
      <span className="absolute inset-0 rounded-full bg-input transition-colors peer-checked:bg-primary peer-disabled:opacity-50" />
      <span className="relative ml-0.5 h-5 w-5 rounded-full bg-background shadow transition-transform peer-checked:translate-x-5" />
    </label>
  ),
);
Switch.displayName = "Switch";
