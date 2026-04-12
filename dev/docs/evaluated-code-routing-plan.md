# Evaluated Code Routing Plan

## Goal

After this change, Calva treats evaluated code as a semantic event separate from visible output routing. API v1 subscribers to `repl.onOutputLogged()` always receive exactly one `evaluatedCode` message per evaluation, regardless of `calva.evaluationSendCodeToOutputWindow`. API v1 shows evaluated code in the configured eval-results destination and does not use the REPL Window as a default echo target. Manual/UI evaluations can still retain REPL-oriented echo behavior. The setting is no longer the API v1 visibility switch; it becomes a manual/UI echo concern. Scope: API v1 and the shared evaluated-code routing path. API v0 is out of scope, and deprecated `repl.evaluateCode()` is only a mechanical follow-up if the shared implementation makes that the lowest-risk option.

## Verified Constraints

- Direct REPL Window writes bypass the API sink; only routed output reaches `repl.onOutputLogged()` subscribers.
- The `evaluatedCode` category already exists in the output router and API v1 type surface.
- `src/evaluate.ts` currently mixes direct REPL Window writes with conditional routed mirroring.
- `src/api/repl-v1.ts` currently uses `calva.evaluationSendCodeToOutputWindow` as the gate for evaluated-code routing.
- There is no focused automated coverage for exactly-once `evaluatedCode` sink behavior today.

## Phases

### Phase 1: Extract an Evaluated-Code Routing Primitive

Create one internal path that can emit evaluated code once to subscribers and then fan out to caller-selected visible destinations without double-emitting. This phase is internal only and should not change user-visible behavior yet.

- [ ] Add a dedicated helper in `src/results-output/output.ts` for evaluated code instead of further overloading `appendClojureEval`
- [ ] Split sink emission from destination-specific writes just enough to support one subscriber event and caller-controlled visible writes
- [ ] Preserve `evaluatedCode`, `who`, `ns`, and `replSessionKey` metadata end to end
- [ ] Add unit coverage for category preservation and the one-emit rule
- [ ] No new lint errors
- [ ] Relevant unit tests pass

**What the system can do now:** The shared output layer can represent the desired evaluated-code semantics without changing caller behavior yet.

---

### Phase 2: Adopt the Helper in API v1

Make `repl.evaluate()` the first caller to use the new primitive. This establishes the API contract before the manual UI path adopts the same plumbing.

- [ ] Replace the evaluated-code block in `src/api/repl-v1.ts` with one unconditional evaluated-code sink emission
- [ ] Make API v1 route visible evaluated code to the configured eval-results destination independently of `calva.evaluationSendCodeToOutputWindow`
- [ ] Ensure API v1 does not automatically echo evaluated code to the REPL Window
- [ ] Add integration coverage for API v1 with settings on and off, confirming the sink event and destination-visible behavior are unchanged across setting values
- [ ] No new lint errors
- [ ] Relevant unit and integration tests pass
- [ ] Manually verify `repl.onOutputLogged()` receives one `evaluatedCode` message per evaluation and that the visible copy appears once in the configured eval-results destination

**What the system can do now:** API v1 subscribers see exactly one evaluated-code event per evaluation, and API-triggered visible code appears in the configured eval-results destination without REPL Window echo.

---

### Phase 3: Adopt the Primitive in Manual Evaluation

Reuse the same primitive in the manual evaluation path without forcing API v1 visibility policy onto manual/UI behavior. Keep the existing REPL-oriented overrides intact.

- [ ] Replace the direct REPL Window write plus conditional mirror in `src/evaluate.ts` with the shared helper
- [ ] Preserve manual/UI REPL echo behavior as a separate policy from API v1 destination-visible routing
- [ ] Keep per-call overrides from snippets, hover, and REPL-window self-evaluation working
- [ ] Ensure evaluating from the REPL Window suppresses only the extra REPL append, not the sink event or the non-REPL eval-results copy
- [ ] Add integration coverage for evaluation from a normal editor and from the REPL Window
- [ ] No new lint errors
- [ ] Relevant unit and integration tests pass
- [ ] Manually verify there is no duplicate visible code in the REPL Window

**What the system can do now:** API v1 and manual evaluation share one evaluated-code routing primitive while intentionally keeping different visible-output policies.

---

### Phase 4: Align Configuration and Documentation

Once behavior is stable, align the setting, docs, and user-visible naming so the contract is legible.

- [ ] Update `package.json` setting text and any related command title so the setting clearly means manual/UI REPL echo behavior rather than API v1 output routing
- [ ] Apply the chosen default value for `calva.evaluationSendCodeToOutputWindow`
- [ ] Update `docs/site/api.md` to state that `evaluatedCode` always reaches `repl.onOutputLogged()` exactly once and that API v1 visible code routes to the configured eval-results destination
- [ ] Review `docs/site/custom-commands.md`, `docs/site/output.md`, and `docs/site/repl-window.md` for wording that assumes the old behavior, and update as needed
- [ ] No new lint errors
- [ ] Relevant unit and integration tests pass

**What the system can do now:** The code, setting text, and docs describe the same behavior.

---

## Open Questions / Assumptions

- `ASSUMPTION:` API v1 `onOutputLogged()` should expose evaluated code as a semantic event independent of visible routing choices.
- `ASSUMPTION:` API v1 should always route visible evaluated code to the configured eval-results destination, regardless of `calva.evaluationSendCodeToOutputWindow`.
- `ASSUMPTION:` The sink should continue to receive the code text once per evaluation, not one event per visible destination.
- `OPEN QUESTION:` Should deprecated `repl.evaluateCode()` be mechanically aligned in the same change to avoid two behaviors inside `src/api/repl-v1.ts`, or can it intentionally lag behind the API v1 contract work?
- `OPEN QUESTION:` Should evaluated-code sink text preserve the current leading-newline behavior from the output router, or be normalized to the raw code string?

## Original Plan-producing Prompt

Write a markdown implementation plan for Calva to change evaluated-code routing semantics. Scope is API v1 and the shared evaluated-code routing path only; ignore API v0, and treat deprecated `repl.evaluateCode()` as an optional mechanical follow-up rather than a product concern. The desired behavior is: (1) evaluated code always reaches the API output log sink (`repl.onOutputLogged()`) once and exactly once, regardless of `calva.evaluationSendCodeToOutputWindow`; (2) API v1 routes visible evaluated code to the configured eval-results destination and does not use the REPL Window as its default echo target; (3) manual/UI evaluation can retain REPL-oriented echo behavior; (4) direct REPL Window writes must not create duplicate sink events. Base the plan on the current code in `src/api/repl-v1.ts`, `src/evaluate.ts`, `src/results-output/output.ts`, the setting declaration in `package.json`, and the current API docs in `docs/site/api.md`. Include safe, shippable phases, concrete test and validation steps, the relevant documentation follow-up, and any explicit assumptions or open questions that should be resolved before implementation.
