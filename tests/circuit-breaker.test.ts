import { describe, it, expect } from "vitest";
import {
  updateCircuitBreaker,
  type CircuitBreakerState,
} from "../src/shokyaku/repl.js";

const closed: CircuitBreakerState = { consecutiveFailures: 0, open: false };

describe("updateCircuitBreaker", () => {
  it("resets on non-degraded result", () => {
    const state = { consecutiveFailures: 2, open: false };
    const result = updateCircuitBreaker(state, false, undefined);
    expect(result).toEqual(closed);
  });

  it("resets when degraded but not a codex failure", () => {
    const state = { consecutiveFailures: 2, open: false };
    const result = updateCircuitBreaker(state, true, "claude:EXIT_CODE");
    expect(result).toEqual(closed);
  });

  it("increments on codex failure", () => {
    const result = updateCircuitBreaker(closed, true, "codex:TIMEOUT");
    expect(result.consecutiveFailures).toBe(1);
    expect(result.open).toBe(false);
  });

  it("opens after 3 consecutive codex failures", () => {
    let state: CircuitBreakerState = closed;
    for (let i = 0; i < 3; i++) {
      state = updateCircuitBreaker(state, true, "codex:EXIT_CODE");
    }
    expect(state.consecutiveFailures).toBe(3);
    expect(state.open).toBe(true);
  });

  it("opens after 2 failures with custom maxFailures=2", () => {
    let state: CircuitBreakerState = closed;
    state = updateCircuitBreaker(state, true, "codex:ENOENT", 2);
    expect(state.open).toBe(false);
    state = updateCircuitBreaker(state, true, "codex:ENOENT", 2);
    expect(state.open).toBe(true);
  });

  it("resets after a success following failures", () => {
    let state: CircuitBreakerState = closed;
    state = updateCircuitBreaker(state, true, "codex:TIMEOUT");
    state = updateCircuitBreaker(state, true, "codex:TIMEOUT");
    expect(state.consecutiveFailures).toBe(2);

    state = updateCircuitBreaker(state, false, undefined);
    expect(state).toEqual(closed);
  });
});
