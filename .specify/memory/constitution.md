<!--
Sync Impact Report
- Version change: (none) → 1.0.0 (initial constitution)
- Source: workflow and governance sections follow content-api's constitution (2026-11-13); principles I to VI are specific to this package.
- Follow-up TODOs: none. Templates read the constitution at runtime and need no edits.
-->

# content-sdk Constitution

## Core Principles

### I. Headless: Data Only

The SDK fetches content from content-api's public interface and hands **plain data** to the platform. It MUST NOT render, create DOM, inject styles, or decide how anything looks; the platform
renders with its own components. It MUST NOT own any content or event data beyond what it passes through.

Rationale: many platforms use the SDK; presentation is each platform's. Content and events are content-api's.

### II. Everything Received Is Untrusted

Every value the SDK receives from the network (titles, tags, addresses, errors) is untrusted text. The SDK MUST validate the shape of what it receives, MUST NOT build HTML or evaluate
anything from it, and MUST fail with a typed error, never a thrown surprise, when a response does not match the contract.

Rationale: delivery carries text posted by strangers; the SDK is the first code that touches it in the browser.

### III. No Runtime Dependencies

The SDK MUST use only what the browser and Node 22 provide (`fetch`, `URL`, `AbortController`). A runtime dependency needs the owner's decision first. Development dependencies are
limited to the tools the sibling repository `ad-serve-client` uses (TypeScript, esbuild, Jest, ESLint).

Rationale: it is shipped to every platform's visitors; each dependency is their download and their supply-chain risk.

### IV. Contract-First and Versioned

The SDK follows content-api's published, versioned contract (`/api/v1`) and MUST ignore fields it does not recognize. Its own public API is a contract: documented before or alongside the
code, and not changed incompatibly without a version bump. Contract tests MUST run the SDK against the shapes in content-api's contract files.

Rationale: platforms and the service deploy separately.

### V. Clean, Testable Code

Code MUST be readable (TypeScript strict, ESLint clean, names that say what they mean, comments only for non-obvious rationale). Network access, clocks and timers MUST be injected, so
every module has unit tests with fakes; behavior is tested before it is merged.

### VI. Small, Honest Surface

Add an option or method only when a requirement needs it, never in advance. The SDK has no platform-specific code: it must work for a platform we have not thought of.

## Technology Constraints

TypeScript (strict), Node.js 22 for tooling, esbuild for the build, Jest for tests, ESLint. Output is a browser-ready bundle and typed ES/CommonJS entry points as the first spec decides.
Choices follow `ad-serve-client`; anything else needs the owner's decision.

## Development Workflow

Every feature and fix MUST go through the spec-kit lifecycle on a dedicated branch: `/speckit-specify` → `/speckit-plan` → `/speckit-tasks` → `/speckit-analyze` → `/speckit-implement` →
`/speckit-converge`, produced by running the commands. Every spec's `research.md` records decisions, alternatives, and anything started and then reversed, with the reason.

One small feature per pull request. The owner decides every design choice and every third-party service or dependency, so options, trade-offs and a recommendation come first. Nothing is
pushed, merged, published (npm or elsewhere) or deployed without the owner's explicit go-ahead, and a pull request is merged only when the owner says "merge". Secrets are never put in files;
the owner sets them. Feature branches are cut from an up-to-date local `main`.

## Governance

This constitution supersedes undocumented conventions. Amendments go through `/speckit-constitution` with an updated Sync Impact Report and semantic versioning. All specs, plans and reviews
MUST verify compliance; a deliberate deviation is justified explicitly and never silent.

**Version**: 1.0.0 | **Ratified**: 2026-11-16 | **Last Amended**: 2026-11-16
