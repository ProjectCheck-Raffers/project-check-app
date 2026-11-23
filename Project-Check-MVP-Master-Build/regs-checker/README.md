# regs-checker – Stage 1 "Potential issues"

England only, industrial/storage steel buildings. Stage 1 (free) shows **potential problems only**, using the client's own numbers – never solutions, methods, products or costs. Stage 2 solutions are not built yet.

Files: `rules.json` (the rules – the only file Stuart edits), `checker.js` (pure `runChecks(projectData)`; do not edit for wording or approvals).

## Add / change / approve a rule by editing `rules.json` only

Each rule has: `id`, `part` (A, B, L…), `regsRef`, `trigger` (plain-English description), `stage1Problem`, `stage1WhyItMatters`, `stage2Solution` ("Stuart to write"), `approved`.

- **Approve a rule:** set `"approved": true`. Rules with `false` are never shown to clients.
- **Change wording:** edit `stage1Problem` / `stage1WhyItMatters`. Placeholders `{elevation}`, `{distance}`, `{travel}` are filled with the client's numbers. Keep Stage 1 wording to the problem only.
- **Change a number:** limits live in the rule: `limits` and `factor` (B_TRAVEL), `limits` (B_EXITS), `dates` (L_2027). Changing the numbers here changes the check.
- **Write the Stage 2 answer:** replace `"Stuart to write"` in `stage2Solution`. It is not shown in Stage 1.
- **Add a brand-new rule:** the rule text goes in `rules.json`, but its maths needs a matching function in `checker.js` (keyed by `id`). A rule in `rules.json` with no function is ignored. Ask Claude to add the function.

## Results

`runChecks` returns `[{ruleId, result, measured, stage1Problem, stage1WhyItMatters}]`. `result` is `ok`, `potential problem` or `need info`. A missing answer is always `need info` – never shown as a problem and never guessed. If the nation is not England, no checks run.

The results are saved to `project.backgroundChecks.regsChecker` when the user presses "Design confirmed", and shown in the Stage 1 report under "Potential issues to review".
