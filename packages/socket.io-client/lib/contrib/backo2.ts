/**
 * Initialize backoff timer with `opts`.
 * - `min` initial timeout in milliseconds [100]
 * - `max` max timeout [10000]
 * - `jitter` [0]
 * - `factor` [2]
 */

type BackoffOptions = {
  min?: number;
  max?: number;
  jitter?: number;
  factor?: number;
}
export class Backoff {
  ms: number;
  max: number
  factor: number
  jitter: number
  attempts: number

  constructor(opts = {min: 100, max: 10000, factor: 2, jitter: 0} satisfies BackoffOptions) {
    this.ms = opts.min;
    this.max = opts.max;
    this.factor = opts.factor;
    this.jitter = opts.jitter > 0 && opts.jitter <= 1 ? opts.jitter : 0;
    this.attempts = 0;
  }

  duration() {
    let ms = this.ms * Math.pow(this.factor, this.attempts++);
    if (this.jitter) {
      const rand =  Math.random();
      const deviation = Math.floor(rand * this.jitter * ms);
      ms = (Math.floor(rand * 10) & 1) == 0  ? ms - deviation : ms + deviation;
    }
    return Math.min(ms, this.max) | 0;
  };

  reset() {
    this.attempts = 0;
  }

  setMin(min: number) {
    this.ms = min;
  }

  setMax(max: number) {
    this.max = max;
  }

  setJitter(jitter: number) {
    this.jitter = jitter;
  }
}
