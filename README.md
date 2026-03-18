# ClawControl

ClawControl is a full end-to-end multi-agent control room built for OpenClaw-style workflows. A central gateway orchestrates role-based agents, routes task handoffs, exposes live state over WebSockets, and powers a pixel-office dashboard that shows work moving desk to desk in real time.

## What it does

- Runs a shared gateway that creates workflows, tracks task dependencies, and logs every handoff.
- Routes multiple role-based desks: collector, analyzer, writer, and validator.
- Uses `openclaw agent --local --agent main --json` to generate real task packets when the local CLI is available, and falls back to the built-in simulator if a live turn fails.
- Broadcasts live snapshots and event logs over Socket.IO.
- Visualizes the office as a retro pixel workspace with animated task packets, walking lobster agents, and idle lounge behaviors like cards, mahjong, arcade, and naps.
- Shows workflow queue state, task ownership, final output, metrics, and agent-to-agent messages.
- Polls `openclaw status --usage --json` to display real OpenClaw provider quota, recent session token usage, cache reads, and gateway reachability.
- Integrates ClawHub search, inspect, install, update, and uninstall flows so you can manage skills from the dashboard.

## Stack

- Backend: Node.js, Express, Socket.IO, TypeScript
- Frontend: React, Vite, Tailwind CSS
- Testing: Vitest

## Project structure

```text
apps/
  server/
    src/
      core/gateway.ts      # task orchestration, state machine, metrics
      data/seedAgents.ts   # agent roster and desk layout
      index.ts             # REST API + Socket.IO server
  web/
    src/
      App.tsx              # dashboard shell and workflow submission
      components/          # office scene, metrics, roster, logs, queue
packages/
  shared/
    src/index.ts           # shared types and role metadata
```

## Quick start

```bash
npm install
npm run dev
```

This starts:

- Backend gateway on `http://localhost:8787`
- Frontend dashboard on `http://localhost:5173`

By default the dashboard starts clean so you can type a real task into Mission Control right away.

If the `openclaw` CLI is installed and configured on the host, workflow steps are executed through real OpenClaw agent turns and the dashboard also pulls live usage data every 60 seconds.

If you want the old auto-demo behavior back for presentations, start the server with:

```bash
CLAWCONTROL_BOOTSTRAP_DEMOS=true npm run dev
```

## Production build

```bash
npm run build
npm start
```

After `npm run build`, the backend serves the built dashboard from `dist/web`.

## Scripts

- `npm run dev` runs backend and frontend together.
- `npm run build` creates the production frontend bundle and server build.
- `npm start` runs the built server.
- `npm test` runs the workflow test suite.

## API

- `GET /api/health` basic health check.
- `GET /api/state` returns the latest full gateway snapshot.
- `GET /api/openclaw/status` returns the latest OpenClaw usage snapshot gathered from the local CLI.
- `GET /api/skills/openclaw` returns the current OpenClaw skill inventory from `openclaw skills list --json`.
- `GET /api/skills/managed` returns ClawHub-managed installs under the OpenClaw managed skills directory.
- `GET /api/skills/catalog?query=<term>&limit=<n>` searches ClawHub and returns installable skills.
- `GET /api/skills/catalog/:slug` returns remote skill detail plus latest `SKILL.md` content.
- `GET /api/skills/managed/:slug` returns the locally installed `SKILL.md` content for a managed skill.
- `POST /api/skills/install` installs a ClawHub skill into the OpenClaw managed skills directory.
- `POST /api/skills/update` updates an installed managed skill.
- `POST /api/skills/uninstall` removes an installed managed skill.
- `POST /api/workflows` creates a new workflow.

Request body:

```json
{
  "prompt": "Build a multi-agent release workflow with a live office dashboard."
}
```

## Workflow model

Each workflow is split into four ordered tasks:

1. Collector gathers context.
2. Analyzer turns context into a plan.
3. Writer drafts the implementation package.
4. Validator checks the result and marks the workflow complete.

Task states move through:

`pending -> in_progress -> done -> handed_off -> completed`

## OpenClaw usage monitoring

The dashboard now exposes two usage layers:

- Workflow usage: each task and workflow shows token usage. When a live OpenClaw turn succeeds, the task usage is populated from reported `lastCallUsage`; when it fails or OpenClaw is unavailable, the app falls back to estimated usage.
- Real OpenClaw usage: the server polls `openclaw status --usage --json` and surfaces:
  - provider quota windows
  - recent session `inputTokens`, `outputTokens`, `cacheRead`, and `totalTokens`
  - gateway reachability and latency

This aligns with the OpenClaw CLI and the OpenResponses API, where provider-reported `usage` is populated when the underlying model returns token counts.

## Skills marketplace

The dashboard now includes a skill marketplace panel backed by:

- `openclaw skills list --json` for local/bundled/managed skill visibility
- `clawhub search` plus `clawhub inspect --json` for remote discovery
- `clawhub install`, `clawhub update`, and `clawhub uninstall` for one-click management
- direct `SKILL.md` inspection for both remote catalog skills and locally installed managed skills

Implementation note:

- The app installs skills into the OpenClaw `managedSkillsDir` reported by the local CLI snapshot so new installs land where OpenClaw can pick them up.
- Based on the current ClawHub/OpenClaw docs, starting a new OpenClaw session is the safe way to ensure a freshly installed skill is picked up immediately.
- During local verification on March 18, 2026, `clawhub update` could refuse to overwrite a skill if the local files no longer match a published version, returning a message like `Use --force to overwrite.` The dashboard currently surfaces that error as-is instead of forcing an overwrite.

## GitHub submission

This repository is already initialized as a Git repo, but no remote is configured yet. To publish it:

```bash
git add .
git commit -m "Build ClawControl multi-agent office dashboard"
git remote add origin <your-github-repo-url>
git push -u origin main
```

## Verification

The project has been verified with:

```bash
npm test
npm run build
```
