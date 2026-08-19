const base = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  viewBox: "0 0 24 24",
};

export function TrophyIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M8 4h8v5a4 4 0 0 1-8 0V4Z" />
      <path d="M8 5H4v2a4 4 0 0 0 4 4M16 5h4v2a4 4 0 0 1-4 4" />
      <path d="M12 13v3M9 20h6M10 16.5h4v2a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1v-2Z" />
    </svg>
  );
}

export function CalendarIcon(props) {
  return (
    <svg {...base} {...props}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </svg>
  );
}

export function WhistleIcon(props) {
  return (
    <svg {...base} {...props}>
      <circle cx="9" cy="14" r="5" />
      <path d="M13 11h5a3 3 0 0 0 3-3V6h-4l-4 3" />
      <path d="M9 14h.01" />
    </svg>
  );
}

export function NewspaperIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M4 5h13a2 2 0 0 1 2 2v12a1 1 0 0 1-1.6.8L16 18H6a2 2 0 0 1-2-2V5Z" />
      <path d="M4 5a2 2 0 0 0-2 2v10a1 1 0 0 0 2 0" />
      <path d="M8 9h7M8 12h7M8 15h4" />
    </svg>
  );
}

export function ChevronLeftIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M15 6l-6 6 6 6" />
    </svg>
  );
}

export function ShirtIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M8 4 4 7l2 3 2-1.5V20h8V8.5L18 10l2-3-4-3-2 2h-4L8 4Z" />
    </svg>
  );
}

export function PitchIcon(props) {
  return (
    <svg {...base} {...props}>
      <rect x="3" y="3" width="18" height="18" rx="1" />
      <circle cx="12" cy="12" r="3" />
      <path d="M3 12h4M17 12h4" />
    </svg>
  );
}
