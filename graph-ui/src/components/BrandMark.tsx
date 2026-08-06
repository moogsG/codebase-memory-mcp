import type { SVGProps } from "react";

interface BrandMarkProps extends Omit<SVGProps<SVGSVGElement>, "aria-label"> {
  label?: string;
  animated?: boolean;
}

/**
 * Jynx Observatory's orbital-J sigil: a broken observation orbit, three graph
 * nodes, and a cyan interference cut. It inherits the active runtime theme.
 */
export function BrandMark({ label, animated = false, className = "", ...props }: BrandMarkProps) {
  const accessible = Boolean(label);
  return (
    <svg
      viewBox="0 0 32 32"
      role={accessible ? "img" : undefined}
      aria-label={label}
      aria-hidden={accessible ? undefined : true}
      className={`jynx-brand-mark ${animated ? "jynx-brand-mark--animated" : ""} ${className}`.trim()}
      {...props}
    >
      <path
        className="jynx-brand-orbit"
        d="M7.2 21.8A11.2 11.2 0 1 1 24.7 23"
        fill="none"
        strokeWidth="1.65"
        strokeLinecap="round"
      />
      <path
        className="jynx-brand-j"
        d="M19.2 7.4v11.1c0 4.6-2.4 7-6.2 7-2.35 0-4.15-.88-5.25-2.55"
        fill="none"
        strokeWidth="2.45"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        className="jynx-brand-cut"
        d="M7.8 18.8 24.5 13.2"
        fill="none"
        strokeWidth="1.15"
        strokeLinecap="round"
      />
      <circle className="jynx-brand-node jynx-brand-node--primary" cx="24.6" cy="8.4" r="2.25" />
      <circle className="jynx-brand-node jynx-brand-node--accent" cx="25.2" cy="22.9" r="1.75" />
      <circle className="jynx-brand-node jynx-brand-node--ring" cx="7.4" cy="21.6" r="1.45" />
    </svg>
  );
}
