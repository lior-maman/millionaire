/**
 * Hint lifeline icon — same gold ring + deep blue center as the other
 * lifelines, with a gold light bulb.
 * Decorative; the button that wraps it carries the aria-label.
 */
export default function HintIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100%" height="100%" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="goldBorderHint" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFE259" />
          <stop offset="50%" stopColor="#FFA751" />
          <stop offset="100%" stopColor="#FFD700" />
        </linearGradient>
        <radialGradient id="centerBgHint" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#1E3C72" />
          <stop offset="100%" stopColor="#0A1128" />
        </radialGradient>
      </defs>
      <circle cx="50" cy="50" r="46" fill="none" stroke="url(#goldBorderHint)" strokeWidth="4" />
      <circle cx="50" cy="50" r="42" fill="url(#centerBgHint)" stroke="#2A5298" strokeWidth="2" />
      {/* Bulb glass */}
      <path
        d="M 50 24 C 37 24, 29 33, 29 44 C 29 52, 34 57, 38 61 C 40 63, 41 65, 41 68 L 59 68 C 59 65, 60 63, 62 61 C 66 57, 71 52, 71 44 C 71 33, 63 24, 50 24 Z"
        fill="url(#goldBorderHint)"
      />
      {/* Filament */}
      <path d="M 44 50 L 47 56 L 50 50 L 53 56 L 56 50" fill="none" stroke="#0A1128" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {/* Base */}
      <rect x="41" y="70" width="18" height="5" rx="2" fill="#A1C4FD" />
      <rect x="43" y="77" width="14" height="4" rx="2" fill="#A1C4FD" opacity="0.85" />
    </svg>
  );
}
