import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: { DEFAULT: "1.25rem", lg: "2rem" },
      screens: { "2xl": "1180px" },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
        },
        danger: {
          DEFAULT: "hsl(var(--danger))",
          foreground: "hsl(var(--danger-foreground))",
        },
        /* Named design-system palette (raw hex) for direct use. */
        onyx: { DEFAULT: "#0D0D0D", soft: "#1C1C1C" },
        gold: { DEFAULT: "#D4AF37", light: "#E1C25A" },
        emerald: { DEFAULT: "#0B3D2E", light: "#12563F" },
        oxblood: { DEFAULT: "#7A1F2B", light: "#9A2C3A" },
        cream: "#F5F0E1",
        silver: "#A8A9AD",
      },
      borderRadius: {
        xl: "calc(var(--radius) + 4px)",
        lg: "var(--radius)",
        md: "calc(var(--radius) - 4px)",
        sm: "calc(var(--radius) - 6px)",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "Karla", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "Bricolage Grotesque", "sans-serif"],
        mono: ["var(--font-mono)", "Space Mono", "monospace"],
        accent: ["var(--font-accent)", "Fraunces", "Georgia", "serif"],
      },
      fontSize: {
        // Bricolage display scale, per design system.
        "display-xl": ["clamp(2.375rem, 6vw, 4.375rem)", { lineHeight: "1.02", letterSpacing: "-0.015em" }],
        "display-lg": ["clamp(1.75rem, 4vw, 2.625rem)", { lineHeight: "1.05", letterSpacing: "-0.015em" }],
        "display-md": ["1.4375rem", { lineHeight: "1.12", letterSpacing: "-0.015em" }],
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-in": "fade-in 250ms ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
