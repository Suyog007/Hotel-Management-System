/**
 * Hand-drawn landmark icons in lucide's visual language (24×24 grid,
 * stroke-only, round caps) — lucide has no Nepali pagoda or stupa, and the
 * generic Landmark columns read as a Greek bank. Prop-compatible with lucide
 * icons so they can be swapped into the same `icon:` slots.
 */

type IconProps = {
  className?: string;
  strokeWidth?: number;
};

/** Two-tiered Nepali pagoda (Pashupatinath). */
export function TempleIcon({ className, strokeWidth = 2 }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M12 2v2.5" />
      <path d="M6.5 9.5 12 4.5l5.5 5h-11Z" />
      <path d="M9 9.5V13" />
      <path d="M15 9.5V13" />
      <path d="m3.5 15.5 4.5-2.5h8l4.5 2.5h-17Z" />
      <path d="M6 15.5v5" />
      <path d="M18 15.5v5" />
      <path d="M4 20.5h16" />
      <path d="M10.5 20.5V17a1.5 1.5 0 0 1 3 0v3.5" />
    </svg>
  );
}

/** Stupa silhouette — dome, harmika, stepped spire (Boudhanath). */
export function StupaIcon({ className, strokeWidth = 2 }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M12 2v1.5" />
      <path d="M9.5 8 12 3.5 14.5 8" />
      <path d="M9.5 8h5v2.5h-5V8Z" />
      <path d="M4.5 16a7.5 7.5 0 0 1 15 0" />
      <path d="M3 16h18" />
      <path d="M5 16v3.5" />
      <path d="M19 16v3.5" />
      <path d="M3.5 19.5h17" />
    </svg>
  );
}
