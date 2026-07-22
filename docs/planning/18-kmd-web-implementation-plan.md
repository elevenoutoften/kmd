# kmd-web Implementation Plan

Status: execution baseline. Created: 2026-07-22.

Companion: [kmd ecosystem North Star](17-kmd-ecosystem-north-star.md).

This document describes how to reach the North Star. Flow project `kmd-web` is
the source of truth for task status, assignment and dependencies. The stable
work-item keys below are mirrored in Flow titles so plans, commits and reviews
remain traceable even if Flow IDs change.

Flow project: `kmd-web`. Initial task set: `KWEB-001` through `KWEB-028`
(`flow_000989` through `flow_001016`), created with 55 blocking links.

## Execution rules

- One implementing agent owns one Flow task at a time.
- Read every blocking task's handoff before starting.
- Do not combine tasks merely because they are adjacent in this plan.
- A task is complete only when every acceptance criterion passes and the
  evidence is recorded in its Flow completion note.
- Security changes include malicious fixtures.
- UI changes include desktop and narrow-width visual evidence.
- Package changes include a package-contents check and size observation.
- Keep existing `kmd` and `kmd-ios` behavior working throughout migration.
- Delete copied downstream code only after package-backed parity is proven.
- If an acceptance criterion cannot be met, leave the task out of `done`, post
  the exact blocker and hand off the partial work.
- GitHub, npm, deployment, and release tasks are agent-owned when the assigned
  agent has access. Set `human_required` only after a real permission, 2FA,
  secret, billing, or UI-only blocker is encountered. The human handoff must be
  one exact action (one or two commands/clicks maximum) plus one verification;
  the agent resumes the main task afterward.

## Status policy

- `todo`: unblocked work that another agent may claim now.
- `backlog`: designed work that is blocked by linked dependencies or deliberately
  deferred to a later release.
- `doing`: claimed and actively implemented.
- `review`: implementation finished; independent acceptance review required.
- `done`: accepted with recorded verification.

Flow blocking links enforce sequencing. Completing a blocking parent may
auto-promote an unblocked child; agents must still inspect all dependencies.

## Phase 0 — ownership and baseline

### KWEB-001 — Record the extraction inventory and public API ADR

Create an evidence-backed inventory of code shared by `kmd` and `kmd-ios`,
classify each module as core/browser/React/platform/design/heavy-feature, and
record the initial public API and package-boundary decisions in an ADR.

Exit gate: every current parser and reader module has one intended destination;
Tauri/browser coupling and security-sensitive seams are explicitly identified.

### KWEB-002 — Provision the public repository and distribution identity

Using Nyx's existing GitHub access, create the public GitHub repository and
protect the default branch. Re-check `kmd-web` package-name availability and
record the distribution choice; npm account setup and publication are not
required during repository provisioning. Do not publish an empty placeholder
package.

Exit gate: agents can clone/push branches and CI can later publish through a
credential-minimizing trusted workflow.

## Phase 1 — repository and contracts

### KWEB-003 — Scaffold the kmd-web workspace

Create the ESM-first TypeScript workspace, package directories, shared tooling,
examples, lint/type/test/build commands, contribution/security docs and agent
instructions. No production parser extraction belongs in this task.

### KWEB-004 — Define the public types and capability contracts

Define `RenderResult`, render options, diagnostics, asset references, detected
features, link/document targets and narrow host capability interfaces. Add API
contract tests and export only intentional entry points.

### KWEB-005 — Establish cross-platform conformance contracts

Move/copy representative Markdown, DESIGN.md, URL and malicious fixtures into a
versioned contract format. Define expected normalized observations that both
JavaScript and Unity can test without requiring byte-identical HTML.

### KWEB-006 — Establish canonical design tokens and generators

Move the reader's cross-platform colors, typography roles, spacing and radii to
a schema-validated canonical token source. Generate CSS for web consumers and
USS-compatible output or data for Unity without checking in hand-diverged values.

## Phase 2 — canonical engine

### KWEB-007 — Extract the DOM-free core renderer

Move the Markdown pipeline, safe transforms, outline extraction and relevant
DESIGN.md-independent types into `core`. Preserve observable behavior through
contracts. Split browser-only Mermaid execution, CSS loading and worker creation
out of core.

### KWEB-008 — Harden and prove the core security boundary

Port the sanitizer and URL/image classification policies, add malicious fixture
coverage and document safe defaults. Verify no Tauri or privileged host action
can be triggered by rendered content.

### KWEB-009 — Extract optional highlighting, Mermaid and math features

Create explicit feature integrations with lazy imports, readable fallbacks,
timeouts/limits where applicable and no network dependency. Baseline core must
not statically import their heavy runtime implementations.

### KWEB-010 — Extract DESIGN.md as an optional feature

Move design detection, extraction, IR, diagnostics and presentation contracts
behind an explicit entry point. Ordinary Markdown consumers must not load the
DESIGN.md pipeline.

## Phase 3 — browser and UI surfaces

### KWEB-011 — Build the browser runtime

Extract worker coordination, progressive render/morph behavior, anchors, code
copy enhancement, cache policy and asset URL lifecycle. Support graceful
main-thread fallback when workers are unavailable.

### KWEB-012 — Publish scoped reader styles

Extract reader and document-shell styles under a stable scoped root, connect
generated tokens, document CSS custom properties, and prove no global style
leakage in an integration fixture.

### KWEB-013 — Build the React reader package

Provide `MarkdownReader`, `DocumentShell` and the minimal hooks needed by kmd.
React stays a peer dependency. All native behavior enters through props and
capabilities; the package contains no Tauri imports or runtime detection.

### KWEB-014 — Build the Web Component

Wrap the browser engine in `<kmd-reader>` with documented properties,
attributes, lifecycle, events, errors and styling. Do not fork rendering logic.

### KWEB-015 — Build examples and consumer documentation

Create minimal vanilla, React and integration examples; installation and CSP
guidance; feature opt-in examples; security notes; and migration guidance.
Examples must exercise the published package rather than source aliases.

## Phase 4 — quality and release infrastructure

### KWEB-016 — Add package CI and release automation

Run type, unit, contract, security, build, package-contents, API-surface and size
checks. Prepare lockstep `0.x` prereleases, changelogs and provenance/trusted
publishing without embedding long-lived npm secrets.

### KWEB-017 — Add browser, accessibility and visual integration tests

Test the published artifacts in supported desktop engines and narrow widths.
Cover keyboard navigation, focus, outline behavior, tables, code controls,
failure fallbacks and reduced motion.

### KWEB-018 — Establish performance and bundle budgets

Measure baseline, React wrapper and opt-in feature chunks using the benchmark
fixtures. Record budgets based on evidence and make unexplained regressions fail
CI.

## Phase 5 — downstream adoption

### KWEB-019 — Implement the kmd desktop host adapter

In the public desktop repository, implement asset resolution, safe external and
internal navigation, clipboard/notifications where needed, worker integration
and Tauri-specific behavior behind the published capabilities.

### KWEB-020 — Migrate kmd desktop to kmd-web

Replace copied parser/reader/style modules with released package imports, prove
fixture and visual parity, then remove the redundant copies. Preserve Rust
ownership of file/path policy and desktop features.

### KWEB-021 — Implement the private iOS host adapter

In `kmd-ios`, implement iOS-specific host capabilities while preserving Files,
security-scoped access, viewport behavior, Swift bridges and StoreKit isolation.
Do not expose private code or secrets upstream.

### KWEB-022 — Migrate kmd-ios to kmd-web

Replace the forked shared renderer with the same released package version used
by desktop. Remove copied code only after simulator/device, fixture and visual
parity evidence exists.

### KWEB-023 — Connect Unity to shared contracts and tokens

Add a contracts-version marker, contract-fixture importer/runner, generated
token consumption and a machine-readable feature matrix to `kmd-unity`.
Native HTML differences are acceptable when normalized observable behavior
matches or a fallback is declared.

## Phase 6 — first public release

### KWEB-024 — Run the ecosystem release-candidate gate

Test a packed prerelease—not workspace source—in vanilla and React examples,
desktop, private iOS and applicable Unity contracts. Review security, licenses,
package contents, API surface, bundle size, performance and migration notes.

### KWEB-025 — Publish kmd-web 0.1 and compatibility matrix

Publish the accepted packages, tag the repository, publish API/docs/changelog,
and record exact compatible versions for desktop, iOS and Unity contracts.

## Later roadmap

These tasks remain in backlog until real usage informs their API:

### KWEB-026 — Design optional font distribution

Choose system defaults, optional font manifests/assets, licensing and loading
behavior without increasing the baseline bundle or allowing Markdown-authored
remote font URLs.

### KWEB-027 — Design reader-first editor mode

Research an optional source/split editor package with a peer editor engine,
controlled preview synchronization and no cost to reader-only consumers.

### KWEB-028 — Evaluate API stabilization and 1.0 criteria

Use downstream and external-consumer evidence to decide stable package splits,
public extension hooks, browser support, deprecations and the path to 1.0.

## Dependency graph

```text
KWEB-001 ─┐
          ├─> KWEB-003 ─┬─> KWEB-004 ─┬─> KWEB-007 ─> KWEB-008
KWEB-002 ─┘              ├─> KWEB-005 ─┘       │          │
                         └─> KWEB-006 ─> KWEB-012         │
                                               ├─> KWEB-009
                                               ├─> KWEB-010
                                               └─> KWEB-011 ─> KWEB-013 ─> KWEB-014
                                                               │             │
                                                               └─────> KWEB-015

KWEB-008 + 009 + 010 + 013 ─> KWEB-016
KWEB-012 + 013 ─> KWEB-017
KWEB-009 + 011 + 013 ─> KWEB-018

KWEB-013 + 016 ─> KWEB-019 ─> KWEB-020
KWEB-013 + 016 ─> KWEB-021 ─> KWEB-022
KWEB-005 + 006 ─> KWEB-023

KWEB-015 + 016 + 017 + 018 + 020 + 022 + 023 ─> KWEB-024 ─> KWEB-025
KWEB-025 ─> KWEB-026, KWEB-027, KWEB-028
```

Tasks whose implementations touch separate repositories may run concurrently
after their shared blockers are complete. Desktop and iOS migrations must use
the same release candidate. The release-candidate gate waits for all applicable
downstream evidence.

## Review protocol

An independent reviewer should evaluate each completed task against:

1. The full Flow description and every acceptance criterion.
2. This plan and the North Star boundaries.
3. The target repository's contributor and security instructions.
4. Dependency handoffs and public API compatibility.
5. Test, package, size, visual or manual evidence required by the task.
6. Unrelated changes, copied code and accidental platform coupling.

Review findings go back to the same Flow task. The task remains in `review` or
returns to `doing` until the criteria are actually satisfied.
