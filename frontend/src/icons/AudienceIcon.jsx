/**
 * Ask-the-Audience lifeline icon — gold ring, deep blue center, three audience
 * silhouettes (front figure gold, two back figures light blue).
 * Decorative; the button that wraps it carries the aria-label.
 */
export default function AudienceIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100%" height="100%" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="goldBorderAudience" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFE259" />
          <stop offset="50%" stopColor="#FFA751" />
          <stop offset="100%" stopColor="#FFD700" />
        </linearGradient>
        <radialGradient id="centerBgAudience" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#1E3C72" />
          <stop offset="100%" stopColor="#0A1128" />
        </radialGradient>
      </defs>
      <circle cx="50" cy="50" r="46" fill="none" stroke="url(#goldBorderAudience)" strokeWidth="4" />
      <circle cx="50" cy="50" r="42" fill="url(#centerBgAudience)" stroke="#2A5298" strokeWidth="2" />

      {/* Front (center) figure */}
      <circle cx="50" cy="42" r="8" fill="url(#goldBorderAudience)" />
      <path d="M 36 68 C 36 56, 64 56, 64 68 Z" fill="url(#goldBorderAudience)" />

      {/* Left (back) figure */}
      <circle cx="32" cy="46" r="6" fill="#A1C4FD" />
      <path d="M 21 68 C 21 58, 43 58, 43 68 Z" fill="#A1C4FD" opacity="0.85" />

      {/* Right (back) figure */}
      <circle cx="68" cy="46" r="6" fill="#A1C4FD" />
      <path d="M 57 68 C 57 58, 79 58, 79 68 Z" fill="#A1C4FD" opacity="0.85" />
    </svg>
  );
}
