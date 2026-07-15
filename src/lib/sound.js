const audioCache = {};
const failedCache = new Set();

const FILES = {
  move: '/sound/move-self.ogg',
  capture: '/sound/capture.ogg',
  castle: '/sound/castle.ogg',
  promote: '/sound/promote.ogg',
  check: '/sound/move-check.ogg',
  gameEnd: '/sound/game-end.ogg',
  notify: '/sound/notify.ogg',
};

export function playSound(name) {
  if (failedCache.has(name)) return;
  if (!audioCache[name]) {
    const src = FILES[name];
    if (!src) return;
    const audio = new Audio(src);
    audio.addEventListener('error', () => failedCache.add(name), { once: true });
    audioCache[name] = audio;
  }
  const audio = audioCache[name];
  audio.currentTime = 0;
  audio.play().catch(() => failedCache.add(name));
}

export function playMoveSound(move, game) {
  if (!move) return;

  if (game && game.isGameOver()) {
    playSound('gameEnd');
    return;
  }

  const isCapture = move.flags && (move.flags.includes('c') || move.flags.includes('e'));
  const isCastle = move.flags && (move.flags.includes('k') || move.flags.includes('q'));
  const isPromotion = move.flags && move.flags.includes('p');

  if (isCastle) playSound('castle');
  else if (isCapture) playSound('capture');
  else if (isPromotion) playSound('promote');
  else playSound('move');

  if (game && game.isCheck()) {
    setTimeout(() => playSound('check'), 150);
  }
}

export function findCheckedKingSquare(game) {
  try {
    if (!game || !game.isCheck()) return null;

    const turn = game.turn();
    const board = game.board();

    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = board[row][col];
        if (piece && piece.type === 'k' && piece.color === turn) {
          return 'abcdefgh'[col] + (8 - row);
        }
      }
    }
  } catch (e) {
    // ignore
  }
  return null;
}
