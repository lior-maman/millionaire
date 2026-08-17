/**
 * Prize ladder — 15 rungs, ₪100 up to ₪1,000,000, matching the 15 questions
 * in a game. Index i corresponds to question i (0-based); PRIZES[i] is the
 * amount awarded for answering question i correctly.
 */
export const PRIZES = [
  100,        // Q1
  200,        // Q2
  300,        // Q3
  500,        // Q4
  1000,       // Q5
  2000,       // Q6
  4000,       // Q7
  8000,       // Q8
  16000,      // Q9
  32000,      // Q10
  64000,      // Q11
  125000,     // Q12
  250000,     // Q13
  500000,     // Q14
  1000000,    // Q15
];

export const formatPrize = (amount) => `₪${amount.toLocaleString("en-US")}`;
