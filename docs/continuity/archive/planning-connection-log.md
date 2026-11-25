> **Migrated 25 Nov 2026** from the private repo Project-Check-MVP-Master-Build (branch approved). Kept as the continuity record; references to the old repo, its Vercel project and its workflows describe the old setup. The live entry point is CLAUDE.md and docs/continuity/CURRENT-CHAT-INDEX.md in project-check-app. Client jobs are anonymised as Job A–O; IDs are redacted.

# Planning connection log

Postcode tested: [postcode redacted]
Purpose: Map which principal local authority planning search pages accept the postcode and return a results page. Connection result only. For API route mapping on PR #63.

| Authority | Search URL | HTTP status | Result | Note |
|-----------|------------|-------------|--------|------|
| Cheshire West and Chester | https://pa.cheshirewestandchester.gov.uk/online-applications/ | 200 | connected | Normal path: council page → How to view an application → Public Access button → postcode search. Results page returned (35 applications). Direct Idox URL returned 403 from this environment. |
