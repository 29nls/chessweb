import openings from './book';

export function detectOpening(moves) {
  if (!moves || moves.length === 0) return null;

  let bestMatch = null;
  let bestLength = 0;

  for (const opening of openings) {
    const bookMoves = opening.moves;
    let matchLength = 0;
    for (let i = 0; i < Math.min(moves.length, bookMoves.length); i++) {
      if (moves[i] === bookMoves[i]) {
        matchLength = i + 1;
      } else {
        break;
      }
    }
    if (matchLength > 0 && matchLength >= moves.length) {
      // Bugfix: prefer opening dengan line paling panjang (paling spesifik) saat tie
      const currentIsLonger = matchLength > bestLength;
      const currentIsTiedAndMoreSpecific = matchLength === bestLength && bestMatch && bookMoves.length > bestMatch.moves.length;
      if (currentIsLonger || currentIsTiedAndMoreSpecific) {
        bestLength = matchLength;
        bestMatch = opening;
      }
    }
  }

  return bestMatch;
}

export function getCommonNextMoves(moves) {
  if (!moves) return [];

  const nextMovesMap = {};

  for (const opening of openings) {
    const bookMoves = opening.moves;
    if (bookMoves.length <= moves.length) continue;

    let matches = true;
    for (let i = 0; i < moves.length; i++) {
      if (moves[i] !== bookMoves[i]) {
        matches = false;
        break;
      }
    }

    if (matches) {
      const nextSan = bookMoves[moves.length];
      if (nextSan) {
        const count = (nextMovesMap[nextSan] || 0) + 1;
        nextMovesMap[nextSan] = count;
      }
    }
  }

  return Object.entries(nextMovesMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([move, count]) => ({ move, count }));
}
