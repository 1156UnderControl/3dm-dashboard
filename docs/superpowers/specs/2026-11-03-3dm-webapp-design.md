# 3DM Web App — Design

Date: 2026-11-03 · Owner: Luca (FRC 1156 Under Control) · Repo: `undercontrol1156/<name TBD>`

## 1. Intent

FRC 1156 runs **3DM (Data-Driven Decision Making)** right after kickoff to go from the game manual to a robot archetype and CAD plan. Today it lives in a Google Sheet (`Analise 3DM 1156.xlsx`). The work is done by **groups of 4–5 students, each on a stage/step in parallel**, and a single spreadsheet makes that collaboration painful: concurrent editing is awkward, per-person analysis ends up in separate tabs (`Rafa`, `Penna`, `Maus`, `Victor`) that someone has to merge, and there is no clear record of who decided what and why.

The app replaces the spreadsheet with a **collaborative, season-agnostic web app** that:

- Strictly follows 1156's 3DM structure (five stages, below).
- At kickoff, an **AI reads the uploaded game manual** and fills in all season-specific content (game pieces, scoring, RPs, rules, burning questions, skills, autos, historical references) and drafts later stages. People review and decide.
- **Records everything**: who changed what, when, why; AI vs human origin; past seasons preserved.

Success: at kickoff 2027 (early January), groups work in parallel in the app across all five stages, and at the end of 3DM the team has a complete, traceable record of the decisions.

## 2. Goals / non-goals / anti-goals

**Goals**
- All five 1156 stages in v1, same order and structure as the existing sheet.
- Real-time multi-user editing; groups work in parallel; dashboard clearly shows what's open.
- AI season setup from the manual PDF; AI suggestions inline, clearly marked, accepted/rejected by humans.
- Full audit history; seasons archived; end-of-season export.
- Optional "toolbox" with 4481-style numeric tools, including a field path sketcher with PathPlanner export.

**Non-goals**
- Multi-team / public SaaS. 1156 only.
- Scouting, match strategy during competitions, CAD integration.
- Full physics simulation of paths (simple motion-profile estimate is enough).
- Embedding the PathPlanner desktop app itself.

**Anti-goals (failure even if it "works")**
- Season-specific content hardcoded in the app.
- AI output silently becoming "the decision" — anything the AI produced must stay visibly AI until a human accepts/edits it.
- Stages blocked/gated so groups can't move in parallel.
- An API key reachable from the browser.

## 3. Users and access

- Only 1156 members. Sign in with Google. Access controlled by an **allowlist of emails** managed in-app by admins (captain/mentor).
- Roles: `admin` (manage allowlist, seasons, AI provider, close stages, run manual processing), `member` (edit everything in steps, accept/reject AI items).
- Groups: admins (or members) create groups (e.g. G1–G4) with members; each step can be assigned to a group. Assignment is informational (shown on cards), not a permission boundary.

## 4. The 3DM structure (fixed, season-agnostic)

Mirrors `Analise 3DM 1156.xlsx` and the FIEMG 2026 deck. Each step has: description, assigned group, deadline, status (`não iniciado` / `em andamento` / `em revisão` / `concluído`), a written **conclusion**, and attached evidence (toolbox results, links, images).

**Stage 1 — Análise do jogo**
- 1.1 Resumo: scoring summary table, how to get each RP, field overview image.
- 1.2 Decomposição do jogo: relevant-rules table (rule ID, text, why it matters, penalty), grouped (gameplay, robot, bumper…); **burning questions** (question, answer, rule citation).
- 1.3 Simulador de pontuação: a match-timeline scenario (robot parameters → schedule of actions per period → points). Uses the toolbox score simulator; multiple saved scenarios.
- 1.3.x Papéis e partidas: role/match analysis by level (e.g. regional quals/elims, worlds quals/elims, Einstein), robot 1/2/3 roles, conclusions — **one shared table where each person/group adds their scenarios** (replaces per-person tabs).
- 1.4 Habilidades do robô: category → skill → KPIs list.
- 1.5 Análise histórica: per current-game action → similar game/year, reference robot, link, mechanism, notes, image.
- 1.6 Autônomos: candidate auto routines (description, variations, actions on path, estimated time, solo/alliance points); can attach paths from the toolbox.

**Stage 2 — Lista de prioridades**
- Board with columns **Precisamos / Queremos / Seria bom / Ignorar**; items are skills/targets (often from 1.4) with numeric targets where relevant ("Armazenar 25 bolas no mínimo").
- Identified roles (name + description).
- Column definitions shown on the page (as in the sheet).

**Stage 3 — Prototipagem**
- Rows: proposed concept, **one question**, fidelity (Análise 2D / Protótipo físico simples / complexo), owner(s), notes, conclusion. Sub-lists per subsystem (e.g. 3.1 Intake). Guidance text on good vs bad questions.

**Stage 4 — Arquétipos**
- 4.1 Proposed archetypes: name, 2D/3D images, skills, notes (typically ~3).
- 4.2 Decision matrix: (a) coverage of every Precisamos/Queremos item per archetype (0/1, % achieved), (b) weighted attributes (default: Simplicity, Versionabilidade, CoG, Knowledge Base… weights editable) scored per archetype; computed totals; chosen archetype + justification.

**Stage 5 — Requisitos e CAD**
- 5.1 Functional requirements per subsystem: requirement, target metric, constraints.
- 5.2 CAD flow: subsystem, leader, support team, alpha/beta/gamma deadlines, weight budget (with remaining-budget sum), status.
- 5.3 Design review(s): dated, per-subsystem considerations.

**Home (dashboard)** — chosen layout **B: stage columns / pipeline**. Five columns; each step is a card showing group, deadline, status, who is editing now (presence), and count of AI items awaiting review. Nothing is gated: all steps are open; status makes open work obvious.

## 5. AI

**Provider**: Anthropic Claude by default (reads PDFs natively), OpenAI as alternative; chosen by admin in settings. Use the latest capable models (e.g. `claude-sonnet-5-5` for manual processing; configurable).

**Key handling** (user decision): **bring-your-own-key in the browser.** A user pastes an Anthropic or OpenAI key in Settings; it is saved only in that browser's `localStorage` (never written to Firestore, never logged, never sent anywhere except the provider). The browser calls the provider directly (Anthropic: `anthropic-dangerous-direct-browser-access` header; OpenAI: browser mode). Members without a key can still edit everything; AI buttons show "configure uma chave" instead. "Remover chave" button in Settings. Accepted risk: anyone with access to that browser/profile, or an XSS bug, can read the key — so recommend a key with a low spending limit, and keep third-party scripts out of the app.

**Season setup flow**
1. Admin creates a season (name, year) and uploads the game manual PDF (plus optionally team updates later).
2. The browser sends the PDF directly to the model (the PDF itself is not stored — only the resulting season model; the user keeps their own copy). It to the model with a structured-output schema and gets back the **season model**: game pieces, field zones, match periods (with durations), scoring table, RP conditions, relevant rules (+why/penalty), burning questions (+answers, citations), skills with KPIs, candidate autos, historical references, and drafts for stage 2 (priority placements), stage 3 (prototype questions), stage 4 (archetype ideas).
3. Results are written into the steps as **AI items** (tagged "IA", with source citation where possible).

**Ongoing assist**: per step, a "Sugerir" action that asks the AI for more items given the season model and the team's current content (e.g. more burning questions, more KPIs, prototype questions for a priority item). Also a Q&A box: "ask the manual" with rule citations.

**AI items UX** — chosen option **A: inline**. AI items appear directly in the step, visually tagged "IA", with ✓ accept / ✗ reject / ✎ edit. Accepting or editing converts them to human-owned (history keeps the AI origin). Rejected items are hidden but kept in history.

**Re-processing**: when a manual update / team update is uploaded, AI proposes diffs as new AI items; never overwrites human content.

## 6. Toolbox (optional tools)

Usable from any step; results can be saved and **attached as evidence** to a step.

- **Season model is generic** (Claude's call): actions with points per period, capacity/rate limits, RP thresholds. Rules that don't fit (multipliers, conditional bonuses) are entered manually as notes/overrides; the simulator does not try to express arbitrary rules.
- **Score simulator**: robot parameters (collect rate, capacity, fire rate…) + periods from the season model → action timeline → points and RP check. Saved scenarios.
- **Field & paths**: field image per season (uploaded by admin, compressed and stored in Firestore — see §8), draw waypoints for autos / teleop cycles; time estimate from robot params (max speed, accel) via trapezoidal motion profile plus per-action durations (collect/score). Export **PathPlanner-compatible `.path` JSON**. Field dimensions configurable per season.
- **100% robot / X% concepts**: estimate best-robot match performance; compare concepts vs 100% (4481 style).
- **RP analysis**, **HP skills list**, **Trade-offs** (pros/cons per decision).
- **Robot action list**: action, requirement, test case, measurement, acceptance level, status, results.

## 7. Record keeping

- Every change stored as an event: who, when, what (before/after), optional reason ("motivo"). History panel per step and per item.
- Item origin: `human` / `ai` / `ai-accepted` / `ai-edited`.
- Stage closing records who closed it and the conclusion text.
- Seasons are archived read-only after the season ends (admin can reopen).
- **Export**: whole season to `.xlsx` (one sheet per step, similar to today's sheet) and a printable summary page.

## 8. Platform and tech (decided by Claude unless noted)

- Frontend: React + TypeScript + Vite, static single-page app. **No server of our own.**
- **Firebase on the free Spark plan** (user decision): Firebase Auth (Google sign-in), Firestore (data + realtime listeners), Realtime Database (presence only — "who's online / who's editing"), Firebase Hosting. Allowlist and roles enforced by Firestore/RTDB security rules.
- **No Firebase Storage** (it needs the paid Blaze plan for new projects). Consequences: the manual PDF is not stored (sent straight to the AI from the browser); images (field image, archetype 2D/3D, evidence) are resized/compressed client-side and stored inside Firestore documents (stay well under the 1 MB/doc limit), or added as external links (Drive, YouTube, Onshape).
- **Spark quotas** (≈50k reads / 20k writes per day): saves happen per item/field on blur, not per keystroke; each save = item write + one history event. Presence lives in RTDB, not Firestore. Expected kickoff-weekend use (~30 students) fits; builder should keep listeners scoped to the open step.
- **Concurrent editing** (Claude's call): structured items (rows, cards, matrix cells) save per item/field, last-write-wins; long text fields show "X está editando" presence. No CRDT / Google-Docs-style merge. History events are saved before/after values, not keystrokes.
- UI language: **Portuguese**; game terms kept in English as in the manual.
- Repo: GitHub org **undercontrol1156**. **Commits must not include Claude as co-author** (user instruction).
- **Prerequisites done by hand (Luca)**: create the Firebase project (Spark), enable Google sign-in, Firestore, Realtime Database and Hosting; get an Anthropic and/or OpenAI key with a spending limit. The README documents each step.

## 9. Data seed / migration

- Ship 1156's 3DM structure as the template (step names, descriptions, guidance text) from **`Analise 3DM 1156.xlsx`** (the newest, most complete version; `3DM 1156.xlsx` is an earlier draft).
- The two **4481 sheets** (`3DM 2025/2026 Team 4481.xlsx`) are the reference for toolbox formulas: cycle times, 100%/X% estimation, RP analysis, robot action list.
- Optional: import the REBUILT 2026 content from `Analise 3DM 1156.xlsx` as a demo/past season (nice-to-have, builder's call on effort).

## 10. Milestones (user-approved)

- **By kickoff (early Jan 2027, ~9 weeks):** login + allowlist + roles + groups; season creation; AI season setup from the manual; all five stages with their structures; pipeline home; inline AI items; full history; seasons archive.
- **First weeks of the season:** toolbox (score simulator, field & paths with PathPlanner export, 100%/X%, RP, HP, trade-offs, action list) and the `.xlsx` / printable export. Until the simulator ships, 1.3 and 1.6 work as plain tables.

## 11. Left to the builder

- Exact data model, component library, styling.
- How presence ("who's editing now") is implemented.
- Prompting/structured-output schema details and chunking for long manuals.
- PathPlanner file format details (follow upstream schema at https://github.com/mjansen4857/pathplanner).
