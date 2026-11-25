> **HISTORICAL – archived, not current.** Migrated 25 Nov 2026 from the private repo Project-Check-MVP-Master-Build (approved or older branches). Superseded by docs/governance, docs/continuity and CLAUDE.md. Kept for reference only. Client jobs anonymised as Job A–O; prices, IDs and security details redacted.

# PROJECT CHECK — CURRENT EXECUTION STATE

Last verified from GitHub: 2026-09-08

## Current working branch

`trial/direction-c-complete-working-model`

Verified runner state:
- HEAD: `2d889301eec374bd3cefe1d85aa1cf4881208d38`
- Working tree: clean
- Status: trial/review branch; not approved for merge to `master`

## Current app path

Repository: `ProjectCheck-Raffers/Project-Check-MVP-Master-Build`

App root:
`Project-Check-MVP-Master-Build/`

Local runner checkout:
`C:\Project-Check\Project-Check-MVP-Master-Build`

## Approved logo path

Sole logo authority, from the current HEAD of `master`:
`Project-Check-MVP-Master-Build/masterfile/project-check-logo.png`

Application mappings:
- Standard logo: `Project-Check-MVP-Master-Build/assets/project-check-logo.png`
- Existing Direction C header mapping: `Project-Check-MVP-Master-Build/assets/figma-header-logo.png`

Use exact master bytes. Do not regenerate, reinterpret, or substitute another asset.

## Current homepage/design state

- Current review build: Direction C complete Stage 1 / Stage 2 working model.
- The branch is for live visual and journey review and is not approved for `master`.
- Current branch HEAD replaces stale logo variants with the exact approved master.
- Direction C presentation files:
  - `Project-Check-MVP-Master-Build/direction-c-trial.css`
  - `Project-Check-MVP-Master-Build/direction-c-trial.js`
- Product logic remains in the existing app files; do not redesign or alter adjacent behaviour during an isolated visual or asset task.

## Current execution method

- Implementation and testing: Codex against the current GitHub branch and repository state.
- Architecture, task instruction and review: ChatGPT.
- Local review: serve `Project-Check-MVP-Master-Build/` on port `5099`.
- Public review: the existing bounded self-hosted runner bridge in `.github/workflows/project-check-runner-bridge.yml`, controlled through GitHub Issue #57.
- Exact review trigger: `PC-RUNNER-BRIDGE REVIEW`.
- “latest link”: read the most recent successful `EXTERNAL REVIEW LINK READY` comment on Issue #57 and return its `EXTERNAL:` URL only. Do not reuse an unverified historical URL.
- Current public-link status: no successful URL is recorded by the current runner bridge; the latest recorded review attempt is blocked because localhost is not serving the authoritative `index.html`.
- Do not rebuild or replace GitHub Actions unless Stuart explicitly requests it or the existing method is proven unusable for the task.

## Task classification

- **LOW** — isolated, reversible, single-purpose change. Take the shortest valid action only, verify that change, and stop. Do not touch adjacent files or behaviour.
- **MEDIUM** — affects shared behaviour, multiple files, an approved design reference, or a customer journey. Inspect only relevant dependencies, make the smallest bounded change, and run focused verification.
- **HIGH** — affects security, legal wording, user data, core architecture, production deployment, protected sources, or destructive/irreversible operations. Confirm exact scope where needed and run full relevant verification.

Every task must be classified before execution. Never broaden the task.

## Explicitly obsolete or non-authoritative

Do not use these as execution authority:
- Old Project Check chats, instructions, governance experiments, or remembered workflows.
- Historical review URLs.
- Historical commits when current GitHub state differs.
- `CURRENT-STATE.md` as an execution-control file; it is a legacy implementation-status document tied to an older baseline.
- Superseded branch `trial/direction-c-stage1-stage2`.
- Archived, recovery, temporary, controller, orchestration, and old workflow branches unless Stuart explicitly names one.
- Trial-branch assets, application `assets/`, screenshots, Figma, generated images, cached files, or `masterfile/review-staging/` as master asset authority.
- Any GitHub Actions workflow other than the current runner bridge on `master`, unless Stuart explicitly authorises its use.

Old Project Check chats are evidence, not authority. Consult them only when Stuart explicitly asks.

GitHub current state is authority.
