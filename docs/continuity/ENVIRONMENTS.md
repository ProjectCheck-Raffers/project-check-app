> **Migrated 25 Nov 2026** from the private repo Project-Check-MVP-Master-Build (branch approved). Kept as the continuity record; references to the old repo, its Vercel project and its workflows describe the old setup. The live entry point is CLAUDE.md and docs/continuity/CURRENT-CHAT-INDEX.md in project-check-app. Client jobs are anonymised as Job A–O; IDs are redacted.

# Project Check — Environment Register

Evidence dates: **29 October – 1 November 2026**. Owner: Chief Architect. Stuart approves mapping changes. Read-only evidence checks do not authorise environment changes.

## GitHub and source roles

Application/continuity repository: `ProjectCheck-Raffers/Project-Check-MVP-Master-Build` (VERIFIED private).

| Environment/role | Source | URL/service | Database/access | Status |
|---|---|---|---|---|
| Canonical continuity and clean baseline | approved; live refs in MASTER | `.../blob/approved/docs/continuity/README.md` in the application repository | Authenticated private GitHub access | PLANNED publication; proposal branches are drafts |
| Development | Task branch from approved at the full SHA named by Stuart; historical sandbox is not a starting point | Local/Codespaces workspace | Current workspace state UNKNOWN | DOCUMENTED role; inventory incomplete |
| Historical sandbox preview (evidence only) | sandbox `728f810f564bcfb49d6dc7e6d1b9dc3a7bdaf38a` | Deployment below | Test project identified; functional connection UNKNOWN | VERIFIED READY metadata, not journey pass |
| Founder Test | No separate candidate/mapping approved | Stable HTTPS access PLANNED | Isolated test data/access PLANNED | UNKNOWN current usable environment |
| Commercial Production | No commercial candidate approved here | Existing production alias below | Authoritative production database mapping UNKNOWN | Existing hosting does not prove commercial readiness |

## Vercel — existing identified project

**VERIFIED at Step 2 inspection:**

- Team: `[Vercel team ID redacted]`.
- Project: `[Vercel project ID redacted]`, `project-check-mvp-master-build`.
- Historical sandbox preview at inspection: `dpl_6U4BJiJczsFypznxTZxTU1zj6LCB`, READY, sandbox `728f810…`.
- URL: https://project-check-mvp-master-build-7h3enfbok-project-check.vercel.app/
- Historical sandbox application-bearing predecessor: `dpl_6Qm6k5dg9Rb4F5x3CGkAf7PHyxQo`, READY, sandbox `9e4febece0d2a479ef68857e23c9c1c5028e68de`.
- URL: https://project-check-mvp-master-build-gdhp6huk7-project-check.vercel.app/
- Project metadata reports SSO protection for all deployments; founder access from phone/computer needs actual verification.
- Existing alias: https://project-check-mvp-master-build.vercel.app/ . Its current production SHA and database mapping are not reverified by this continuity task; do not infer them from the alias or repository homepage.

**DOCUMENTED:** application root directory is `Project-Check-MVP-Master-Build`. Retain the existing integration. No project, alias, protection or hosting change is authorised.

The preceding Step 2 observations are retained as dated evidence. The following supplement resolves the inspected hosting configuration without claiming database isolation or commercial readiness.

### Verified configuration and publication evidence — 30 October 2026

- Stuart's authenticated dashboard screenshots confirm Production Branch Tracking is `trial/direction-c-complete-working-model`, Preview covers all unassigned Git branches, and automatic assignment of Production domains is enabled. Neither `approved` nor `docs/continuity-v1-2026-10-29` is that Production branch.
- The connected repository is `ProjectCheck-Raffers/Project-Check-MVP-Master-Build`. No deploy hooks exist. Root directory is `Project-Check-MVP-Master-Build`; inclusion of outside files and skipping unaffected builds are enabled. These settings do not independently guarantee a documentation push is skipped.
- The Production alias was read back through authenticated Vercel access after the documentation push: `dpl_GXHdfAnBS8APo4NaEGXSuPXBzqSY`, URL https://project-check-mvp-master-build-5wckknn11-project-check.vercel.app/ , source SHA `56f04d68a1d50ba30521e7e87e1af2f1b50e04c8`, historical source ref `sandbox/page-review`. A deployed source ref is distinct from today's configured Production branch. No promotion or Production redeployment was performed.
- No project environment variables were returned by the connector; the dashboard also shows none added. **Enable access to System Environment Variables** is checked. This does not mean application configuration is absent: source configuration is described below.
- Stuart explicitly approved saving a Custom Ignored Build Step that returns `0` only when `VERCEL_ENV=preview`, `VERCEL_GIT_COMMIT_REF=docs/continuity-v1-2026-10-29` and `VERCEL_GIT_COMMIT_SHA=bc1d800b4e97340df66a43479fcda3bfa1399206`; all other cases return `1`. This replaces Automatic, so automatic duplicate-SHA skipping must not be assumed equivalent. Local shell cases passed; the saved command was read back through Stuart's dashboard. This bounded approval grants no other configuration authority.
- The exact documentation commit was pushed and [draft PR #58](https://github.com/ProjectCheck-Raffers/Project-Check-MVP-Master-Build/pull/58) opened targeting `approved`. Vercel's attempted Preview `dpl_CHPn2exuzDiLrDevFUt8jBPg27Jf` is **BLOCKED**. GitHub status says “GitHub couldn’t verify an account for the commit.” Vercel links to account-configuration troubleshooting; the underlying account cause is not independently established. The custom skip command's actual execution remains **UNKNOWN**. No READY documentation Preview was verified.

**Historical stop gate — 30 October:** the saved skip rule was originally recorded for `bc1d800b4e97340df66a43479fcda3bfa1399206`; it did not automatically cover later commits.

**Current documented exception and gate — 1 November:** PR #58 records Stuart's later approval for the exact documentation SHAs `bc1d800b4e97340df66a43479fcda3bfa1399206` and `b88bcb0ae6ec9ecdae54777463e6e7775ce77944`; Vercel records the `b88bcb0` Preview as **CANCELED** by the ignored-build-step result. This is a bounded two-SHA exception only. Later documentation heads built normally as Previews: `b2dcd6e` and `8a6facd` are READY (see below). Access/backend mapping remains pending independent verification. Each later documentation head requires a fresh Preview and check read-back before merge. Any additional documentation SHA or merge SHA requires a fresh live-rule check and explicit Stuart approval. Do not rewrite the original commit's author, change permissions, weaken protections, redeploy or use a different identity to bypass the block.

### PR #58 current deployment read-back — 1 November 2026

- Earlier record: the verified PR head at that read-back was `b2dcd6e9d46ca41ee69c57b876fca8e84bbdefd5` on `docs/continuity-v1-2026-10-29`, preserving the original two-commit snapshot plus subsequent consistency updates. The four-commit review candidate ended at `9496bc869ef3c129bc3e636c104230e0d787ede9`; this record follows later consistency updates.
- Vercel reports READY Preview deployment `dpl_vhfy9WtzUeFjtvQiEXUCCi4Cmr4d`, sourced from `docs/continuity-v1-2026-10-29` at `b2dcd6e9d46ca41ee69c57b876fca8e84bbdefd5`. Preview URL: https://project-check-mvp-master-build-git-docs-co-bdcf1e-project-check.vercel.app/
- VERIFIED Preview mapping supplied with Stuart's 1 November instruction: deployment `dpl_GYb7sBTJpGwSUQGuLJpJ22nXt2WH`, READY, branch `docs/continuity-v1-2026-10-29`, source `8a6facd793d218d6e63588f43913abec86566e59`, target **Preview, not Production**. This is the verified earlier deployment record for `8a6facd`.
- The documentation-only cleaning commit that follows `8a6facd` is a new head; its Vercel Preview and GitHub checks must be read back before merge.
- The observed Production deployment remains `dpl_GXHdfAnBS8APo4NaEGXSuPXBzqSY`, sourced from historical `sandbox/page-review` SHA `56f04d68a1d50ba30521e7e87e1af2f1b50e04c8`; no PR #58 head appeared as a Production deployment in this read-back. This confirms current observed routing only and does not prove application or backend isolation.

## Supabase — test project

**VERIFIED at Step 2 inspection:** `[Supabase project ref redacted]`, “Project Check Test Platform”, region eu-west-1, status INACTIVE. Service reference is not a credential.

**VERIFIED source comparison during the Vercel safety investigation:** approved documentation baseline `226556cdc1d0ba2efc4d118ceacff8aefcc3ba40` and existing Production source `56f04d68a1d50ba30521e7e87e1af2f1b50e04c8` contain identical `Project-Check-MVP-Master-Build/platform-config.js`, referencing `[Supabase project ref redacted]`. Both source versions therefore reference the same backend project. This does not establish current live connectivity, credential privileges, data contents or a working connection. The “Test Platform” name and earlier INACTIVE status do not prove safe separation from Production. Do not publish credential values.

**UNKNOWN:** current live schema/RLS/auth/storage correctness, working application connection, backup/restore coverage and production separation. Source migration files are not proof of applied schema or live-data recovery. No resume, query causing changes, migration or permission modification is authorised.

## GitHub Actions and legacy hosting

**VERIFIED inspected workflow definitions on approved:** CI, CodeQL, secrets scan and device/browser tests run on PRs targeting approved/sandbox; push branches include approved, sandbox and work/**. No Markdown path exclusion was found. The proposed docs/ branch avoids that work/** push pattern, not PR-triggered checks.

The existing deploy-pages workflow responds to pushes on `trial/direction-c-complete-working-model` and manual dispatch; it can write the review archive and deploy Pages. Do not dispatch it. Historical PLATFORM-SETUP/TEST-PLATFORM-GOVERNANCE bodies do not authorise that route.

Codespaces devcontainer defines private port 5099, dependency installation on creation and a preview server on start. Its existence is VERIFIED configuration evidence; live Codespaces and clean working trees remain UNKNOWN. A localhost/forwarded development port is not the permanent Founder Test environment.

## Future delivery boundary

**PLANNED:** Development → Sandbox (a future test stage, not the historical sandbox branch) → Automated Testing → Founder Test → Approved Production. Require exact source/deployment identities, relevant passing tests, independent security review, mobile/desktop Founder Test, explicit release approval and a verified rollback plan. No step is configured or approved for deployment by this record.

Update after an authorised mapping change or fresh evidence changing status. Record timestamp, source SHA, immutable deployment identity, access restrictions and database mapping without secret values. See RECOVERY for restoration limits and MASTER for existing CI failures.
