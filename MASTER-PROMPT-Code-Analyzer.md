# Master Build Prompt — AI-Powered Full-Stack Code Analyzer

> Paste this whole document as the system/task prompt to whatever coding agent (Claude Code, Cursor, etc.) you use to build the project. It assumes the agent has shell + file access and can run tests. It references the PRD (`PRD-AI-Code-Analyzer.md`) — attach that alongside this prompt.

---

## 0. Role & Operating Rules

You are acting as a senior full-stack engineer building a portfolio-grade AI application end to end, following the attached PRD exactly. Ground rules for every step of this build:

1. **Test-first, no manual verification.** For every feature you implement, write the automated test(s) for it in the same step (or immediately after) — unit, integration, or E2E as appropriate per the PRD's §5.6. Never tell the user "please test this manually." If you cannot make something testable (e.g., it depends on a live network call), mock the dependency so it is testable.
2. **Never call the real Anthropic API in automated tests.** All CI-run tests (unit/integration/component/E2E) must use a mocked/stubbed Anthropic client. A real-API smoke test is allowed only as a separate, explicitly-labeled script that is not part of `npm test` or the CI pipeline.
3. **Structured output only.** Every LLM call that returns findings must force schema-conformant output using tool-use with a fixed input schema (treat the "return findings" schema as a tool the model must call), not "please respond in JSON." Validate every response against the JSON Schema with `ajv` before it reaches the frontend; on validation failure, retry once with the validation error appended to the prompt, then surface a clear error if it still fails.
4. **Real cost numbers only.** The cost dashboard must be computed from the `usage` object Anthropic's API actually returns (`input_tokens`, `output_tokens`, `cache_creation_input_tokens`, `cache_read_input_tokens`), never from guessed token counts. The "savings vs. no caching" figure must be clearly labeled as a computed counterfactual (baseline = manifest size × number of queries at published no-cache pricing).
5. **Small, verifiable commits.** After each milestone (see PRD §8), run the full test suite and confirm green before moving to the next milestone. Report a short status after each milestone: what was built, what tests were added, current coverage/pass state, and any deviations from the PRD with rationale.
6. **Security basics are not optional.** Guard ZIP extraction against path traversal (zip-slip). Never persist an uploaded repo or its derived cache beyond a reasonable TTL. Never log API keys. Validate all user input at the API boundary (Zod or similar) before it touches ingestion or the LLM call.
7. **Ask before deviating from stack choices in the PRD** (React/TS/Vite, Node/TS + Hono, Vitest/Supertest/Playwright/ajv). If you believe a substitution is clearly better, say so and why, then proceed with the PRD's choice unless told otherwise.

---

## 1. Repository Setup

Create a monorepo with this shape:

```
/apps
  /web        (React + TS + Vite + Tailwind)
  /api        (Node + TS + Hono)
/packages
  /shared     (shared TS types: Finding, Manifest, QuerySchema, CostUsage, etc. — imported by both apps)
/tests
  /fixtures   (sample ZIPs, sample manifests, mock Anthropic responses — valid AND deliberately schema-invalid ones)
  /e2e        (Playwright specs)
```

Use npm workspaces (or pnpm workspaces if you prefer — state your choice and stick to it). Set up:
- ESLint + Prettier shared config.
- `tsconfig.base.json` with strict mode on everywhere.
- A root `package.json` with scripts: `dev`, `build`, `test`, `test:unit`, `test:integration`, `test:e2e`, `lint`, `typecheck`.
- GitHub Actions workflow (`.github/workflows/ci.yml`) that on every push/PR runs: install → lint → typecheck → `test:unit` → `test:integration` → build → `test:e2e` (against the app started with the mocked LLM client). Make this the required check.

**Test for this step:** CI pipeline runs green on a scaffold with a single trivial passing test in each of `apps/web`, `apps/api`, confirming the pipeline wiring itself before any real feature exists.

---

## 2. Shared Types & Schemas (`packages/shared`)

Define, with Zod schemas (source of truth) and derived TS types:
- `CodebaseManifest` (file tree, per-file language/lines, detected frameworks, high-signal file list).
- `FindingsResponse` (the schema from PRD §5.4 — `summary` + `findings[]` with `id, title, category, severity, explanation, file_path, line_start, line_end, code_snippet, suggested_fix?`).
- `QueryTemplate` enum + per-template system-prompt fragment + whether it uses the general `FindingsResponse` schema or a variant (e.g., the dependency-map template may want a `nodes[]`/`edges[]` shape instead — define that too as `DependencyMapResponse`).
- `UsageRecord` (per-query token usage + running totals + computed no-cache baseline).

Generate the corresponding JSON Schemas from the Zod schemas (via `zod-to-json-schema`) for use both in Anthropic's tool-use `input_schema` and in `ajv` validation on the way back out — one schema definition, two consumers, no drift.

**Tests:** unit tests asserting valid fixture objects pass each Zod schema and invalid fixtures (missing required field, wrong enum value, negative line number) fail with a clear error.

---

## 3. Backend: Ingestion (`apps/api`)

Build:
- `POST /api/codebases` — accepts either `{ githubUrl }` or a multipart ZIP upload.
  - GitHub path: shallow-clone (`git clone --depth 1`) into a temp dir.
  - ZIP path: validate it's a real ZIP, extract into a temp dir **with zip-slip protection** (reject any entry whose resolved path escapes the target dir).
  - Enforce size/file-count caps from config (default 50MB / 2000 files); reject with a clear 413-style error over the cap.
- A manifest builder that walks the extracted tree, ignoring `.git`, `node_modules`, `dist`, `build`, lockfiles, and binary/media extensions; detects language per file by extension; parses `package.json`/`requirements.txt` for framework hints; and picks "high-signal" files via a scored heuristic (entry points like `index.ts`/`main.py`, anything under `routes/`, `controllers/`, `auth/`, `middleware/`, config files) up to a token budget you define (e.g. first N files or M total bytes, whichever first).
- Store the manifest + a content-hash of the selected files, keyed by a `codebaseId`, in SQLite (via `better-sqlite3` or `drizzle`/`prisma` — your call, keep it simple).
- `GET /api/codebases/:id` returns the manifest for the UI's architecture-summary view.

**Tests (integration, Supertest):**
- Upload a fixture ZIP containing a small known repo structure (include one intentionally malicious entry, e.g. `../../etc/passwd`, in a dedicated malicious-zip fixture) → assert the manifest shape is correct and the traversal entry is rejected/skipped, not written outside the temp dir.
- Upload a ZIP over the size cap → assert the 4xx response and reason.
- GitHub URL path can be tested against a tiny public fixture repo, or mocked at the `git clone` boundary if you want CI to be fully network-independent — prefer the mock for CI reliability, and note that a network-dependent variant can run outside CI if desired.

---

## 4. Backend: Cached Context & Query Endpoint

Build:
- A `ContextBuilder` that, given a manifest + selected high-signal file contents, produces the single large context block (repo manifest description + concatenated high-signal file contents + a fixed instruction preamble) as a deterministic string, plus its content hash.
- An `AnthropicClient` wrapper (dependency-injected/mockable) that:
  - On first query for a `codebaseId`: sends the context block as the leading content of the messages array with `cache_control: {type: "ephemeral"}` attached to that block, plus a tool definition for `submit_findings` (or `submit_dependency_map`, etc. per template) whose `input_schema` is the JSON Schema from `packages/shared`, and forces tool use (`tool_choice: {type: "tool", name: "..."}`).
  - On subsequent queries for the same `codebaseId`: resend the **same** leading content block (required for Anthropic's cache to hit — the cached prefix must match byte-for-byte) with the same `cache_control` marker, and append only the new user query as trailing uncached content.
  - Captures the full `usage` object from every response and persists it (per query, per codebase) to SQLite.
  - Validates the tool-call input against the ajv-compiled schema; on failure, retries once with the validation errors appended to the user message; on second failure, throws a typed `SchemaValidationError` that the route maps to a clear 502-style API error.
- `POST /api/codebases/:id/queries` — body `{ query: string, template?: QueryTemplate }` → runs the above, returns `{ result: FindingsResponse | DependencyMapResponse, usage: UsageRecord }`.
- `GET /api/codebases/:id/usage` — returns the running usage totals + computed no-cache baseline for the cost dashboard.

**Tests (integration, mocked Anthropic client):**
- First query: assert the mock was called with a `cache_control`-marked block and that the returned usage is persisted.
- Second query: assert the leading content block passed to the mock is **byte-identical** to the first call's (this is the actual cache-correctness test — string equality on the cached prefix, not just "a call happened").
- Malformed mock response (violates schema): assert a retry occurs with the validation error in the follow-up prompt, and that persistent failure surfaces the typed error, not a raw crash.
- Schema-valid mock response: assert it passes straight through and matches the expected shape via ajv.
- A cache-invalidation test: re-upload/change the codebase content → assert a new context block (new hash) is built rather than reusing the stale cache.

---

## 5. Frontend (`apps/web`)

Build, each with component tests (Vitest + RTL) against fixture data — no live backend needed for these:
- **Upload/ingest view:** GitHub URL field + ZIP dropzone, progress state, error states (over size cap, invalid zip, clone failure) each with their own test.
- **Architecture summary view:** renders the manifest — file tree, detected frameworks, high-signal file list.
- **Query builder:** free-text box + the five template buttons from PRD §5.3; selecting a template pre-fills the text and tags the request with the right `template` value.
- **Result cards:** given a fixture `FindingsResponse`, render severity-colored cards, collapsible code snippet, collapsible unified-diff view (use a small diff-rendering lib, e.g. `diff2html` or `react-diff-viewer`, tested with a fixture diff string).
- **Source viewer panel:** given a file path + line range, shows a fixture source excerpt with the flagged lines highlighted (file content can be fetched from a `GET /api/codebases/:id/files/:path` endpoint you also need to build + test on the backend).
- **Cost dashboard:** given a fixture `UsageRecord[]`, renders running totals, cache-hit indicator, and the cached-vs-no-cache cost comparison — test the arithmetic against hand-computed expected numbers, not just "it renders."

Wire these views together into the full app flow with real API calls (not mocked) for local/dev use, but keep every component individually testable against fixtures.

---

## 6. End-to-End Tests (Playwright)

Add an env flag (e.g. `LLM_MOCK=1`) that makes the backend's `AnthropicClient` return canned, schema-valid fixture responses instead of calling the real API. Start the full app (web + api) in this mode for E2E.

Cover at minimum:
1. Upload a fixture ZIP → see the architecture summary render.
2. Run the "Security audit" template → see finding cards render with the mocked findings, click one → source viewer opens with the right file/lines highlighted, diff view expands correctly.
3. Run a second query against the same codebase → cost dashboard shows a nonzero cache-read token count (assert this by having the mock's second canned response include a distinct `cache_read_input_tokens` value you can assert on in the UI).
4. An error path: upload something invalid → see the error state, not a crash.

These run in CI on every push as part of the required check, fully offline/deterministic.

---

## 7. Milestone Checklist (mirror PRD §8)

Work through, and after each one, run the full test suite and report status before continuing:
- [ ] M0 Skeleton + CI green
- [ ] M1 Ingestion + manifest (unit + integration tests passing)
- [ ] M2 Cached query pipeline + structured output + cost tracking (mocked integration tests passing, including the byte-identical cache-prefix assertion)
- [ ] M3 Result UI + source viewer + diffs (component tests passing)
- [ ] M4 Templates + cost dashboard + full E2E suite green
- [ ] M5 README (architecture diagram, setup instructions, real measured cost-savings example from a sample run), license, deployment

## 8. Deliverable at the End

A working monorepo, deployed (frontend on Vercel, backend on Render/Railway per PRD), with:
- CI required-check green on `main`.
- A README section showing an actual before/after token-cost comparison captured from a real (or realistically mocked, clearly labeled) run against a sample repo.
- Zero manual test steps needed to validate correctness — `npm test` from the repo root runs everything (unit, integration, component, mocked E2E).
