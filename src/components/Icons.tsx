import type { CategoryId } from "@/lib/catalog";

type P = { size?: number; className?: string; title?: string };
const base = (size = 22) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
});

export const IconSofa = ({ size, className }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M4 11V8a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v3" />
    <path d="M2.5 13a2 2 0 0 1 4 0v1h11v-1a2 2 0 0 1 4 0v4a1 1 0 0 1-1 1h-17a1 1 0 0 1-1-1z" />
    <path d="M5 18v2M19 18v2" />
  </svg>
);
export const IconArmchair = ({ size, className }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M6 11V7a3 3 0 0 1 3-3h6a3 3 0 0 1 3 3v4" />
    <path d="M4 13a2 2 0 0 1 4 0v1h8v-1a2 2 0 0 1 4 0v4a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z" />
    <path d="M6.5 18v2M17.5 18v2" />
  </svg>
);
export const IconMattress = ({ size, className }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M3 10.5 7 7h14l-4 3.5z" />
    <path d="M3 10.5V15l14 0 4-3.5V7" />
    <path d="M17 10.5V15" />
    <path d="M8.5 8.8h.01M12.5 8.8h.01M16.5 8.8h.01" strokeWidth={2.4} />
  </svg>
);
export const IconChair = ({ size, className }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M7 12V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v7" />
    <path d="M5.5 12h13v2.5h-13z" />
    <path d="M7 14.5V21M17 14.5V21" />
  </svg>
);
export const IconOther = ({ size, className }: P) => (
  <svg {...base(size)} className={className}>
    <ellipse cx="12" cy="8" rx="7" ry="2.6" />
    <path d="M5 8v7c0 1.5 3.1 2.6 7 2.6s7-1.1 7-2.6V8" />
    <path d="M8 18v2.5M16 18v2.5" />
  </svg>
);
export const CategoryIcon = ({ id, size, className }: P & { id: CategoryId }) => {
  const C = { sofa: IconSofa, armchair: IconArmchair, mattress: IconMattress, chair: IconChair, other: IconOther }[id];
  return <C size={size} className={className} />;
};

export const IconPlus = ({ size, className }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);
export const IconMinus = ({ size, className }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M5 12h14" />
  </svg>
);
export const IconTrash = ({ size, className }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />
  </svg>
);
export const IconReset = ({ size, className }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M3 12a9 9 0 1 0 3-6.7" />
    <path d="M3 4v5h5" />
  </svg>
);
export const IconRotate = ({ size, className }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M7 9c-2.5.8-4 2-4 3.3C3 14.9 7 17 12 17s9-2.1 9-4.7c0-1.3-1.5-2.5-4-3.3" />
    <path d="m14 15 2 2-2 2" />
  </svg>
);
export const IconSun = ({ size, className }: P) => (
  <svg {...base(size)} className={className}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </svg>
);
export const IconMoon = ({ size, className }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />
  </svg>
);
export const IconPhone = ({ size, className }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" />
  </svg>
);
export const IconChat = ({ size, className }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.9A8 8 0 1 1 21 12z" />
  </svg>
);
export const IconCamera = ({ size, className }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" />
    <circle cx="12" cy="13" r="3.5" />
  </svg>
);
export const IconX = ({ size, className }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);
export const IconCheck = ({ size, className }: P) => (
  <svg {...base(size)} className={className}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </svg>
);
export const IconArrowRight = ({ size, className }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);
export const IconArrowLeft = ({ size, className }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M19 12H5M11 6l-6 6 6 6" />
  </svg>
);
export const IconCopy = ({ size, className }: P) => (
  <svg {...base(size)} className={className}>
    <rect x="8" y="8" width="12" height="12" rx="2" />
    <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
  </svg>
);
export const IconRefresh = ({ size, className }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M20 11a8 8 0 0 0-14.9-3M4 13a8 8 0 0 0 14.9 3" />
    <path d="M4 4v4h4M20 20v-4h-4" />
  </svg>
);
export const IconSparkle = ({ size, className }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18" />
  </svg>
);
export const IconLogo = ({ size = 20 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
    <path d="M4 15c2.5-2 5.5-2 8 0s5.5 2 8 0" />
    <path d="M4 10c2.5-2 5.5-2 8 0s5.5 2 8 0" opacity="0.55" />
  </svg>
);
