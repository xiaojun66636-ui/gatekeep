export type Clock = () => number;

export type TokenBucketOptions = {
  /** Maximum tokens held at once. Must be > 0. */
  capacity: number;
  /** Tokens added per millisecond. Must be >= 0. */
  refillPerMs: number;
  /** Starts full. Defaults to `capacity`. */
  initial?: number;
  clock?: Clock;
};

/**
 * Classic token bucket. Time is injected so tests do not sleep and production
 * code can pass a monotonic clock.
 */
export class TokenBucket {
  readonly capacity: number;
  readonly refillPerMs: number;
  private tokens: number;
  private updatedAt: number;
  private readonly clock: Clock;

  constructor(options: TokenBucketOptions) {
    if (!(options.capacity > 0) || !Number.isFinite(options.capacity)) {
      throw new Error("capacity must be a finite number > 0");
    }
    if (!(options.refillPerMs >= 0) || !Number.isFinite(options.refillPerMs)) {
      throw new Error("refillPerMs must be a finite number >= 0");
    }
    const initial = options.initial ?? options.capacity;
    if (!(initial >= 0) || initial > options.capacity || !Number.isFinite(initial)) {
      throw new Error("initial must be between 0 and capacity");
    }
    this.capacity = options.capacity;
    this.refillPerMs = options.refillPerMs;
    this.tokens = initial;
    this.clock = options.clock ?? Date.now;
    this.updatedAt = this.clock();
  }

  private sync(now: number) {
    if (!Number.isFinite(now)) throw new Error("now must be finite");
    if (now < this.updatedAt) {
      this.updatedAt = now;
      return;
    }
    const gained = (now - this.updatedAt) * this.refillPerMs;
    this.tokens = Math.min(this.capacity, this.tokens + gained);
    this.updatedAt = now;
  }

  remaining(now = this.clock()): number {
    this.sync(now);
    return this.tokens;
  }

  tryTake(cost = 1, now = this.clock()): boolean {
    if (!(cost > 0) || !Number.isFinite(cost)) {
      throw new Error("cost must be a finite number > 0");
    }
    this.sync(now);
    if (this.tokens < cost) return false;
    this.tokens -= cost;
    return true;
  }
}

export type SlidingWindowOptions = {
  /** Maximum events inside the window. Must be an integer > 0. */
  limit: number;
  /** Window length in milliseconds. Must be > 0. */
  windowMs: number;
  clock?: Clock;
};

/**
 * Sliding window counter. An event at exactly `now - windowMs` has expired.
 * The window is (now - windowMs, now].
 */
export class SlidingWindow {
  readonly limit: number;
  readonly windowMs: number;
  private readonly hits: number[] = [];
  private readonly clock: Clock;

  constructor(options: SlidingWindowOptions) {
    if (!Number.isInteger(options.limit) || !(options.limit > 0)) {
      throw new Error("limit must be an integer > 0");
    }
    if (!(options.windowMs > 0) || !Number.isFinite(options.windowMs)) {
      throw new Error("windowMs must be a finite number > 0");
    }
    this.limit = options.limit;
    this.windowMs = options.windowMs;
    this.clock = options.clock ?? Date.now;
  }

  private prune(now: number) {
    if (!Number.isFinite(now)) throw new Error("now must be finite");
    const cutoff = now - this.windowMs;
    while (this.hits.length > 0 && (this.hits[0] ?? 0) <= cutoff) this.hits.shift();
  }

  used(now = this.clock()): number {
    this.prune(now);
    return this.hits.length;
  }

  tryTake(now = this.clock()): boolean {
    this.prune(now);
    if (this.hits.length >= this.limit) return false;
    this.hits.push(now);
    return true;
  }
}
