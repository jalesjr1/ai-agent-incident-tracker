# AI Agent Incident Tracker

Living dashboard tracking confirmed AI-agent security incidents, refreshed weekly.
Companion to the **AI Agent Hacking Survey** (Obsidian AI Research Vault →
`Projects/AI Agent Hacking Survey/`). Linked from the Substack article as the
live "see the tracker" artifact.

## Architecture (matches the data-dashboard skill + curryales infra)

```
data/incidents.json   # CURATED SOURCE OF TRUTH — hand-edited, one object per incident
scripts/build.py      # incidents.json -> dashboard.js (computes median lag, new-this-week)
dashboard.js          # renderer (Chart.js panels + text lists)
index.html            # shell + styles
assets/chart.min.js   # vendored Chart.js (no CDN)
serve.sh              # python3 -m http.server :8080
scripts/deploy.sh     # build + commit + push to GitHub Pages
```

Single page, no backend, no build toolchain beyond `python3 scripts/build.py`.
Chart.js is vendored so it renders in sandboxed/offline contexts.

## Refresh cadence (default: weekly Monday 06:00 ET)

1. Add any new incidents to `data/incidents.json` by hand (copy an existing
   entry, update fields, append to the array).
2. Run `python3 scripts/build.py` — regenerates `dashboard.js` and syncs the
   totals in `metadata` back into `incidents.json`.
3. `scripts/deploy.sh` commits and pushes to GitHub Pages.

Optional automated step: a weekly cron can run `build.py` + `deploy.sh` and
Telegram-deliver a "this week in AI agent incidents" digest to the research thread.

## Schema (per incident)

```json
{
  "id": "unique-slug",
  "incidentDate": "YYYY-MM-DD",      // compromise date
  "disclosureDate": "YYYY-MM-DD",    // public disclosure date
  "actor": "who/what",
  "actorType": "frontier-lab-eval|frontier-lab-production|commercial-lab-distillation|vulnerability-researcher|commodity-attacker|unknown",
  "target": "what was hit",
  "targetType": "govenment-*|ecommerce-multiple|private-ai-platform|ai-coding-agent|agent-ide|agent-framework|frontier-model|...",
  "discoveredBy": "who found it",
  "primarySource": "https://",
  "summary": "one line",
  "campImpact": { "camp-1-existential":N, "camp-2-loss-of-control":N, "camp-3-engineer-skeptic":N, "camp-4-move-fast":N, "camp-5-eval-artifact":N, "camp-6-commodity-attacker":N },
  "method": "string",
  "severity": "critical|high|medium|low",
  "cveIds": [],
  "recordsExfiltrated": null|int,
  "estimatedCostUsd": null|int,
  "tags": [],
  "countryTargets": ["US","AU",...],
  "evidencePublicDataset": false|true,
  "notes": "free text for the article"
}
```

`campImpact` is signed (−2..+3): + = strengthens that camp's position, − = weakens.

## Six-camp taxonomy (v1, adopted per Joe's "default")

1. camp-1-existential — ban / moratorium / kill-switch
2. camp-2-loss-of-control — bounded near-term control loss (Cotra, Amodei, Hobbhahn)
3. camp-3-engineer-skeptic — Mitchell/McGraw: sandbox + reward hacking, not agency
4. camp-4-move-fast — regulation is theater, more defensive AI
5. camp-5-eval-artifact — incidents are benchmark-design artifacts
6. camp-6-commodity-attacker — OSS harness + paid API, attacker tooling layer (NEW)