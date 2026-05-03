import type { RequestEntry, AnomalyEvent } from '../types';

/**
 * Per-endpoint latency & frequency anomaly detector.
 *
 * Maintains a sliding window of the last `MAX_SAMPLES` requests per
 * endpoint. After at least 10 samples we emit:
 *   - a "slow" event when the current duration is >2.5x p95
 *     (and exceeds 500ms with a non-trivial p95)
 *   - a "frequency" event when the rolling 60s rate exceeds
 *     4x the median 60s rate observed historically.
 */

type EndpointBaseline = {
  durations: number[];
  timestamps: number[];
};

const baselines = new Map<string, EndpointBaseline>();
const MAX_SAMPLES = 50;

function percentile(sorted: readonly number[], p: number): number {
  if (!sorted.length) return 0;
  const idx = Math.min(Math.floor(sorted.length * p), sorted.length - 1);
  return sorted[idx]!;
}

function median(sorted: readonly number[]): number {
  return percentile(sorted, 0.5);
}

/**
 * Record a sample for the given endpoint and return an anomaly event
 * when applicable.
 */
export function checkAnomaly(r: RequestEntry): AnomalyEvent | null {
  if (!r.duration || r.status <= 0) return null;
  const endpoint = `${r.method} ${r.path}`;

  let bl = baselines.get(endpoint);
  if (!bl) {
    bl = { durations: [], timestamps: [] };
    baselines.set(endpoint, bl);
  }

  bl.durations.push(r.duration);
  bl.timestamps.push(r.timestamp);
  if (bl.durations.length > MAX_SAMPLES) {
    bl.durations.shift();
    bl.timestamps.shift();
  }

  if (bl.durations.length < 10) return null;

  const sortedDurs = [...bl.durations].sort((a, b) => a - b);
  const p95 = percentile(sortedDurs, 0.95);

  // Slow detection: >2.5x p95, only meaningful when p95 itself is non-trivial.
  if (r.duration > 2.5 * p95 && r.duration > 500 && p95 > 50) {
    const severity: AnomalyEvent['severity'] = r.duration > 5 * p95 ? 'critical' : 'warning';
    return {
      endpoint,
      type: 'slow',
      severity,
      value: r.duration,
      baseline: { p95 },
      requestId: r.id,
      timestamp: Date.now(),
    };
  }

  // Frequency spike: count requests in last 60s vs. historical median 60s rate.
  const now = Date.now();
  const recentTs = bl.timestamps.filter((t) => now - t < 60_000);
  if (recentTs.length > 5) {
    const rate = recentTs.length;
    const windowRates: number[] = [];
    for (let i = 0; i < bl.timestamps.length; i++) {
      const anchor = bl.timestamps[i]!;
      const windowStart = anchor - 60_000;
      const count = bl.timestamps.filter((t) => t >= windowStart && t <= anchor).length;
      windowRates.push(count);
    }
    const sortedRates = [...windowRates].sort((a, b) => a - b);
    const medianRate = median(sortedRates);
    if (medianRate > 0 && rate > 4 * medianRate) {
      return {
        endpoint,
        type: 'frequency',
        severity: 'warning',
        value: rate,
        baseline: { medianRate },
        requestId: r.id,
        timestamp: Date.now(),
      };
    }
  }

  return null;
}
