const API_BASE_URL = 'https://api.browser-use.com';

const outputSchema = {
  type: 'object',
  properties: {
    games: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          white: { type: 'string' },
          black: { type: 'string' },
          result: { type: 'string' },
          date: { type: 'string' },
          url: { type: 'string' },
          pgn: { type: 'string' },
        },
        required: ['white', 'black', 'result', 'pgn'],
      },
    },
  },
  required: ['games'],
};

function sendError(res, status, message) {
  return res.status(status).json({ error: message });
}

function buildTask(site, username, maxGames) {
  const profileUrl = site === 'lichess'
    ? `https://lichess.org/@/${username}`
    : `https://www.chess.com/member/${username}`;
  const gamesLocation = site === 'lichess' ? 'the games list' : 'Games/Archive';

  return `Navigate to ${profileUrl}, then open ${gamesLocation}. Open the ${maxGames} most recent FINISHED games for the player. For each game, extract the COMPLETE PGN including every move (full movetext), plus the white player, black player, result, date, and game URL. Return valid PGN movetext for every game; do not truncate or summarize the moves.`;
}

module.exports = async (req, res) => {
  try {
    const apiKey = process.env.BROWSER_USE_API_KEY;
    if (!apiKey) return sendError(res, 500, 'BROWSER_USE_API_KEY is not configured');

    const headers = {
      'Content-Type': 'application/json',
      'X-Browser-Use-API-Key': apiKey,
    };

    if (req.method === 'POST') {
      const body = req.body || {};
      const { site, username } = body;
      if (site !== 'chess.com' && site !== 'lichess') {
        return sendError(res, 400, 'site must be "chess.com" or "lichess"');
      }
      if (typeof username !== 'string' || !username.trim()) {
        return sendError(res, 400, 'username must be a non-empty string');
      }

      const requestedMaxGames = body.maxGames === undefined ? 3 : body.maxGames;
      if (!Number.isInteger(requestedMaxGames)) {
        return sendError(res, 400, 'maxGames must be an integer');
      }
      const maxGames = Math.max(1, Math.min(5, requestedMaxGames));
      const response = await fetch(`${API_BASE_URL}/api/v3/sessions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          task: buildTask(site, username.trim(), maxGames),
          model: 'bu-mini',
          outputSchema,
        }),
      });

      if (!response.ok) {
        const bodyText = await response.text();
        return sendError(res, response.status, bodyText);
      }

      const session = await response.json();
      return res.status(200).json({
        sessionId: session.id,
        liveUrl: session.liveUrl ?? null,
      });
    }

    if (req.method === 'GET') {
      const sessionId = req.query?.sessionId;
      if (!sessionId || typeof sessionId !== 'string') {
        return sendError(res, 400, 'sessionId is required');
      }

      const response = await fetch(
        `${API_BASE_URL}/api/v3/sessions/${encodeURIComponent(sessionId)}`,
        { headers: { 'X-Browser-Use-API-Key': apiKey } },
      );
      if (!response.ok) {
        const bodyText = await response.text();
        return sendError(res, response.status, bodyText);
      }

      const session = await response.json();
      const status = session.status;
      const done = ['idle', 'stopped', 'timed_out', 'error'].includes(status);
      let output = session.output;
      if (typeof output === 'string') {
        try {
          output = JSON.parse(output);
        } catch {
          output = null;
        }
      }

      return res.status(200).json({
        status,
        done,
        success: session.isTaskSuccessful ?? null,
        output: output ?? null,
        liveUrl: session.liveUrl ?? null,
        stepCount: session.stepCount ?? null,
        lastStepSummary: session.lastStepSummary ?? null,
        ...(status === 'error' || status === 'timed_out'
          ? { error: session.error ?? session.errorMessage ?? `Session ${status}` }
          : {}),
      });
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    return sendError(res, 500, error.message || 'Unexpected server error');
  }
};
