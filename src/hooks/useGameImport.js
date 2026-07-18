import { useCallback, useEffect, useRef, useState } from 'react';

const POLL_INTERVAL = 2000;
const MAX_POLLING_TIME = 5 * 60 * 1000;

export function useGameImport() {
  const [status, setStatus] = useState('idle');
  const [games, setGames] = useState([]);
  const [liveUrl, setLiveUrl] = useState(null);
  const [lastStepSummary, setLastStepSummary] = useState(null);
  const [error, setError] = useState(null);
  const intervalRef = useRef(null);
  const timeoutRef = useRef(null);

  const clearPolling = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    intervalRef.current = null;
    timeoutRef.current = null;
  }, []);

  const reset = useCallback(() => {
    clearPolling();
    setStatus('idle');
    setGames([]);
    setLiveUrl(null);
    setLastStepSummary(null);
    setError(null);
  }, [clearPolling]);

  const start = useCallback(async ({ site, username, maxGames }) => {
    clearPolling();
    setStatus('starting');
    setGames([]);
    setLiveUrl(null);
    setLastStepSummary(null);
    setError(null);

    try {
      const response = await fetch('/api/import-games', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ site, username, maxGames }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not start game import.');
      if (!data.sessionId) throw new Error('The import session did not start.');

      setLiveUrl(data.liveUrl || null);
      setStatus('polling');

      const poll = async () => {
        const pollResponse = await fetch(
          `/api/import-games?sessionId=${encodeURIComponent(data.sessionId)}`,
        );
        const pollData = await pollResponse.json();
        if (!pollResponse.ok) throw new Error(pollData.error || 'Could not check import status.');

        setLiveUrl(pollData.liveUrl || data.liveUrl || null);
        setLastStepSummary(pollData.lastStepSummary || null);
        if (pollData.done) {
          clearPolling();
          if (pollData.error) {
            setError(pollData.error);
            setStatus('error');
          } else if (pollData.output && Array.isArray(pollData.output.games)) {
            setGames(pollData.output.games);
            setStatus('done');
          } else {
            setError('The import completed without any games.');
            setStatus('error');
          }
        }
      };

      intervalRef.current = setInterval(() => {
        poll().catch((pollError) => {
          clearPolling();
          setError(pollError.message);
          setStatus('error');
        });
      }, POLL_INTERVAL);
      timeoutRef.current = setTimeout(() => {
        clearPolling();
        setError('Game import timed out. Please try again.');
        setStatus('error');
      }, MAX_POLLING_TIME);
      await poll();
    } catch (startError) {
      clearPolling();
      setError(startError.message);
      setStatus('error');
    }
  }, [clearPolling]);

  useEffect(() => clearPolling, [clearPolling]);

  return {
    status,
    games,
    liveUrl,
    lastStepSummary,
    error,
    start,
    reset,
  };
}
