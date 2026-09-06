# PRD: AI-Powered Full-Stack Code Analyzer

**Author:** Amit
**Date:** 2026-09-06
**Status:** Draft v1.0

---

## 1. Summary

A browser-based tool that lets a developer upload a codebase (GitHub repo URL or ZIP) and query it in natural language — "find N+1 query patterns," "identify auth vulnerabilities," "suggest TypeScript improvements," "map dependencies." The backend ingests and summarizes the codebase once, caches that context with Claude's prompt caching, and reuses it across many queries so repeated analysis is fast and cheap. Results render as structured cards with file/line links and before/after diffs. A cost dashboard shows token usage and cache-driven savings, proving the ROI of the caching design.

This is a portfolio project: the point is to demonstrate full-stack + AI engineering competence (React/TS frontend, Node/TS backend, LLM orchestration, structured outputs, cost optimization), not to build a commercial product. Scope decisions below are made with that goal in mind — favor a small number of things done well and testable over broad feature coverage.

## 2. Problem & Goals

**Problem:** Understanding an unfamiliar codebase, or auditing it for specific issue classes (security, performance, type safety, architecture), is slow and manual. Existing AI coding assistants re-send full context on every query, which is slow and expensive.

**Goals**
1. Let a user go from "here's a repo" to "here are concrete, linked findings" in under a few minutes.
2. Demonstrate a real prompt-caching architecture with measurable cost savings (not just a claim — actual before/after numbers from the Anthropic API usage response).
3. Produce reliable, structured (JSON-schema-validated) findings that render deterministically in the UI — no regex-scraping free-text model output.
4. Ship with an automated test suite (unit + integration + a mocked-LLM E2E path) so correctness doesn't depend on manual click-through testing.

**Non-goals (v1)**
- Not a replacement for real static-analysis tools (ESLint, Semgrep, CodeQL) — it complements them by adding a natural-language query layer over LLM reasoning.
- No multi-user org/team accounts, no billing, no persistent multi-tenant database at v1 (single-user, ephemeral or SQLite-backed).
- No fine-tuning; no support for languages beyond JS/TS/Python at v1 (extensible parser design, but only these implemented).
- No real-time collaborative editing of the codebase.

## 3. Target User

A developer (the persona is essentially "you," building this to learn and to show in interviews) evaluating or auditing a repo — their own or an open-source one — who wants fast, explainable, linkable findings instead of reading every file.

## 4. Key User Stories

1. As a user, I paste a public GitHub repo URL (or upload a ZIP), and the tool ingests it, showing me a progress indicator and then an architecture summary (languages, frameworks, entry points, module graph).
2. As a user, I pick a query template ("Security audit of auth flows") or type a free-form query, and get back a list of findings, each with severity, an explanation, a file path + line range, a code snippet, and (where applicable) a suggested diff.
3. As a user, I click a finding's file/line link and see the relevant source excerpt in context, with the diff rendered side-by-side.
4. As a user, I run a second and third query against the same repo and see in the cost panel that the cached-context tokens were reused (cache read vs. cache write/input token counts, and estimated $ saved vs. a no-cache baseline).
5. As a user, I can re-run the same query and get a stable, schema-valid result even if the model's prose varies — because output is constrained to a JSON schema.
6. As a developer maintaining this project, I can run `npm test` and get full unit + integration coverage of ingestion, caching logic, and API contracts, plus a mocked E2E flow, without needing a live Anthropic API key or manual clicking.

## 5. Scope: Features

### 5.1 Codebase Ingestion
- Input: public GitHub repo URL, or ZIP upload (max size cap, e.g. 50MB / ~2000 files at v1 — configurable).
- Backend clones/extracts, walks the tree respecting `.gitignore`-style excludes (node_modules, dist, build, .git, lockfiles, binary/media files).
- Produces a **Codebase Manifest**: file tree, per-file language, line counts, detected frameworks (package.json deps, requirements.txt, etc.), and a heuristically chosen set of "high-signal" files (entry points, route/controller files, auth-related files, config) to include in the cached context in full; everything else is summarized (path + top-level exports/symbols only) to control token budget.
- Manifest + selected file contents are what get cached (see §5.2).

### 5.2 Cached Context (the architectural centerpiece)
- On first query for a given codebase, the backend builds a single large **system/context block**: repo manifest + high-signal file contents + a fixed instruction preamble, and sends it with `cache_control: {type: "ephemeral"}` on that block per Claude's prompt caching API.
- Every subsequent query for the same codebase reuses that cache (same cache key = same leading content, byte-for-byte) and appends only the new user query + any query-specific small context (e.g. one extra file the user references) as uncached trailing content.
- Cache TTL is Anthropic's default (5 min) unless the app explicitly refreshes it (each query re-touches the cache, extending its life while the session is active); a "1-hour cache" tier is a stretch goal if usage data justifies it.
- Store per-codebase cache metadata (content hash, last-touched timestamp, token counts from the API's `usage.cache_creation_input_tokens` / `cache_read_input_tokens`) so the cost dashboard is driven by real API responses, not estimates.
- If the underlying repo content changes (re-upload), invalidate and rebuild the cached block.

### 5.3 Query Interface
- Free-form text box.
- A set of query templates (v1 list, each mapped to a distinct system instruction + output schema variant):
  - Security audit (auth flows, injection, secrets, insecure deserialization)
  - N+1 / performance query patterns
  - TypeScript / type-safety improvements
  - Dependency & module map
  - General code smell / tech debt scan
- Templates are just pre-filled queries + a hint to the backend about which JSON schema to enforce; user can still edit the text.

### 5.4 Structured Output / Result Visualization
- All analysis responses are constrained to a JSON schema (Claude structured outputs / tool-use forced schema) shaped roughly as:
  ```json
  {
    "summary": "string",
    "findings": [
      {
        "id": "string",
        "title": "string",
        "category": "security|performance|types|architecture|maintainability",
        "severity": "info|low|medium|high|critical",
        "explanation": "string",
        "file_path": "string",
        "line_start": "number",
        "line_end": "number",
        "code_snippet": "string",
        "suggested_fix": {
          "description": "string",
          "diff": "string (unified diff format)"
        } 
      }
    ]
  }
  ```
- Frontend renders each finding as a card (severity-colored badge, title, explanation, collapsible code excerpt, collapsible diff view using a diff-rendering component).
- Clicking a file/line opens a source viewer panel showing the surrounding code with the flagged lines highlighted.

### 5.5 Cost Tracking
- Every LLM call's `usage` block (input tokens, output tokens, cache_creation_input_tokens, cache_read_input_tokens) is logged per query.
- Dashboard panel: running total for the current codebase session — total tokens, cache hit rate, estimated cost with caching vs. estimated cost if every query had re-sent full context (computed from the same manifest size × per-query count, at published token rates) — displayed as a simple bar/number comparison.
- This is the "prove ROI" feature — it must use real numbers from the API, with the no-cache baseline clearly labeled as a computed counterfactual, not a live measurement.

### 5.6 Testing & Automation (explicit product requirement, not just engineering hygiene)
Because the user does not want to test manually, automated testing is a first-class deliverable, not an afterthought:
- **Unit tests** (Vitest/Jest): manifest builder, file-tree filtering, cache-key hashing, cost-calculation math, JSON-schema validation of LLM output, diff rendering utility.
- **Integration tests** (Supertest against the Hono/Express app): ingestion endpoint with a fixture ZIP → manifest shape; query endpoint with a **mocked Anthropic client** (no real API calls in CI) verifying that (a) the first query builds and caches context, (b) the second query reuses the cache (assert on the mock's call args), (c) malformed/schema-violating mock responses are rejected and retried or surfaced as errors correctly.
- **Contract tests**: every query template's output is validated against its JSON Schema using a schema-validation library (ajv) with both valid and deliberately invalid fixture responses.
- **Frontend component tests** (Vitest + React Testing Library): upload form, query builder, result card rendering (given fixture JSON), cost dashboard math display.
- **E2E tests** (Playwright): full flow through the UI against the backend running with the Anthropic client mocked/stubbed (via an env flag or dependency injection), so the whole pipeline is exercised deterministically in CI without hitting the real API or costing money. A separate, manually-triggered "live" E2E suite (not run on every CI push) can optionally hit the real API against a tiny fixture repo to sanity-check the real integration.
- **CI**: GitHub Actions workflow running lint + unit + integration + component + mocked-E2E on every push/PR; a required status check before merge.
- Target coverage is directional, not a hard gate at v1: aim for high coverage on ingestion, caching, and schema-validation logic specifically, since those are the parts a portfolio reviewer will actually probe.

## 6. Non-Functional Requirements
- **Cost safety:** hard per-session token/query cap to prevent runaway spend while demoing; configurable max file/byte size for ingestion.
- **Security:** uploaded ZIPs are scanned for path traversal (zip-slip) before extraction; extraction happens in an isolated temp dir, deleted after the session or on a TTL; GitHub OAuth (if implemented) uses short-lived tokens, never stored server-side beyond the session.
- **Performance:** ingestion of a ~5k-file repo should complete in well under a minute; queries against cached context should return in single-digit seconds beyond model latency.
- **Reliability:** LLM calls wrapped with retry/backoff on transient errors and schema-validation-triggered single retry (re-ask with the validation error appended) before surfacing a user-facing error.
- **Portability:** backend runs identically locally and on Render/Railway; no local-filesystem assumptions that break on ephemeral containers (use a temp dir + configurable storage adapter so the ZIP-extraction path could later move to object storage).

## 7. Tech Stack (as specified)
- Frontend: React + TypeScript + Vite, Tailwind, component tests via Vitest + React Testing Library.
- Backend: Node.js/TypeScript, Hono (or Express) — Hono is recommended for lower overhead and better TS ergonomics.
- LLM: Anthropic Claude API, using prompt caching (`cache_control` on the context block) and forced structured output (tool-use with a fixed input schema is the most reliable way to get schema-conformant JSON from Claude — plan the analyzer as a tool the model must call, not a "please output JSON" instruction).
- Testing: Vitest, Supertest, ajv, Playwright, GitHub Actions.
- Deployment: Vercel (frontend), Render or Railway (backend + any lightweight DB — SQLite/Postgres for session + cache metadata).

## 8. Milestones
1. **M0 — Skeleton:** repo scaffolding, CI pipeline green on an empty test, deploy pipeline working end-to-end with a "hello world" round trip.
2. **M1 — Ingestion:** ZIP upload + GitHub URL clone, manifest builder, manifest unit + integration tests, manifest viewer UI.
3. **M2 — Query + Caching:** first query builds cached context, structured-output schema enforced, mocked-LLM integration tests, cost tracking wired to real usage numbers.
4. **M3 — Result UI:** finding cards, file/line linking with source viewer, diff rendering, component tests.
5. **M4 — Templates + polish:** the five query templates, cost dashboard with cache-savings comparison, E2E suite green in CI.
6. **M5 — Ship:** README, architecture diagram, open-source license, deployed demo link, write-up of the caching design and measured savings for portfolio use.

## 9. Success Metrics
- Demonstrable cache hit on 2nd+ query for a repo (cache_read_input_tokens > 0 in logged usage).
- CI green with zero manual test steps required to validate a PR.
- A README section showing real before/after cost numbers for a sample repo and query sequence.
- End-to-end flow (upload → query → see findings with working file/line links and diffs) works for at least one real open-source repo of moderate size (500–2000 files).

## 10. Open Questions
- GitHub OAuth: include at v1, or defer (public repos + ZIP upload cover the demo need without it)? Recommendation: defer; add only if time remains.
- Which two languages beyond JS/TS get parser support first — Python is the obvious second given prevalence; confirm before M1.
- Persistence: is a Postgres instance justified, or does SQLite (or even in-memory + session-scoped) suffice for a portfolio deploy? Recommendation: SQLite for v1, since there's no multi-tenant durability requirement.
