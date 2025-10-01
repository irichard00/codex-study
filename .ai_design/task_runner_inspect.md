TaskRunner.ts Inspection and Improvement Suggestions

Summary

- Purpose: Orchestrates multi-turn task execution, cancellation, and eventing, ported from codex-rs `run_task` into the browser extension runtime.
- Overall: Solid structure and separation with `TurnManager` handling per-turn streaming/tooling. However, several areas need tightening: type safety, consistent token/compaction logic, loop termination, review-mode history, and protocol/event consistency.

Key Strengths

- Clear lifecycle: emits TaskStarted/TaskComplete and funnels errors via Error events.
- Cancellation path exists (flag + `TurnManager.cancel()` + `cancelPromise` used in timeout race).
- Separation of concerns: per-turn logic in `TurnManager`; `TaskRunner` coordinates higher-level loop.
- Auto-compaction hook present and background event emitted on compaction.

Issues and Recommendations

1) Type Safety and Interfaces

- Issue: Heavy use of `any` for inputs/results (`runTurnWithTimeout`, `processTurnResult`, `build*TurnInput`, content items) makes behavior brittle and harder to test.
- Recommendation:
  - Import and use `TurnRunResult` and `ProcessedResponseItem` from `TurnManager`.
  - Define narrow interfaces for conversation items and the turn input shape (reusing the protocol types in `../protocol/types`).
  - Replace `any[]` with concrete union types for message content (text/image/tool call, etc.).

2) Loop Termination and Max Turns

- Issue: `run()` has an unbounded `while (!this.cancelled)` loop; only `executeWithCoordination()` enforces `MAX_TURNS`.
- Recommendation:
  - Enforce `MAX_TURNS` inside `run()` as a guardrail and surface an automatic abort when exceeded (`TurnAborted` with reason `automatic_abort` and a message/event explaining max turns reached).
  - Consider using `isTaskComplete()` or remove it if unused; right now it’s dead code.

3) Cancellation and Timeout Cleanup

- Issue: `runTurnWithTimeout()` uses `Promise.race` with `setTimeout` but doesn’t clear the timer when the turn finishes, leading to stray timers.
- Recommendation:
  - Store the timeout handle and clear it in a `finally` to avoid dangling timers.
  - Also race on the `AbortSignal` passed to `executeWithCoordination()` rather than only `this.cancelPromise`.

4) Token Usage and Auto-Compaction Consistency

- Issue: Two thresholds are used inconsistently: `processTurnResult` flags limit at 90% of context window, while `shouldAutoCompact` uses `COMPACTION_THRESHOLD` (75%). `run()` tracks `autoCompactAttempted` once, while `executeWithCoordination()` checks `shouldAutoCompact` each loop.
- Recommendation:
  - Source the threshold from a single constant (`COMPACTION_THRESHOLD`) and use it in both places.
  - Decide on one policy: either compact once per task when threshold crossed, or compact opportunistically per turn; implement consistently across both run paths.
  - Include token usage deltas in events so clients can make UI decisions.

5) Review Mode Context and History Handling

- Issues:
  - `buildInitialReviewContext()` is minimal (just working directory). The Rust path often seeds richer system context (tools enabled, limits, model, policies).
  - In `executeWithCoordination()`, `buildReviewTurnInput([], pendingInput)` discards accumulated review history, unlike `run()` which maintains `reviewThreadHistory` across turns.
  - `convertInputToResponseItem()` duplicates logic that exists in `Session.convertInputToResponse` and uses textual placeholders for `context` which may drop useful metadata.
- Recommendations:
  - Delegate format conversion to `Session` (single source) and extend review context to include model, tools, approval/sandbox policy, token window.
  - In `executeWithCoordination()`, maintain and pass the same `reviewHistory` array across turns, mirroring `run()`.
  - Consider recording review mode items into a separate, isolated in-memory thread object (or a namespaced history) to support audits and snapshot tests.

6) Event Protocol Fidelity and Richness

- Issues:
  - Importing `TaskStartedEvent`, `TaskCompleteEvent` types but not using them; events are loosely shaped.
  - `TaskComplete` event only carries `last_agent_message`; missing useful fields (turns, token usage, compaction actions, aborted=false flag).
  - `BackgroundEvent` is used during compaction — ensure it is part of the current `EventMsg` union.
- Recommendations:
  - Use typed constructors or helper functions for events to guarantee schema correctness.
  - Enhance `TaskStarted` with model, tools enabled, sandbox/approval policy, and context window.
  - Enhance `TaskComplete` with: `turns`, `token_usage` summary, and whether compaction occurred.
  - When auto-compaction fails, emit a structured warning event instead of only `console.warn`.

7) Error Handling and Retry Semantics

- Issue: `handleTurnError()` uses a coarse retry decision (`stream/network/timeout` substrings). `TurnManager` already implements retries and emits `StreamError` events.
- Recommendations:
  - Let `TurnManager` own retry semantics; in `TaskRunner`, treat thrown errors as terminal unless an explicit “retryable turn” contract exists.
  - If retaining `handleTurnError`, cap total task-level retries and emit structured events with backoff plan.

8) Concurrency and State Ownership

- Issue: `TaskRunner` stores per-submission state in `this.tasks`. This couples a single runner instance to multiple concurrent tasks and complicates lifecycle.
- Recommendations:
  - Either make `TaskRunner` single-task (one submission per instance) and drop the tasks map, or move multi-task tracking into a higher-level coordinator/service.
  - If multi-task support is required here, guard the `tasks` map with clear creation/cleanup and disallow calling `run()` and `executeWithCoordination()` concurrently on the same instance.

9) Import Hygiene and Dead Code Cleanup

- Issues: `uuidv4` and specific event types (`TaskStartedEvent`, `TaskCompleteEvent`, etc.) are imported but unused. `isTaskComplete()` is currently unused.
- Recommendations: Remove unused imports and dead code to keep the module lean.

10) Testability and Suggested Tests

- Unit tests for:
  - Cancellation: cancel before, during, and after a turn; ensure proper events and no stray timers.
  - Auto-compact: verify compaction is triggered once at the threshold and corresponding events emitted.
  - Review mode: verify history accumulation across multiple turns and that normal mode persists via `Session`.
  - Event payloads: schema conformance for `TaskStarted`, `TaskComplete`, `TurnAborted`, and compaction events.
  - Max turns: verify automatic abort and event are produced at limit.

Concrete Implementation Tips

- `run()` guard:
  - Track `turnCount` and break with `emitAbortedEvent('automatic_abort')` when `turnCount >= MAX_TURNS`.

- `runTurnWithTimeout()` cleanup:
  - Example pattern: create a promise that clears timeout in `finally` to avoid leaking timers; also race on an `AbortSignal` passed in.

- Token threshold unification:
  - Replace the `0.9` literal in `processTurnResult` with `COMPACTION_THRESHOLD`.
  - Record whether compaction happened to include in `TaskComplete`.

- Review history in `executeWithCoordination()`:
  - Mirror the `run()` pattern: build initial review context once, append items across turns, and pass it into `processTurnResult`.

- Event helpers:
  - Add small helpers like `emitTaskStarted(...)`, `emitTaskComplete({...})`, `emitWarning(message)` to keep payloads consistent and typed.

Observed Parity with codex-rs `run_task`

- Comparable responsibilities: start event, loop over turns, process items, support cancellation, and attempt compaction near window limits.
- Gaps likely vs Rust:
  - Richer review/isolated context seeding and consistent history handling.
  - Strict max-turns enforcement at the task level.
  - More structured task completion payload (turns, usage, outcomes) and standardized event typing.
  - Centralized error/retry semantics (Rust splits `run_task` vs `run_turn` cleanly — keep that separation; don’t retry in both layers).

Quick Wins Checklist

- Remove unused imports and the unused `isTaskComplete()`.
- Import and use `TurnRunResult`/`ProcessedResponseItem` types.
- Enforce `MAX_TURNS` in `run()`; emit `automatic_abort` when exceeded.
- Clear timeout handles in `runTurnWithTimeout()`.
- Use a single `COMPACTION_THRESHOLD` across both code paths.
- Keep consistent review history in `executeWithCoordination()`.
- Expand `TaskComplete` to include turn count and token usage if available.

Potential Future Enhancements

- Expose a pluggable policy for compaction (e.g., summarization frequency/strategy).
- Add telemetry hooks (task duration, per-turn latency, tool usage counts) for UI visualization.
- Support resumable tasks by persisting intermediate state across extension reloads.

