import fs from 'node:fs';
import path from 'node:path';

const siteDir = process.env.SITE_DIR;
const archiveDir = process.env.ARCHIVE_DIR;
const sha = process.env.GITHUB_SHA;
const shortSha = process.env.SHORT_SHA;
const message = process.env.COMMIT_MESSAGE || 'Committed test change';
const timestamp = process.env.COMMIT_TIMESTAMP || new Date().toISOString();
const figmaUrl = process.env.FIGMA_URL || '';
const indexPath = path.join(archiveDir, 'review-index.json');

let entries = [];
if (fs.existsSync(indexPath)) {
  try { entries = JSON.parse(fs.readFileSync(indexPath, 'utf8')).entries || []; } catch { entries = []; }
}

const current = { sha, shortSha, message, timestamp, path: `reviews/${shortSha}/`, figmaUrl };
entries = [current, ...entries.filter((entry) => entry.sha !== sha)];
entries.sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)));

const payload = { generatedAt: new Date().toISOString(), latest: current, entries };
fs.writeFileSync(path.join(siteDir, 'review-index.json'), JSON.stringify(payload, null, 2) + '\n');

const escapeHtml = (value = '') => String(value)
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;').replaceAll("'", '&#039;');

const rows = entries.map((entry, index) => `
  <article class="review-card">
    <div>
      <span class="status">${index === 0 ? 'LATEST' : 'COMMITTED'}</span>
      <h2>${escapeHtml(entry.message)}</h2>
      <p>${escapeHtml(entry.shortSha)} · ${escapeHtml(new Date(entry.timestamp).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/London' }))}</p>
    </div>
    <div class="actions">
      <a class="button primary" href="./${escapeHtml(entry.path)}">Open this build</a>
      <a class="button" href="https://github.com/ProjectCheck-Raffers/project-check-app/commit/${escapeHtml(entry.sha)}">View commit</a>
    </div>
  </article>`).join('');

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Project Check — Test Review Hub</title>
<style>
:root{--navy:#0b1b33;--green:#14833b;--mint:#eef8f1;--line:#d9e2dc;--muted:#697383}*{box-sizing:border-box}body{margin:0;font-family:Arial,Helvetica,sans-serif;color:var(--navy);background:#f8faf9}header{background:#fff;border-bottom:1px solid var(--line)}.wrap{width:min(1040px,calc(100% - 32px));margin:auto}.top{min-height:98px;display:flex;align-items:center;justify-content:space-between;gap:24px}.brand{width:min(360px,52vw);height:auto}.figma{color:var(--navy);font-weight:700;text-decoration:none;border:1px solid var(--line);padding:12px 16px;border-radius:12px}.hero{padding:52px 0 30px}.eyebrow{color:var(--green);font-weight:800;letter-spacing:.12em}.hero h1{font-size:clamp(38px,7vw,68px);margin:12px 0}.hero p{max-width:720px;color:var(--muted);font-size:20px;line-height:1.5}.latest{display:inline-block;margin-top:12px}.review-list{display:grid;gap:18px;padding:16px 0 64px}.review-card{display:flex;justify-content:space-between;gap:24px;align-items:center;background:#fff;border:1px solid var(--line);border-radius:22px;padding:24px;box-shadow:0 8px 24px rgba(11,27,51,.05)}.status{color:var(--green);font-size:12px;font-weight:900;letter-spacing:.12em}.review-card h2{margin:8px 0;font-size:22px}.review-card p{margin:0;color:var(--muted)}.actions{display:flex;gap:10px;flex-wrap:wrap}.button{display:inline-block;text-decoration:none;color:var(--navy);border:1px solid var(--line);border-radius:12px;padding:13px 16px;font-weight:800;white-space:nowrap}.primary{background:var(--green);color:#fff;border-color:var(--green)}@media(max-width:700px){.top{min-height:82px}.figma{font-size:14px;padding:10px}.hero{padding-top:36px}.review-card{align-items:flex-start;flex-direction:column}.actions{width:100%}.button{flex:1;text-align:center}.brand{width:220px;max-width:58vw}}
</style></head><body>
<header><div class="wrap top"><img class="brand" src="./assets/project-check-banner-logo.png" alt="Project Check — Know before you build."><a class="figma" href="${escapeHtml(figmaUrl)}">Open Figma</a></div></header>
<main class="wrap"><section class="hero"><div class="eyebrow">TEST PLATFORM</div><h1>Website review hub</h1><p>Every successful committed change is kept here. Open the latest test build or return to an exact earlier version.</p><a class="button primary latest" href="./">Open latest test build</a></section>
<section class="review-list" aria-label="Committed test builds">${rows}</section></main>
</body></html>`;

fs.writeFileSync(path.join(siteDir, 'review-hub.html'), html);
