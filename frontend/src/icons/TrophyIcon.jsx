/**
 * Trophy icon — gold ring, deep blue center, a gold trophy with a victory star.
 * Shown on the end screen when the player answers every question correctly.
 * Decorative; surrounding text conveys the meaning.
 */
export default function TrophyIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100%" height="100%" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="goldGradientTrophy" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFE259" />
          <stop offset="50%" stopColor="#FFA751" />
          <stop offset="100%" stopColor="#FFD700" />
        </linearGradient>
        <radialGradient id="centerBgTrophy" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#1E3C72" />
          <stop offset="100%" stopColor="#0A1128" />
        </radialGradient>
      </defs>

      <circle cx="50" cy="50" r="46" fill="none" stroke="url(#goldGradientTrophy)" strokeWidth="4" />
      <circle cx="50" cy="50" r="42" fill="url(#centerBgTrophy)" stroke="#2A5298" strokeWidth="2" />

      {/* Base */}
      <rect x="35" y="72" width="30" height="5" rx="1" fill="url(#goldGradientTrophy)" />
      <path d="M 42 72 L 45 62 L 55 62 L 58 72 Z" fill="url(#goldGradientTrophy)" />
      {/* Stem */}
      <rect x="47" y="55" width="6" height="8" fill="url(#goldGradientTrophy)" />
      {/* Cup */}
      <path d="M 32 30 C 32 52, 68 52, 68 30 Z" fill="url(#goldGradientTrophy)" />
      <rect x="30" y="27" width="40" height="4" rx="2" fill="url(#goldGradientTrophy)" />
      {/* Handles */}
      <path d="M 31 32 C 22 32, 22 45, 33 46" fill="none" stroke="url(#goldGradientTrophy)" strokeWidth="3" strokeLinecap="round" />
      <path d="M 69 32 C 78 32, 78 45, 67 46" fill="none" stroke="url(#goldGradientTrophy)" strokeWidth="3" strokeLinecap="round" />
      {/* Victory star */}
      <polygon points="50,34 52,39 57,39 53,42 55,47 50,44 45,47 47,42 43,39 48,39" fill="#0A1128" />
    </svg>
  );
}
