/**
 * Timer icon — gold ring, deep blue center, with the remaining seconds shown
 * in the middle. Unlike the other icons this one is DYNAMIC: it takes the live
 * `seconds` value and renders it, turning red under the danger threshold.
 *
 * Props:
 *   seconds — remaining time to display.
 *   danger  — when true, the number turns red (low time).
 */
export default function TimerIcon({ seconds, danger = false }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100%" height="100%" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="goldGradientTimer" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFE259" />
          <stop offset="50%" stopColor="#FFA751" />
          <stop offset="100%" stopColor="#FFD700" />
        </linearGradient>
        <radialGradient id="centerBgTimer" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#1E3C72" />
          <stop offset="100%" stopColor="#0A1128" />
        </radialGradient>
      </defs>

      <circle cx="50" cy="50" r="46" fill="none" stroke="url(#goldGradientTimer)" strokeWidth="4" />
      <circle cx="50" cy="50" r="42" fill="url(#centerBgTimer)" stroke="#2A5298" strokeWidth="2" />

      {/* Decorative time-ring */}
      <circle cx="50" cy="50" r="34" fill="none" stroke="#2A5298" strokeWidth="2" strokeDasharray="4 2" />

      {/* Live seconds — red when time is low, gold otherwise */}
      <text
        x="50"
        y="60"
        fontFamily="Arial, sans-serif"
        fontSize="32"
        fontWeight="900"
        fill={danger ? "#e74c3c" : "url(#goldGradientTimer)"}
        textAnchor="middle"
      >
        {seconds}
      </text>
    </svg>
  );
}
