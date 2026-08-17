import { PRIZES, formatPrize } from "../prizes.js";

/**
 * Prize ladder shown to the left of the game. Rungs are rendered highest-first
 * so the ladder reads bottom-to-top: ₪100 at the bottom, ₪1,000,000 at the top,
 * and the player climbs upward as they answer correctly.
 *
 * Props:
 *   currentIndex — 0-based index of the question being answered now (highlighted).
 *   answered     — count of questions already answered correctly (shown as "won").
 */
export default function PrizeLadder({ currentIndex, answered }) {
  // Iterate top (last rung) down to bottom (first rung).
  const rungs = PRIZES.map((amount, i) => ({ amount, i })).reverse();

  return (
    <ul className="ladder" aria-label="Prize ladder">
      {rungs.map(({ amount, i }) => {
        const isCurrent = i === currentIndex;
        const isWon = i < answered;
        let cls = "rung";
        if (isCurrent) cls += " current";
        else if (isWon) cls += " won";
        // Milestone rungs (₪1,000 and ₪32,000) get a subtle marker.
        if (amount === 1000 || amount === 32000) cls += " milestone";
        return (
          <li key={i} className={cls}>
            <span className="rung-num">{i + 1}</span>
            <span className="rung-amount">{formatPrize(amount)}</span>
          </li>
        );
      })}
    </ul>
  );
}
