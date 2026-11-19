const base = { width: 22, height: 22, fill: "none", stroke: "currentColor", strokeWidth: 1.3, "aria-hidden": true } as const;

export const BagIcon = () => (
  <svg viewBox="0 0 24 24" {...base}>
    <path d="M5 8h14l-1 12H6L5 8Z" />
    <path d="M9 8V6.5a3 3 0 0 1 6 0V8" />
  </svg>
);
export const MenuIcon = () => (
  <svg viewBox="0 0 24 24" {...base}>
    <path d="M3 8h18M3 16h18" />
  </svg>
);
export const CloseIcon = () => (
  <svg viewBox="0 0 24 24" {...base}>
    <path d="M5 5l14 14M19 5 5 19" />
  </svg>
);
export const CopyIcon = () => (
  <svg viewBox="0 0 24 24" {...base} width={18} height={18}>
    <rect x="8" y="8" width="12" height="12" />
    <path d="M16 8V4H4v12h4" />
  </svg>
);
export const UserIcon = () => (
  <svg viewBox="0 0 24 24" {...base}>
    <circle cx="12" cy="8.5" r="3.6" />
    <path d="M4.8 20c.9-3.6 3.8-5.6 7.2-5.6s6.3 2 7.2 5.6" />
  </svg>
);
