// Detect UCI "go" commands without false positives.
export const isGoCommand = (command) => /^\s*go\b/i.test(command);
