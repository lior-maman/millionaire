/**
 * 50:50 lifeline icon — gold ring, deep blue center, "50:50" in gold.
 * Decorative; the button that wraps it carries the aria-label.
 */
export default function FiftyFiftyIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100%" height="100%" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="goldBorder" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFE259" />
          <stop offset="50%" stopColor="#FFA751" />
          <stop offset="100%" stopColor="#FFD700" />
        </linearGradient>
        <radialGradient id="centerBg" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#1E3C72" />
          <stop offset="100%" stopColor="#0A1128" />
        </radialGradient>
      </defs>
      <circle cx="50" cy="50" r="46" fill="none" stroke="url(#goldBorder)" strokeWidth="4" />
      <circle cx="50" cy="50" r="42" fill="url(#centerBg)" stroke="#2A5298" strokeWidth="2" />
      <text x="50" y="58" fontFamily="Arial, sans-serif" fontSize="28" fontWeight="900" fill="url(#goldBorder)" textAnchor="middle" letterSpacing="-1">50:50</text>
    </svg>
  );
}
