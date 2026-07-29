// Detect UCI "go" commands without false positives.
export const isGoCommand = (command) => /^\s*go\b/i.test(command);

// Detect UCI "position" commands.
export const isPositionCommand = (command) => /^\s*position\b/i.test(command);

/**
 * Build a safe UCI `go` command, clamping its parameters.
 * @param {Object} options
 * @param {number} [options.depth]
 * @param {number} [options.movetime]
 * @param {number} [options.nodes]
 * @returns {string}
 */
export function buildGoCommand({ depth, movetime, nodes } = {}) {
  const parts = ['go'];

  if (typeof depth === 'number' && depth > 0) {
    parts.push('depth', String(Math.min(Math.max(1, depth), 50)));
  } else if (typeof movetime === 'number' && movetime > 0) {
    parts.push('movetime', String(Math.min(Math.max(100, movetime), 60000)));
  } else if (typeof nodes === 'number' && nodes > 0) {
    parts.push('nodes', String(Math.min(Math.max(1, nodes), Number.MAX_SAFE_INTEGER)));
  } else {
    // Sensible default to avoid an unbounded search
    parts.push('movetime', '1000');
  }

  return parts.join(' ');
}
