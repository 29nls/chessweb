import { useRef, useState, useEffect } from 'react';

/**
 * useEvalSwing
 * Detects big swings in chess engine evaluation and returns a swingKey
 * that increments on each swing — useful for re-triggering CSS animations.
 *
 * Swing detection conditions:
 *   - Score diff >= swingThreshold (default 300 centipawns = 3 pawns)
 *   - Mate type changed (cp ↔ mate)
 *   - Score direction changed (positive ↔ negative) with diff >= 50
 *
 * @param {Object} evaluation - The engine evaluation object: { score, type, ... }
 * @param {Object} [options]
 * @param {number} [options.swingThreshold=300] - Centipawn threshold for a "big swing"
 * @returns {{ swingKey: number, swingInfo: Object | null }}
 *   swingKey: Counter that increments on each detected swing.
 *   swingInfo: { direction: 'positive'|'negative', diff: number, type: string } | null
 */
export function useEvalSwing(evaluation, { swingThreshold = 300 } = {}) {
  const prevScoreRef = useRef(null);
  const prevTypeRef = useRef(null);
  const [swingKey, setSwingKey] = useState(0);
  const [swingInfo, setSwingInfo] = useState(null);

  useEffect(() => {
    // Guard: no evaluation or score is null → reset tracking
    if (evaluation?.score === null || evaluation?.score === undefined) {
      prevScoreRef.current = null;
      prevTypeRef.current = null;
      return;
    }

    const prevScore = prevScoreRef.current;
    const prevType = prevTypeRef.current;
    const currScore = evaluation.score;
    const currType = evaluation.type;

    if (prevScore !== null) {
      const diff = Math.abs(currScore - prevScore);
      const mateChanged = (currType === 'mate') !== (prevType === 'mate');
      const directionChanged = (currScore > 0) !== (prevScore > 0) && diff >= 50;

      if (diff >= swingThreshold || mateChanged || directionChanged) {
        setSwingKey((k) => k + 1);
        setSwingInfo({
          direction: currScore > prevScore ? 'positive' : 'negative',
          diff,
          type: mateChanged
            ? 'mate_change'
            : directionChanged
              ? 'direction_change'
              : 'big_swing',
        });
      }
    }

    prevScoreRef.current = currScore;
    prevTypeRef.current = currType;
  }, [evaluation?.score, evaluation?.type, swingThreshold]);

  return { swingKey, swingInfo };
}
