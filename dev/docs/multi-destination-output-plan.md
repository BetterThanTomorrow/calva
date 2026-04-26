# Multi-Destination Output Plan

## Goal

After this change, each output category (`evalResults`, `evalOutput`, `otherOutput`) in `calva.outputDestinations` accepts either a single destination string or an array of destination strings. When an array is configured, the same output is written to all listed destinations simultaneously. Existing single-string configurations continue to work without migration.

### Design decisions

- **Empty array = silent.** An empty array `[]` means "no output" for that category. This enables power users to deliberately suppress a category.
- **Emit once.** The `emit()` / sink call (feeding `onOutputLogged` API subscribers) fires exactly once per evaluation, regardless of how many destinations are configured. Destinations are a display concern; the API event stream is a semantic concern.
- **Reveal first.** `showResultOutputDestination()` reveals only the first configured destination. Writing reaches all of them, but only one is forcefully revealed — revealing multiple would be disorienting.
- **`evaluationSendCodeToOutputWindow` stays unchanged.** It's orthogonal — it controls the evaluated *code* echo, not result/output routing.
- **`defaultDestinationConfiguration` stays as single strings.** The `package.json` defaults (`'terminal'`) override at runtime anyway.

## Prior Art in Codebase

- **Multi-destination writing:** `appendEvaluatedCode()` (`output.ts:356-417`) already deduplicates and loops over `[destination, ...additionalDestinations]` — this is the proven pattern.
- **`anyOf` schema:** `afterPrimaryReplConnectedCode` (`package.json:695`) uses `anyOf: [string, array-of-strings]` — same shape needed here, but with `enum` constraints on the strings.
- **Hard-coded dual destination:** `evaluate.ts:187-195` sends evaluated code to both `repl-window` and the configured `evalResults` destination. This stays as-is.

## Phases

### Phase 1: Types and normalization layer

Introduce the array-capable types and a normalization function. No behavior change — all existing code continues to receive single destinations.

- [ ] In `output.ts`, add a new type: `type OutputDestinationValue = OutputDestination | OutputDestination[]`
- [ ] Change `OutputDestinationConfiguration` fields from `OutputDestination` to `OutputDestinationValue`
- [ ] Add a normalization function:
  ```typescript
  export function normalizeDestinations(value: OutputDestinationValue): OutputDestination[] {
    return Array.isArray(value) ? [...new Set(value)] : [value];
  }
  ```
- [ ] Keep `getDestinationConfiguration()` returning the same shape — consumers still destructure it
- [ ] No new lint errors
- [ ] Unit tests pass
- [ ] TS watcher compiles cleanly (no behavior change — compilation is sufficient)

**What the system can do now:** Identical behavior to before. The new types and normalization function exist but aren't consumed yet.

---

### Phase 2: Unit tests for normalization and multi-destination dispatch

Write tests before changing behavior, so Phase 3 has a safety net.

- [ ] Create `src/extension-test/unit/output-destination-test.ts`
- [ ] Test `normalizeDestinations`:
  - Single string → `[string]`
  - Array with duplicates → deduplicated array
  - Empty array → `[]` (edge case to decide: should this fall back to default?)
- [ ] Test the multi-destination pattern: given an array of destinations, output reaches all of them (mock the writers)
- [ ] No new lint errors
- [ ] Unit tests pass (including new tests)

**What the system can do now:** Tests document the intended behavior of multi-destination routing before it exists.

---

### Phase 3: Lift the multi-destination pattern to all public append functions

The core behavior change. Each public append function normalizes its destination(s) and loops.

- [ ] Modify `appendClojureEval()` (`output.ts:424`): normalize `evalResults` → loop over destinations, calling `appendClojure()` for each
- [ ] Modify `appendClojureOther()` (`output.ts:435`): same pattern for `otherOutput`
- [ ] Modify `appendEvalOut()` (`output.ts:499`): same pattern for `evalOutput`
- [ ] Modify `appendEvalErr()` (`output.ts:525`): same pattern for `evalOutput`
- [ ] Modify `appendOtherOut()` (`output.ts:565`): same pattern for `otherOutput`
- [ ] Modify `appendOtherErr()` (`output.ts:594`): same pattern for `otherOutput`
- [ ] Modify `appendLineEvalOut()` (`output.ts:662`): same pattern for `evalOutput`
- [ ] Modify `appendLineEvalErr()` (`output.ts:681`): same pattern for `evalOutput`
- [ ] Modify `appendLineOtherOut()` (`output.ts:700`): same pattern for `otherOutput`
- [ ] Modify `appendLineOtherErr()` (`output.ts:722`): same pattern for `otherOutput`
- [ ] Handle `didLastOutputTerminateLine` per-destination within each loop (following the `appendEvaluatedCode` pattern)
- [ ] Ensure the `emit()` / sink call happens **once** per evaluation, not once per destination (avoid duplicate API subscriber events)
- [ ] `AfterAppendCallback` is called once (on the last destination in the loop), not per-destination
- [ ] No new lint errors
- [ ] Unit tests pass
- [ ] Integration tests pass

**What the system can do now:** The code supports arrays internally, but the config schema still only allows single strings. Single-string behavior is unchanged.

---

### Phase 4: Update `showResultOutputDestination()` for multi-destination

- [ ] Modify `showResultOutputDestination()` (`output.ts:193`): normalize `evalResults`, reveal the first destination only. If the user configured `["terminal", "repl-window"]`, reveal the terminal; the repl-window is written to but not forcefully revealed.
- [ ] No new lint errors
- [ ] Unit tests pass

**What the system can do now:** Result output destination reveal works correctly with arrays.

---

### Phase 5: Update consumer equality checks

All `=== 'repl-window'` and `!== 'repl-window'` checks need to become array-aware.

- [ ] `evaluate.ts:259` — `evalOutput !== 'repl-window'` → check if normalized array `.includes('repl-window')`
- [ ] `evaluate.ts:310` — same pattern
- [ ] `evaluate.ts:316` — `evalOutput === 'output-view'` → `.includes('output-view')`
- [ ] `evaluate.ts:734` — `evalOutput !== 'repl-window'` → `.includes()` check
- [ ] `evaluate.ts:190` — `evalResultsDestination !== 'repl-window'` in the `additionalDestinations` logic — needs careful review: the purpose is to avoid sending to repl-window twice. With arrays, this condition should check if `repl-window` is already in the configured destinations.
- [ ] `testRunner.ts:232-237` — `otherOutput` checks → normalize and use `.includes()`
- [ ] `repl-v1.ts:215` — `evalResults !== 'repl-window'` → `.includes()` check
- [ ] `repl-window-doc.ts:39-42` — JSON stringify comparison for legacy message → needs rethinking (compare against defaults that may now be arrays)
- [ ] `output.ts:238` — `evalOutput === 'repl-window'` in `maybePrintLegacyREPLWindowOutputMessage` → `.includes()`
- [ ] `output.ts:217` — `destinationSupportsAnsi` — this function takes a single destination; callers that now loop will pass individual destinations, so this should be fine as-is
- [ ] Integration test helpers: `jack-in-and-connect-test.ts:478`, `util.ts:438`, `load-file-test.ts:75` — update to array-aware checks
- [ ] `printStackTrace` switch statement (`output.ts:780-798`) — currently takes a single destination; callers need to loop and call per-destination
- [ ] No new lint errors
- [ ] Unit tests pass
- [ ] Integration tests pass

**What the system can do now:** All internal code correctly handles array destinations. Still single-string config schema.

---

### Phase 6: Update `package.json` schema and config reading

Open the door for users to configure arrays.

- [ ] Change each property in `calva.outputDestinations` from:
  ```json
  { "type": "string", "enum": [...] }
  ```
  to:
  ```json
  {
    "anyOf": [
      { "type": "string", "enum": ["repl-window", "output-channel", "terminal", "output-view"] },
      { "type": "array", "items": { "type": "string", "enum": ["repl-window", "output-channel", "terminal", "output-view"] } }
    ]
  }
  ```
- [ ] Update the `default` values — keep as single strings (`"terminal"`) for backward compatibility
- [ ] Update `markdownDescription` to mention array support
- [ ] `config.ts:256` — update the type parameter of `configOptions.get<>()` to use the new `OutputDestinationConfiguration` type (which now allows arrays)
- [ ] No new lint errors
- [ ] Unit tests pass
- [ ] Integration tests pass:
  - Single string config works as before
  - Array config routes to multiple destinations
  - Mixed config (some single, some array) works
  - Duplicate destinations in an array are deduplicated
  - VS Code settings UI shows the schema correctly

**What the system can do now:** Users can configure `"evalResults": ["terminal", "repl-window"]` and see output in both places.

---

### Phase 7: Documentation

- [ ] Review and update `docs/site/output.md` (or equivalent) to document array support
- [ ] Update the `markdownDescription` strings if not already done in Phase 6
- [ ] Review `docs/site/api.md` — the API's `onOutputLogged` should still emit once per evaluation, not per-destination. Confirm this is documented.
- [ ] No new lint errors
- [ ] Unit tests pass

---

## Original Plan-producing Prompt

Create an implementation plan for Calva GitHub issue #2819: "Make it possible to select several output destinations." The goal is to let each output category (`evalResults`, `evalOutput`, `otherOutput`) in `calva.outputDestinations` accept either a single destination string or an array of strings, routing output to all configured destinations simultaneously.

Context established before planning:
- `appendEvaluatedCode()` in `output.ts` already implements multi-destination writing with `additionalDestinations` — this is the proven pattern to lift to all append functions.
- `afterPrimaryReplConnectedCode` in `package.json` uses `anyOf: [string, array]` — this is the prior art for the schema shape.
- The hard-coded `evaluationSendCodeToOutputWindow` dual-destination logic in `evaluate.ts` is orthogonal and stays unchanged.
- There are ~20 `=== 'some-destination'` equality checks across `output.ts`, `evaluate.ts`, `testRunner.ts`, `repl-v1.ts`, `repl-window-doc.ts`, and integration test helpers that need to become array-aware.
- No dedicated unit tests exist for destination routing — they should be added before the behavior change.

Constraints: each phase must leave the system shippable. Use the existing `anyOf` schema pattern. Maintain full backward compatibility with single-string configs. The API event stream (`onOutputLogged`) must fire once per evaluation, not per-destination. Follow Calva's dev workflow (watchers, CHANGELOG, human testing in extension host).
