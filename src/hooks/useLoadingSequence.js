import { useState, useEffect, useCallback } from 'react';

/**
 * useLoadingSequence — consolidated loading lifecycle hook.
 *
 * Replaces the repetitive 3-effect pattern (loading timer + fade-out + step progress)
 * that was duplicated across every page. Provides a single, configurable hook.
 *
 * @param {Object} [options]
 * @param {number} [options.minLoadingMs=200]
 *   Minimum time (ms) the skeleton is guaranteed to display before fade-out begins.
 *   Has no effect when `manual=true` (use markReady instead).
 * @param {number} [options.fadeOutMs=300]
 *   Duration (ms) of the skeleton fade-out transition before DOM removal.
 * @param {number} [options.stepCount=4]
 *   Number of loading steps for the progress indicator.
 * @param {number} [options.stepTotalMs=1000]
 *   Total time (ms) over which all steps are distributed.
 * @param {boolean} [options.startLoading=true]
 *   Whether to begin in loading state immediately.
 * @param {boolean} [options.manual=false]
 *   When true, loading state persists until `markReady()` is explicitly called.
 *   Useful for pages with async data dependencies (e.g. HistoryPage waiting for DB).
 * @returns {{ isLoading: boolean, showSkeleton: boolean, stepIndex: number, markReady: () => void }}
 *
 * Usage:
 *   // Page with no async data (auto-dismiss after minLoadingMs):
 *   const { isLoading, showSkeleton, stepIndex } = useLoadingSequence({ minLoadingMs: 200 });
 *
 *   // Page waiting for async data (call markReady when done):
 *   const { isLoading, showSkeleton, stepIndex, markReady } = useLoadingSequence({ manual: true });
 *   // ... later
 *   markReady();
 */
export function useLoadingSequence({
  minLoadingMs = 200,
  fadeOutMs = 300,
  stepCount = 4,
  stepTotalMs = 1000,
  startLoading = true,
  manual = false,
} = {}) {
  const [isLoading, setIsLoading] = useState(startLoading);
  const [showSkeleton, setShowSkeleton] = useState(startLoading);
  const [stepIndex, setStepIndex] = useState(0);
  const [readyCalled, setReadyCalled] = useState(false);

  // markReady allows async pages to signal completion early
  const markReady = useCallback(() => {
    setReadyCalled(true);
  }, []);

  // Auto-dismiss after minLoadingMs, or when markReady is called.
  // In manual mode, ONLY markReady triggers dismissal.
  useEffect(() => {
    if (!isLoading) return;

    const done = () => setIsLoading(false);

    // In manual mode, wait for markReady only
    if (manual) {
      if (readyCalled) {
        done();
      }
      return;
    }

    // Auto mode: dismiss after minLoadingMs, or immediately if markReady was called
    if (readyCalled) {
      done();
      return;
    }
    const timer = setTimeout(done, minLoadingMs);
    return () => clearTimeout(timer);
  }, [isLoading, readyCalled, minLoadingMs, manual]);

  // Smooth fade-out: keep skeleton mounted for fadeOutMs after isLoading goes false
  useEffect(() => {
    if (!isLoading && showSkeleton) {
      const timer = setTimeout(() => setShowSkeleton(false), fadeOutMs);
      return () => clearTimeout(timer);
    }
  }, [isLoading, showSkeleton, fadeOutMs]);

  // Animated step progress while loading
  useEffect(() => {
    if (!isLoading) return;
    const lastStep = stepCount - 1;
    const intervalMs = stepTotalMs / stepCount;
    const intervals = Array.from({ length: lastStep }, (_, i) => (i + 1) * intervalMs).map((ms) =>
      setTimeout(() => setStepIndex((p) => Math.min(p + 1, lastStep)), ms)
    );
    return () => intervals.forEach(clearTimeout);
  }, [isLoading, stepCount, stepTotalMs]);

  return { isLoading, showSkeleton, stepIndex, markReady };
}
