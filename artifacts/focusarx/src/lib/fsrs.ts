/**
 * FSRS-4.5 (Free Spaced Repetition Scheduler)
 * 
 * A modern, research-backed spaced repetition algorithm that outperforms
 * traditional Leitner box systems. Calculates optimal review intervals
 * based on memory stability and difficulty.
 * 
 * Paper: https://github.com/open-spaced-repetition/fsrs4.5
 * 
 * Key concepts:
 * - Stability (S): How long memory lasts before forgetting
 * - Difficulty (D): How hard the card is to remember
 * - Retrievability (R): Probability of recall at time t
 * - Interval (I): Days until next review
 */

// FSRS parameters (default values, can be optimized per user)
const FSRS_PARAMS = {
  w: [
    0.4, 0.6, 2.4, 5.8,     // Initial stability for again/hard/good/easy
    4.93, 0.94, 0.86, 0.01, // Difficulty decay
    1.49, 0.14, 0.94,       // Stability after success
    2.18, 0.05, 0.34, 1.26, // Stability after failure
    0.29, 2.61,             // Hard penalty, easy bonus
  ],
};

export enum Grade {
  Again = 1, // Forgot completely
  Hard = 2,  // Recalled with difficulty
  Good = 3,  // Recalled with moderate effort
  Easy = 4,  // Recalled effortlessly
}

export interface CardState {
  difficulty: number;      // D: 1-10 scale
  stability: number;       // S: days of memory retention
  reps: number;            // Total review count
  lapses: number;          // Times forgot (grade = Again)
  lastReview: Date | null; // Last review timestamp
  dueDate: Date;           // Next review due
  interval: number;        // Days until next review
  state: 'new' | 'learning' | 'review' | 'relearning';
}

export interface ReviewResult {
  newState: CardState;
  interval: number;
  scheduledDays: number;
}

/**
 * Create a new card state
 */
export function createNewCard(): CardState {
  return {
    difficulty: 0,
    stability: 0,
    reps: 0,
    lapses: 0,
    lastReview: null,
    dueDate: new Date(),
    interval: 0,
    state: 'new',
  };
}

/**
 * Calculate retrievability (probability of recall) at time t
 */
function retrievability(elapsedDays: number, stability: number): number {
  if (stability <= 0) return 0;
  return Math.pow(1 + elapsedDays / (9 * stability), -1);
}

/**
 * Calculate initial stability after first review
 */
function initialStability(grade: Grade): number {
  const w = FSRS_PARAMS.w;
  return Math.max(0.1, w[grade - 1]);
}

/**
 * Calculate initial difficulty
 */
function initialDifficulty(grade: Grade): number {
  const w = FSRS_PARAMS.w;
  return Math.min(10, Math.max(1, w[4] - (grade - 3) * w[5]));
}

/**
 * Update difficulty after review
 */
function nextDifficulty(d: number, grade: Grade): number {
  const w = FSRS_PARAMS.w;
  const delta = -w[6] * (grade - 3);
  const newD = d + delta * (10 - d) / 9;
  return Math.min(10, Math.max(1, newD));
}

/**
 * Calculate stability after successful recall
 */
function stabilityAfterSuccess(
  d: number,
  s: number,
  r: number,
  grade: Grade
): number {
  const w = FSRS_PARAMS.w;
  const hardPenalty = grade === Grade.Hard ? w[15] : 1;
  const easyBonus = grade === Grade.Easy ? w[16] : 1;
  
  return Math.max(
    0.1,
    s * (1 + Math.exp(w[8]) * (11 - d) * Math.pow(s, -w[9]) * (Math.exp((1 - r) * w[10]) - 1) * hardPenalty * easyBonus)
  );
}

/**
 * Calculate stability after failure (lapse)
 */
function stabilityAfterFailure(d: number, s: number, r: number): number {
  const w = FSRS_PARAMS.w;
  return Math.max(
    0.1,
    Math.min(
      w[11] * Math.pow(d, -w[12]) * (Math.pow(s + 1, w[13]) - 1) * Math.exp((1 - r) * w[14]),
      s // Never increase stability after failure
    )
  );
}

/**
 * Calculate interval based on desired retention
 */
function calculateInterval(stability: number, desiredRetention: number = 0.9): number {
  // Target 90% retention by default
  return Math.max(1, Math.round(stability * 9 * (Math.pow(desiredRetention, -1) - 1)));
}

/**
 * Schedule next review based on grade
 */
export function schedule(
  card: CardState,
  grade: Grade,
  now: Date = new Date()
): ReviewResult {
  let newCard: CardState;

  // First review
  if (card.state === 'new') {
    const d = initialDifficulty(grade);
    const s = initialStability(grade);
    const i = calculateInterval(s);
    
    newCard = {
      difficulty: d,
      stability: s,
      reps: 1,
      lapses: grade === Grade.Again ? 1 : 0,
      lastReview: now,
      dueDate: new Date(now.getTime() + i * 24 * 60 * 60 * 1000),
      interval: i,
      state: grade === Grade.Again ? 'learning' : 'review',
    };

    return {
      newState: newCard,
      interval: i,
      scheduledDays: i,
    };
  }

  // Subsequent reviews
  const elapsedDays = card.lastReview
    ? (now.getTime() - card.lastReview.getTime()) / (24 * 60 * 60 * 1000)
    : 0;
  const r = retrievability(elapsedDays, card.stability);

  let newD: number;
  let newS: number;

  if (grade === Grade.Again) {
    // Failure
    newD = nextDifficulty(card.difficulty, grade);
    newS = stabilityAfterFailure(newD, card.stability, r);
  } else {
    // Success
    newD = nextDifficulty(card.difficulty, grade);
    newS = stabilityAfterSuccess(card.difficulty, card.stability, r, grade);
  }

  const newI = calculateInterval(newS);
  const newState = grade === Grade.Again ? 'relearning' : 'review';

  newCard = {
    difficulty: newD,
    stability: newS,
    reps: card.reps + 1,
    lapses: card.lapses + (grade === Grade.Again ? 1 : 0),
    lastReview: now,
    dueDate: new Date(now.getTime() + newI * 24 * 60 * 60 * 1000),
    interval: newI,
    state: newState,
  };

  return {
    newState: newCard,
    interval: newI,
    scheduledDays: newI,
  };
}

/**
 * Get current retrievability of a card
 */
export function getRetrievability(card: CardState, now: Date = new Date()): number {
  if (!card.lastReview) return 0;
  const elapsedDays = (now.getTime() - card.lastReview.getTime()) / (24 * 60 * 60 * 1000);
  return retrievability(elapsedDays, card.stability);
}

/**
 * Get cards due for review
 */
export function getDueCards(cards: CardState[], now: Date = new Date()): CardState[] {
  return cards.filter(card => card.dueDate <= now);
}

/**
 * Serialize card state for storage
 */
export function serializeCard(card: CardState): any {
  return {
    ...card,
    lastReview: card.lastReview?.toISOString() ?? null,
    dueDate: card.dueDate.toISOString(),
  };
}

/**
 * Deserialize card state from storage
 */
export function deserializeCard(data: any): CardState {
  return {
    ...data,
    lastReview: data.lastReview ? new Date(data.lastReview) : null,
    dueDate: new Date(data.dueDate),
  };
}
