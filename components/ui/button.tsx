import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  // Architectural, barely-rounded (2px); Karla 600, no uppercase.
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[2px] text-sm font-semibold ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]",
  {
    variants: {
      variant: {
        // Onyx primary → lifts to a slightly softer black on hover.
        default:
          "bg-primary text-primary-foreground hover:bg-onyx-soft",
        // Sharp-gold accent — the metallic highlight, onyx text for contrast.
        accent:
          "bg-accent text-accent-foreground hover:bg-gold-light",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        // 1px onyx outline → inverts to solid onyx on hover.
        outline:
          "border border-foreground/70 bg-transparent text-foreground hover:bg-foreground hover:text-background",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/70",
        ghost: "hover:bg-muted hover:text-foreground",
        link: "text-accent underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 px-[22px] py-[11px]",
        sm: "h-9 px-4 text-[13px]",
        lg: "h-12 px-7 text-base",
        icon: "h-11 w-11",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  ),
);
Button.displayName = "Button";

export { buttonVariants };
