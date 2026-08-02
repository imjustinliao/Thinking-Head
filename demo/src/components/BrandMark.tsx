/**
 * Thinking TF mark. An open block with a solid core sitting past its edge —
 * "beyond the transformer". Original geometry; it must stay legible at 20px,
 * so it is two shapes and nothing else.
 */
export function BrandMark({ className, size = 24 }: { className?: string; size?: number }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      focusable="false"
      height={size}
      viewBox="0 0 24 24"
      width={size}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M14.5 4.9H6.2A2.3 2.3 0 0 0 3.9 7.2v9.6a2.3 2.3 0 0 0 2.3 2.3h8.3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <circle cx="17.4" cy="12" fill="currentColor" r="3.2" />
    </svg>
  );
}
