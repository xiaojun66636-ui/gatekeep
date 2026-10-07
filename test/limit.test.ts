import assert from "node:assert/strict";
import { test } from "node:test";
import { SlidingWindow, TokenBucket } from "../src/limit.ts";

function clockOf(time: { now: number }) {
  return () => time.now;
}

test("token bucket starts full and refills on a straight line", () => {
  const time = { now: 1_000 };
  const bucket = new TokenBucket({
    capacity: 3,
    refillPerMs: 0.01,
    clock: clockOf(time),
  });
  assert.equal(bucket.tryTake(), true);
  assert.equal(bucket.tryTake(), true);
  assert.equal(bucket.tryTake(), true);
  assert.equal(bucket.tryTake(), false);

  time.now += 150;
  assert.equal(bucket.remaining(), 1.5);
  assert.equal(bucket.tryTake(), true);
  assert.equal(bucket.tryTake(), false);

  time.now += 10_000;
  assert.equal(bucket.remaining(), 3);
});

test("token bucket does not mint tokens when the clock jumps backward", () => {
  const time = { now: 500 };
  const bucket = new TokenBucket({
    capacity: 1000,
    refillPerMs: 1,
    initial: 0,
    clock: clockOf(time),
  });
  assert.equal(bucket.remaining(), 0);
  time.now = 100;
  assert.equal(bucket.remaining(), 0);
  time.now = 200;
  assert.ok(Math.abs(bucket.remaining() - 100) < 1e-9);
});

test("sliding window drops events on the boundary", () => {
  const time = { now: 0 };
  const window = new SlidingWindow({
    limit: 2,
    windowMs: 100,
    clock: clockOf(time),
  });
  assert.equal(window.tryTake(), true);
  time.now = 50;
  assert.equal(window.tryTake(), true);
  time.now = 90;
  assert.equal(window.tryTake(), false);
  time.now = 100;
  assert.equal(window.used(), 1);
  assert.equal(window.tryTake(), true);
  time.now = 150;
  assert.equal(window.used(), 1);
});

test("rejects bad limiter config", () => {
  assert.throws(() => new TokenBucket({ capacity: 0, refillPerMs: 1 }));
  assert.throws(() => new TokenBucket({ capacity: 1, refillPerMs: -1 }));
  assert.throws(() => new SlidingWindow({ limit: 1.5, windowMs: 10 }));
  assert.throws(() => new SlidingWindow({ limit: 1, windowMs: 0 }));
});
