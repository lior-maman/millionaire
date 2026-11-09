/**
 * Leaderboard rank medal: a ribbon + round medal with the rank number on it.
 *   1 gold, 2 silver, 3 bronze, 4+ blue (matches the game's deep-blue theme).
 * Decorative — the cell reads the rank via aria-label.
 */
const TIERS = {
  1: { light: "#FFE259", mid: "#FFC107", dark: "#B8860B", text: "#5C3D00" },
  2: { light: "#F5F7FA", mid: "#C3CCD6", dark: "#7D8A99", text: "#2F3A47" },
  3: { light: "#F3B07C", mid: "#CD7F32", dark: "#8A4F1D", text: "#3E2109" },
  rest: { light: "#A1C4FD", mid: "#2A5298", dark: "#1E3C72", text: "#FFFFFF" },
};

export default function RankMedal({ rank }) {
  const t = TIERS[rank] || TIERS.rest;
  const id = `medal-${rank <= 3 ? rank : "rest"}`;
  const label = String(rank);
  // Shrink the number a little when it gets wide (10+, 100+).
  const fontSize = label.length >= 3 ? 13 : label.length === 2 ? 16 : 19;

  return (
    <svg
      className="rank-medal"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 40 48"
      width="32"
      height="38"
      role="img"
      aria-label={`Rank ${rank}`}
    >
      <defs>
        <radialGradient id={`${id}-face`} cx="35%" cy="30%" r="75%">
          <stop offset="0%" stopColor={t.light} />
          <stop offset="60%" stopColor={t.mid} />
          <stop offset="100%" stopColor={t.dark} />
        </radialGradient>
      </defs>
      {/* Ribbon */}
      <path d="M 9 0 L 19 0 L 23 16 L 15 18 Z" fill="#C0392B" />
      <path d="M 31 0 L 21 0 L 17 16 L 25 18 Z" fill="#2E5FA8" />
      {/* Medal */}
      <circle cx="20" cy="31" r="15" fill={`url(#${id}-face)`} stroke={t.dark} strokeWidth="1.5" />
      <circle cx="20" cy="31" r="11.5" fill="none" stroke={t.light} strokeOpacity="0.7" strokeWidth="1" />
      <text
        x="20"
        y="31"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={fontSize}
        fontWeight="800"
        fontFamily="system-ui, -apple-system, Segoe UI, sans-serif"
        fill={t.text}
      >
        {label}
      </text>
    </svg>
  );
}
