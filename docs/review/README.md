# Independent Pull-Request Review Contract

This document is the canonical owner of the provider-neutral contract for independent AI pull-request review in Agentic Workspace. It defines how review policy is represented, evaluated, reported, calibrated, and maintained.

Repository architecture, implementation, and workflow requirements outside the independent-review lifecycle remain owned by the applicable root or nested `AGENTS.md`, `docs/engineering/`, specifications, and other repository-local sources. Review rules point to those sources; they do not replace them. The independent-review merge lifecycle is owned by this document. Provider settings may only route a reviewer to this repository-owned contract and must not contain a second policy catalog.

## Scope

Independent review applies to every code-changing pull request. It is performed by a reviewer separate from the implementation agent and does not replace implementer self-review or deterministic CI.

Independent review also applies to pull requests that change repository review policy or review routing, even when they do not change executable code.

A review conclusion is valid only for the exact pull-request head revision that was reviewed. A new relevant commit requires a new review conclusion for the new head.

This contract does not define a provider integration, GitHub event or comment representation, CI gate, initial rule catalog, or model prompt. Those mechanisms may be added separately without changing the provider-neutral rule semantics defined here.

## Merge workflow

For every exact pull-request head subject to independent review, the required lifecycle is ordered:

1. the implementation agent MUST complete its own self-review; self-review does not satisfy the independent-review requirement;
2. deterministic repository CI for that exact current head MUST be green before independent review is intentionally requested or triggered;
3. only after deterministic CI is green, the independent review MUST be requested using the proven provider mechanism;
4. the exact current pull-request head MUST have a clean independent-review result under this contract;
5. only then may the pull request be merged.

An unresolved, non-outdated blocking `POLICY` or `CORRECTNESS` finding prevents a clean result and therefore prevents merge.

Any relevant new commit invalidates the prior independent-review conclusion and restarts the ordered lifecycle for the new head. Deterministic CI for that new head MUST become green before another independent-review request is made.

Provider configuration SHOULD avoid automatically starting independent review on pull-request creation when the provider supports a manual post-CI trigger without adding brittle repository automation or separate metered review infrastructure. A review started before deterministic CI is green does not satisfy the required post-CI independent review; after CI becomes green for that same head, the workflow MUST request a fresh review using the proven provider mechanism.

Provider-specific evidence owns only the proven mechanism for obtaining and recognizing the independent-review conclusion. When the configured provider has not demonstrated automatic re-review after a new commit, the merge workflow MUST explicitly request a new review after deterministic CI is green and wait for the completed current-head result. A missing machine-enforced review-state gate does not waive these requirements.

## Normative language

- **MUST** and **MUST NOT** define mandatory behavior.
- **SHOULD** defines the expected behavior; a deviation requires a concrete repository-specific reason.
- **MAY** defines permitted optional behavior.

## Review finding classes

Independent review distinguishes three classes of output.

### Policy finding

A `POLICY` finding reports that an applicable repository-owned review rule has the `violation` outcome.

A policy finding MUST contain:

- `type: POLICY`;
- the rule's stable `rule_id`;
- the rule's declared `severity`;
- an affected repository location, or an explicit pull-request-level location when no narrower location exists;
- concrete evidence from the reviewed change and relevant repository context.

A policy finding MUST NOT infer a requirement that is absent from the referenced rule and canonical source. A blocking policy finding is valid only when all evidence required by the rule is present.

### Uncatalogued correctness finding

A `CORRECTNESS` finding reports a concrete defect introduced or exposed by the pull request for which no current policy rule is the right owner. This path keeps the catalog bounded without preventing the reviewer from reporting genuine defects.

A correctness finding MUST contain:

- `type: CORRECTNESS`;
- `severity: blocking` or `severity: advisory`;
- an affected repository location;
- concrete evidence from the reviewed change and relevant repository context;
- a causal explanation connecting the change to the defect;
- the observable incorrect outcome or failure consequence.

A correctness finding MAY block a pull request only when that evidence establishes a real defect and consequence. Suspicion, a hypothetical future requirement, generic risk language, or inability to prove correctness is not a blocking correctness finding.

If the same correctness finding recurs and can be expressed as a stable policy boundary, it SHOULD be considered for a repository rule. If it can be checked deterministically, it follows the deterministic-promotion lifecycle instead.

### Non-blocking opinion

Taste, preference, optional cleanup, unsupported style advice, and hypothetical future architecture are non-blocking opinions. They MUST NOT be presented as policy or correctness violations unless an explicit repository-owned requirement makes them normative and the required evidence is present.

An opinion MAY be reported as `OPINION` when it provides concrete value, but it does not affect the review result and does not require a change.

## Atomic review-rule contract

Each policy rule represents one bounded decision. A rule MUST be stored in the repository, remain provider-neutral, and define all of the following fields:

| Field | Contract |
| --- | --- |
| `id` | Stable, unique identifier. It MUST NOT be reassigned to a different decision after removal or replacement. |
| `title` | Concise description of the single responsibility being checked. |
| `scope` | Repository paths and/or change kinds the rule can govern, including exclusions needed to avoid ambiguous ownership. |
| `applies_when` | Observable conditions that make the rule applicable to the reviewed change. |
| `violation` | Observable conditions that produce the `violation` decision. |
| `non_violation` | Explicit boundary conditions that are similar or adjacent but MUST NOT be reported as violations. |
| `severity` | Exactly `blocking` or `advisory`, with the semantics defined below. |
| `evidence` | Minimum concrete evidence a finding must cite. |
| `canonical_source` | Existing repository-local path, with a section or rule identifier when needed, that owns the underlying requirement. |

Free-form guidance that cannot populate these fields unambiguously is not a policy rule. One rule MUST NOT combine unrelated requirements merely because they share a source file or repository area.

The canonical source owns the underlying engineering or product requirement. The review rule owns only its review decision boundary. If the rule and its canonical source disagree, the rule MUST be corrected or removed; provider configuration MUST NOT resolve the disagreement through hidden instructions.

Stable IDs survive wording and boundary clarifications when the rule still represents the same responsibility. Splitting a rule or changing it to govern a different responsibility requires new IDs, and retired IDs MUST NOT be reused.

### Canonical-source resolution

Mechanical catalog validation checks the repository-local file portion of `canonical_source`. An optional `#fragment` is a reviewer navigation hint and is intentionally not parsed or validated by `review:validate`.

Before relying on a selected rule, the reviewer MUST open the canonical source in the current repository revision and resolve any referenced section or rule identifier. If the referenced file or section cannot be located unambiguously, or if the canonical source contradicts the review rule, the reviewer MUST stop the independent review and report a review-policy integrity error. This is a review precondition failure, not a fourth review-finding class.

The reviewer MUST NOT guess the missing requirement, silently substitute another section, or produce a clean independent-review result until the policy-integrity problem is corrected.

## Decision model

The reviewer evaluates every applicable policy rule with exactly one of these outcomes:

1. `not-applicable` — the change is outside `scope` or does not satisfy `applies_when`;
2. `violation` — the rule applies, the `violation` condition is satisfied, and all required `evidence` is present;
3. `no-violation` — the rule applies, but the `violation` condition is not satisfied, including the rule's explicit `non_violation` boundary.

Applicability is decided before violation. A reviewer MUST NOT report `violation` for an out-of-scope change. When the evidence required for a violation is absent, the reviewer MUST NOT create a blocking policy finding from inference or uncertainty.

`not-applicable` and `no-violation` are decision results, not findings. They MAY be recorded for calibration or review-state evidence but do not require a pull-request comment.

## Severity and blocking behavior

Allowed rule severities are:

- `blocking` — a calibrated violation prevents a clean independent-review result and requires resolution before merge;
- `advisory` — a violation may be reported but does not prevent a clean independent-review result.

A rule may use `blocking` only for a concrete repository requirement with an explicit applicability, violation, non-violation, and evidence boundary. Subjective quality goals and taste-based guidance cannot be blocking.

A blocking policy finding MUST reference a `blocking` rule and satisfy that rule's evidence contract. An advisory rule MUST NOT produce a blocking finding. A `CORRECTNESS` finding may block only under the stricter causal-evidence requirements defined above. `OPINION` never blocks.

A pull request has a clean independent-review result when the reviewed head has no valid blocking `POLICY` or `CORRECTNESS` findings and no unresolved review-policy integrity error. The provider-specific representation of that state is intentionally outside this contract.

## Deterministic-check ownership

Lint, typecheck, tests, build, E2E, Nx consistency checks, and other deterministic CI remain the owners of behavior they already enforce. When those checks execute normally and are green, the AI reviewer MUST NOT restate their covered failures as policy findings.

The reviewer MAY evaluate a deterministic enforcement mechanism when the pull request changes that mechanism itself, including its rules, configuration, tests, scripts, or workflow. The reviewer MAY also report a concrete correctness defect that deterministic checks do not cover, but green CI alone is not evidence of such a defect.

When an AI finding is repeatedly reducible to a deterministic assertion, ownership SHOULD move to the narrowest appropriate lint rule, type constraint, test, build check, or CI check. The AI rule is then removed under the promotion lifecycle below.

## Calibration contract

Every proposed blocking rule MUST have controlled, repository-versioned calibration cases before it can become active:

- at least one known-violation case whose expected outcome is `violation`;
- at least one boundary case whose expected outcome is `no-violation` or `not-applicable`.

Each case MUST include the smallest diff and repository context needed to decide the rule and MUST state its expected outcome. Calibration cases test the rule boundary; they are not production examples and MUST NOT require deliberate violations to remain in production code.

Accepted calibration evidence MUST isolate the semantic boundary being evaluated. A deliberate known-violation case MAY violate its target AI rule, but the fixture MUST remain valid under unrelated deterministic repository checks and dependency/convention boundaries. Reviewer results from a fixture with unrelated lint, typecheck, test, build, or dependency failures MUST NOT count as calibration evidence until those unrelated failures are corrected.

Before a blocking rule is relied on by the merge workflow, the intended reviewer MUST classify the known-violation case as `violation` in at least two **independent evaluator trials** with unchanged rule semantics and case context. Every committed boundary case MUST also be reviewed as its exact controlled case and MUST produce a clean independent-review result with no valid blocking `POLICY` or `CORRECTNESS` finding for that reviewed head.

The case's declared `expected` value remains part of the provider-neutral three-outcome decision model. When the provider exposes an explicit `not-applicable` or `no-violation` classification for a clean boundary trial, that classification MUST match the declared expected outcome. When the provider exposes only a clean result and does not publish the clean subtype, the clean result is sufficient evidence that the boundary does not produce a blocking finding, but it MUST NOT be recorded as proof of an unobserved internal `not-applicable` or `no-violation` decision. Provider-specific evidence MUST state this limitation explicitly.

An independent evaluator trial MUST start from a review context that does not expose a prior classification or finding for that calibration case when those artifacts could influence, suppress, or deduplicate the next evaluation. When an integration retains prior review history inside the evaluator's context, repeated trials MUST use fresh isolated review contexts. Provider- or infrastructure-only identifiers such as pull-request number or commit SHA MAY differ between trials, but the rule version, base repository revision, declared task context, and calibration diff semantics MUST remain equivalent.

Re-triggering a reviewer inside the same already-annotated context does not count as an independent calibration repeat unless the integration has demonstrated that prior findings and classifications cannot influence or suppress the new evaluation. Such re-reviews MAY still be used as provider-lifecycle evidence.

Contradictory explicit applicability or violation decisions across independent evaluator trials require the rule to be clarified and recalibrated or downgraded to `advisory`. A blocking finding produced for a committed boundary case also contradicts that rule's declared boundary and requires clarification/recalibration or downgrade.

A semantic change to `scope`, `applies_when`, `violation`, `non_violation`, `severity`, required `evidence`, or the meaning inherited from `canonical_source` invalidates prior calibration and requires the affected cases to be revalidated. Editorial changes that do not change the decision boundary do not require recalibration.

Calibration validates a rule against controlled cases. It does not make model output deterministic and does not belong in normal CI as a permanent LLM invocation.

## Rule lifecycle

### Add

A new rule is introduced through normal pull-request review. The change MUST:

1. identify an existing repository-owned canonical source;
2. show that deterministic tooling does not already own the same check;
3. define one atomic rule using every required field;
4. include the calibration coverage required by its severity;
5. pass mechanical catalog validation when that validation exists;
6. complete reviewer calibration before a blocking rule is relied on by the merge workflow.

A provider-local instruction or a finding observed only once is not sufficient to create a rule.

### Change

Rule changes use normal pull-request review. A change MUST preserve the stable ID only while the same responsibility remains. Semantic changes MUST update affected calibration cases and repeat calibration before the changed blocking boundary is relied on.

If a canonical source changes or disappears, dependent rules MUST be reviewed in the same change or a prerequisite change. A rule MUST NOT remain active with a missing or contradictory canonical source.

### Promote to deterministic enforcement

When a repeated AI finding can be checked deterministically:

1. add the check at the narrowest owning boundary;
2. add evidence that the check fails for the violation and passes for its boundary case;
3. enable the check in the normal repository verification path;
4. remove or retire the overlapping AI rule once deterministic enforcement is active;
5. preserve the underlying requirement in its canonical source.

Temporary overlap is allowed only within the promotion change needed to prove the deterministic replacement. Normal review MUST NOT retain two active owners for the same check.

### Downgrade or remove

A blocking rule MUST be downgraded to `advisory` when its decision boundary cannot be made reliable enough to satisfy calibration. A rule MUST be removed when its underlying requirement is removed, its canonical source no longer supports it, or deterministic enforcement takes ownership.

Removal does not authorize reuse of the stable ID. Repository history remains the record of retired rules and prior findings.

## Active catalog

Active policy rules are stored as one JSON file per rule under `docs/review/rules/`. Active catalog IDs use the stable `PRR-NNN` format. A rule file is named `<id>.json` and contains exactly the fields defined by the atomic review-rule contract. Calibration cases are stored in the matching `docs/review/calibration/<id>.json` file so rule definitions remain provider-neutral and do not acquire test-only fields.

Run the dependency-free catalog validator from the repository root:

```bash
pnpm review:validate
```

The command validates the validator's negative cases and then the committed catalog. It mechanically checks canonical-source file paths but intentionally does not parse optional `#fragment` anchors; those are resolved by the reviewer under the canonical-source resolution contract above. It performs no LLM call.

### Initial rule inventory

The initial catalog deliberately contains only these high-signal decisions:

| Rule | Concern | Canonical source | Why AI review owns it |
| --- | --- | --- | --- |
| `PRR-001` | A coherent change is unrelated to the declared task scope. | `AGENTS.md#12-change-discipline` | Determining whether a diff is causally required by a task needs semantic comparison of the task and change; path, type, lint, and test checks cannot establish that relationship. |
| `PRR-002` | A scoped instruction file becomes a second owner of reusable guidance. | `AGENTS.md#workspace-agent-rules` | The problem is semantic duplication of ownership, including paraphrases; exact-text or link validation cannot distinguish it from valid routing and local constraints. |
| `PRR-003` | A service test repeats semantics owned by a consumed boundary. | `docs/engineering/service-guidelines.md#testing-ownership` | Existing test runners can execute the test but cannot decide whether its assertions prove service-owned behavior or merely restate EDP/package/runtime behavior. |
| `PRR-004` | A service reconstructs EDP or shared execution-runtime behavior. | `docs/engineering/service-guidelines.md#shared-edp-runtime-consumption` | ESLint enforces import direction, not semantic reimplementation through locally named wrappers, providers, policies, or stores. |
| `PRR-005` | Generator behavior changes while its canonical README retains a false contract. | `tools/generators/README.md` | CI can run generators but does not semantically compare their commands/output contract with the prose developers consume. |

The catalog does not reproduce Nx project boundaries, service-layer import restrictions, type checking, build behavior, test execution, E2E behavior, or `nx sync:check`; normal deterministic CI already owns those checks.

## Provider integration evidence

Provider-specific setup and empirically observed GitHub behavior are recorded in [`docs/review/codex-integration.md`](codex-integration.md). Current provider-specific trigger guidance that implements the ordered lifecycle above is recorded in [`docs/review/codex-triggering.md`](codex-triggering.md). Neither document redefines this contract or the provider-neutral rule semantics.

## Reviewer procedure

For the exact pull-request head under review, an independent reviewer MUST:

1. inspect the changed files and the repository context needed to understand them;
2. select rules by `scope`;
3. resolve each selected rule's `canonical_source` under the canonical-source resolution contract above;
4. decide `applies_when` before evaluating violations;
5. apply the three-outcome decision model and require each rule's declared evidence;
6. avoid duplicating normally executing green deterministic checks;
7. separately evaluate concrete uncatalogued correctness defects;
8. distinguish optional opinions from findings;
9. report only evidence-supported policy and correctness findings using the formats above;
10. produce a clean result only when no blocking finding remains for that head and no review-policy integrity error prevents completion.

The reviewer MUST NOT modify the pull request, invent repository requirements, or turn uncertainty into a blocking result.

## Contract ownership

Changes to this contract and to repository review policy follow the normal task, pull-request, and CI process. Once the independent reviewer is integrated, review-policy changes also require independent review of the current pull-request head. Active rules SHOULD remain a small, current set of high-signal decisions rather than a copy of all repository documentation.

`AGENTS.md` files may route reviewers to this document and applicable canonical sources, but they MUST NOT duplicate this contract or the policy catalog. Provider-specific setup may do the same and MUST NOT become an alternative policy owner.
