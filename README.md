# gatekeep

Token bucket and sliding window. The clock is an argument, so tests never sleep.

## Use

```ts
import { SlidingWindow, TokenBucket } from "./src/limit.ts";

const bucket = new TokenBucket({
  capacity: 20,
  refillPerMs: 20 / 1000,
});

if (!bucket.tryTake()) {
  // not enough tokens
}

const window = new SlidingWindow({ limit: 5, windowMs: 10_000 });
window.tryTake();
```

Pass `now` into `tryTake` / `remaining` / `used`, or pass `clock` at construction. Production code can hand in `performance.now`. Tests hand in a mutable number.

## Design

**Token bucket.** Tokens accrue linearly as `(now - updatedAt) * refillPerMs`, capped at `capacity`. A backwards clock jump does not mint tokens. The timestamp is pinned to the new `now`, and refill starts again from there. `tryTake(cost)` is atomic: it either removes the whole cost or leaves the bucket alone.

**Sliding window.** Timestamps live in an ordered list. An event at exactly `now - windowMs` has expired, so the open interval is `(now - windowMs, now]`. `limit` events are allowed inside that window. This is the exact window, not a fixed-bucket approximation, and it keeps every timestamp. That is the right trade for small limits. Do not point it at millions of hits per second.

## Test

```bash
node --experimental-strip-types --test test/*.test.ts
```

## License

MIT
