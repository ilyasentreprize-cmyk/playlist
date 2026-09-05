// Jeu d'icônes monochromes, tracé dans l'esprit SF Symbols.
// Toutes héritent de `currentColor` et se dimensionnent via `size`.

type IconProps = { size?: number; className?: string };

function Svg({
  size = 20,
  className,
  children,
  stroke = true,
}: IconProps & { children: React.ReactNode; stroke?: boolean }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={stroke ? "none" : "currentColor"}
      stroke={stroke ? "currentColor" : "none"}
      strokeWidth={stroke ? 2 : undefined}
      strokeLinecap={stroke ? "round" : undefined}
      strokeLinejoin={stroke ? "round" : undefined}
      className={className}
      aria-hidden="true"
      focusable="false"
      style={{ display: "block", flexShrink: 0 }}
    >
      {children}
    </svg>
  );
}

export function ChevronLeft(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M15 5 8 12l7 7" />
    </Svg>
  );
}

export function ChevronRight(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="m9 5 7 7-7 7" />
    </Svg>
  );
}

export function Play(p: IconProps) {
  return (
    <Svg {...p} stroke={false}>
      <path d="M8 5.14v13.72a.6.6 0 0 0 .92.5l10.7-6.86a.6.6 0 0 0 0-1l-10.7-6.86a.6.6 0 0 0-.92.5Z" />
    </Svg>
  );
}

export function Pause(p: IconProps) {
  return (
    <Svg {...p} stroke={false}>
      <rect x="7" y="5" width="3.6" height="14" rx="1.2" />
      <rect x="13.4" y="5" width="3.6" height="14" rx="1.2" />
    </Svg>
  );
}

export function Check(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="m5 12.8 4.6 4.6L19 6.8" />
    </Svg>
  );
}

export function Plus(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 5v14M5 12h14" />
    </Svg>
  );
}

export function Close(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />
    </Svg>
  );
}

export function CloseCircle(p: IconProps) {
  return (
    <Svg {...p} stroke={false}>
      <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm3.54 12.13a1 1 0 0 1-1.41 1.41L12 13.41l-2.13 2.13a1 1 0 0 1-1.41-1.41L10.59 12 8.46 9.87a1 1 0 0 1 1.41-1.41L12 10.59l2.13-2.13a1 1 0 0 1 1.41 1.41L13.41 12Z" />
    </Svg>
  );
}

export function Search(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="10.8" cy="10.8" r="6.3" />
      <path d="m15.5 15.5 4 4" />
    </Svg>
  );
}

export function Heart({ filled = false, ...p }: IconProps & { filled?: boolean }) {
  return (
    <Svg {...p} stroke={!filled}>
      <path d="M12 20.6 4.5 13.1a4.85 4.85 0 0 1 0-6.86 4.85 4.85 0 0 1 6.86 0l.64.64.64-.64a4.85 4.85 0 0 1 6.86 0 4.85 4.85 0 0 1 0 6.86Z" />
    </Svg>
  );
}

export function Person(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="8" r="3.6" />
      <path d="M5.4 20a6.6 6.6 0 0 1 13.2 0" />
    </Svg>
  );
}

export function Copy(p: IconProps) {
  return (
    <Svg {...p}>
      <rect x="9" y="9" width="11" height="11" rx="2.6" />
      <path d="M15 6.5A2.5 2.5 0 0 0 12.5 4h-6A2.5 2.5 0 0 0 4 6.5v6A2.5 2.5 0 0 0 6.5 15" />
    </Svg>
  );
}

export function Link(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M10.5 13.5a4 4 0 0 0 5.66 0l2.83-2.83a4 4 0 1 0-5.66-5.66l-1.2 1.2" />
      <path d="M13.5 10.5a4 4 0 0 0-5.66 0l-2.83 2.83a4 4 0 1 0 5.66 5.66l1.2-1.2" />
    </Svg>
  );
}

export function Share(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 15.5V4m0 0L8.5 7.5M12 4l3.5 3.5" />
      <path d="M6.5 11.5h-1a1.5 1.5 0 0 0-1.5 1.5v6a1.5 1.5 0 0 0 1.5 1.5h13a1.5 1.5 0 0 0 1.5-1.5v-6a1.5 1.5 0 0 0-1.5-1.5h-1" />
    </Svg>
  );
}

export function MusicNote(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="7" cy="17.5" r="3" />
      <circle cx="18" cy="15.5" r="3" />
      <path d="M10 17.5V7.2a1 1 0 0 1 .78-.98l8-1.78a1 1 0 0 1 1.22.98V15.5" />
    </Svg>
  );
}

export function QrCode(p: IconProps) {
  return (
    <Svg {...p}>
      <rect x="4" y="4" width="6.5" height="6.5" rx="1.6" />
      <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.6" />
      <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.6" />
      <path d="M13.5 13.5h3v3m3.5 0v3.5h-3.5" />
    </Svg>
  );
}

export function Car(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M4.5 16v2.2a.8.8 0 0 1-.8.8H3a.8.8 0 0 1-.8-.8V12m17.3 4v2.2a.8.8 0 0 0 .8.8h.7a.8.8 0 0 0 .8-.8V12" />
      <path d="M2.2 12.6 4 7.4A2.6 2.6 0 0 1 6.45 5.6h11.1A2.6 2.6 0 0 1 20 7.4l1.8 5.2v2.8a.8.8 0 0 1-.8.8H3a.8.8 0 0 1-.8-.8Z" />
      <path d="M6.2 12.4h.02m11.58 0h.02" strokeWidth="2.6" />
    </Svg>
  );
}
