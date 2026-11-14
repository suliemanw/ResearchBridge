# ResearchBridge

**From learning established knowledge to questioning and extending it.**

ResearchBridge is a working, local-first hackathon MVP for the transition to master's-level study. Upload a text-based course PDF, have a short academic interview, confirm your background, then build a personalized seven-day bridge. The agent distinguishes prior study, confidence, and demonstrated understanding.

## Run

Requires **Node.js 22.13 or newer** (tested on Node 24). No database server is needed.

```bash
npm install
npm run dev
```

The app listens on port **3000**. `npm start` runs without file watching. It works immediately in **Simulated demo** mode when no API key is present. Real PDF extraction, session persistence, interview controls, profile editing, completion tracking, and source inspection work in demo mode. Responses and plans are deterministic simulations, and diagnostic answers are explicitly **not graded**. Demo mode does not pretend to interpret arbitrary passages.

For live AI, create a local `.env` file from `.env.example` and set:

```dotenv
OPENROUTER_API_KEY=your_key_here
OPENROUTER_MODEL=openai/gpt-4o-mini
PORT=3000
DEMO_MODE=false
```

Restart the server after configuration changes. In a managed cloud environment, set the key securely in environment settings instead of committing it. Allow outbound HTTPS to **openrouter.ai**. The selected model must support JSON-schema structured outputs. The key is only read on the backend and sent as authorization to `https://openrouter.ai/api/v1/chat/completions`.

An invalid key, insufficient credit, timeout, network error, or malformed model response produces a recoverable error. Live mode never silently falls back to simulated output. The live badge describes configuration, not a successful provider health check.

## Hackathon walkthrough

Generate two small, text-based sample documents:

```bash
npm run demo:pdf
```

Files are created at `.data/demo/distributed-systems.pdf` and `.data/demo/linear-algebra.pdf`. These are **authored demonstration excerpts, not actual university materials**. You can use your own text-based course PDF instead.

1. Upload a PDF and acknowledge the external-provider disclosure. Extraction and preliminary analysis identify course topics, source passages, and possible prerequisites. No final plan is generated here.
2. Answer one question at a time. The normal interview takes 4–7 answers. Use **Skip this question** or **Generate my plan now** for a provisional profile.
3. Review the profile, edit your background if needed, then explicitly select **Generate My Bridge Plan**.
4. Open the foundations, academic language, research reasoning, and seven-day checklist. Source buttons display actual extracted page text with the quoted excerpt highlighted.
5. Complete activities, try a readiness check, paste a passage into the language simplifier, and explore educational resources. Your plan and profile survive reloads.
6. Use **Academic profile** to review answers, edit your background, or revisit the interview. **Review profile & regenerate** returns to confirmation before replacing a plan. Regeneration resets completion because activities receive new IDs; normal diagnostic adaptation preserves completed work.
7. **Reset learning profile** deletes this session's server-side learning data.

To demonstrate personalization with the same PDF in two separate browser profiles:

| Student | Example interview evidence | Demo result |
|---|---|---|
| Telecommunications graduate | Computer networks studied; low confidence with event ordering and proofs; visual examples, 25 minutes daily | More foundational review, shorter activities, explicitly provisional gaps |
| Computer science graduate | Previously studied Distributed systems, Event ordering, Computer networks, Formal reasoning, Proof techniques, Algorithms; high confidence; research critique | Less review and earlier assumption analysis and counterexample work |

Demo keyword matching is intentionally limited and labeled. High self-reported confidence never becomes demonstrated mastery. In live mode, repeated assessment evidence drives adaptation.

## Features and implementation

- **Frontend:** HTML, CSS, and vanilla JavaScript. Warm whites, muted greens, minimal borders, responsive sidebar, conversation bubbles, profile confirmation, learning cards, and mobile navigation. No build step or frontend API credentials.
- **Backend:** Express 5, dotenv, Multer memory-limited uploads, maintained PDF.js extraction (`pdfjs-dist`), Zod validation, and local JSON persistence.
- **Workflow:** `UPLOAD → DOCUMENT_ANALYSIS → INTERVIEW → PROFILE_CONFIRMATION → BRIDGE_PLAN → GUIDED_LEARNING`. The server enforces transitions, not just a system prompt. Document analysis is an in-flight step; failed operations do not commit partial state.
- **Memory:** degree, target course, prior courses, interview answers, studied topics, self-reported confidence, demonstrated knowledge/evidence, provisional gaps, learning preferences, uncertainties, diagnostics, generated plan, and completed activity IDs.
- **Grounding:** page-indexed text chunks with overlapping character windows, distributed sampling for initial analysis, and keyword-ranked retrieval for subsequent operations. This is lightweight retrieval, not exhaustive semantic search. Every returned citation must match the actual PDF page and, in live mode, a supplied context excerpt. No invented page numbers or quotations are accepted. Semantic correctness still requires judgment.
- **Agent operations:** `analyzeCourse`, `identifyPrerequisites`, `interviewStudent`, `updateStudentProfile`, `evaluateUnderstanding`, `generateBridgePlan`, `simplifyAcademicText`, `recommendResources`, and `updateProgress` are implemented in `src/` and coordinated through explicit state.
- **Interview:** the initial degree question is intentionally broad; later questions use the document and accumulated answers. The backend caps the interview at seven answers and requires confirmation even for early or skipped interviews.
- **Assessment:** live readiness checks evaluate conceptual accuracy, assumptions, explanation, and independent reasoning separately (0–4). Two recent strong responses on a topic remove that provisional gap and introduce a stretch activity; repeated difficulty adds foundational review. One upcoming uncompleted activity changes, preserving the seven-day schedule and completed work. After 2, 4, and 6 completed activities, the agent automatically queues a source-grounded reasoning challenge in the conversation. Interview diagnostics are evidence, not automatic mastery claims.
- **Language:** original passage, explanation, terms, concrete example, return to formal language, and qualifications. Sources are shown only when verified; pasted text is not automatically claimed to belong to the PDF.
- **Resources:** curated topic/query metadata matched against course topics and gaps. Score = `(2 × matching gap tags + matching course tags) / (3 × resource tags)`. This is a local match estimate, not a YouTube rating or quality score. This environment blocks YouTube verification, so the MVP intentionally provides clearly labeled **YouTube search links** instead of unverified direct playlists. No YouTube API key is needed. Direct playlist recommendations remain a follow-up requiring verified metadata.

### Main endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/health`, `/api/session` | Mode and current session |
| POST | `/api/upload` | Multipart `pdf` and `consent=true`; extract/analyze and start interview |
| POST | `/api/interview` | `{ answer }` or `{ skip: true }` |
| POST | `/api/interview/finish`, `/api/interview/restart` | Provisional confirmation or revisit questions |
| POST | `/api/profile` | Edit degree, prior courses, preferences, provisional gaps |
| POST | `/api/plan`, `/api/plan/regenerate` | Confirm/generate or return to confirmation |
| POST | `/api/chat`, `/api/simplify` | `{ message }` |
| POST | `/api/diagnostic`, `/api/diagnostic/answer` | Start check or submit `{ message }` |
| POST | `/api/progress` | `{ id, completed }` |
| GET | `/api/resources`, `/api/document/page/:page` | Recommendations or actual extracted source page |
| DELETE | `/api/session` | Delete this learning profile |

## Validation

```bash
npm test
```

The 22 integration tests generate and extract real multi-page PDFs, exercise interview gating/adaptation, skipped answers, profile editing, two different student plans for the same PDF, a different course, persistence and session isolation, checklists, ungraded demo diagnostics, source validation, safe errors, deletion, and mocked live-provider simplification and adaptive assessment.

For a full desktop/mobile browser smoke test:

```bash
# One-time on machines without a system Chromium:
npx playwright install chromium
npm run test:browser

# This cloud machine already has Chromium:
CHROMIUM_PATH=/usr/bin/chromium npm run test:browser
```

The browser test covers upload → interview → skip → edit → confirm → plan → completion → source inspection → resources → diagnostic → simplifier → reload → mobile navigation → reset. It uses isolated temporary data and fails on browser exceptions or horizontal mobile overflow. **Real OpenRouter responses have not been tested without a configured key**; mocked tests establish request format, auth handling, validation, and error paths, not live model quality.

## Data, limits, and deployment scope

PDF extraction and learning profiles are stored as atomic session JSON files in `.data/` (or `DATA_DIR`). Raw PDFs are not retained. A random 192-bit HttpOnly SameSite session cookie selects the profile; it expires after 30 days. On startup, session cleanup removes files older than 30 days and retains at most 200 existing sessions. Reset deletes the session file immediately. There is no account system or cross-device login. This is a single-process MVP; production deployment needs authenticated storage, appropriate retention, TLS, and shared rate limits.

Uploads are limited to 10 MB, 80 pages, and 300,000 extracted characters. Scans and encrypted/unreadable PDFs show actionable errors rather than claiming analysis. User messages are limited to 4,000 characters, retrieval/model context is bounded, model responses are capped at 6,500 tokens, requests time out at 45 seconds, and live AI calls are limited to 50 per IP per hour (90 API requests per IP per minute). One state operation per session runs at a time. Behind a proxy, configure deployment-specific proxy handling deliberately; the default does not trust forwarded IP headers.

PDF and student text are treated as untrusted data. Structured outputs, source validation, workflow checks, same-origin controls, CSP, bounded context, and text-only rendering reduce injection exposure. AI interpretation and extracted mathematical notation can still be wrong; consult the original material. Upload consent explains when content is sent to OpenRouter and its selected provider.

The requested `researchbridge_chat_demo.html` was not present in the supplied empty repository or workspace. This interface implements the described design direction; an exact visual comparison requires that original file.
