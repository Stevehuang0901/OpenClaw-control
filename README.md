# ClawControl

ClawControl is a full end-to-end multi-agent control room built for OpenClaw-style workflows. A central gateway orchestrates role-based agents, routes task handoffs, exposes live state over WebSockets, and powers a pixel-office dashboard that shows work moving desk to desk in real time.

## What it does

- Runs a shared gateway that creates workflows, tracks task dependencies, and logs every handoff.
- Simulates multiple agents with distinct roles: collector, analyzer, writer, and validator.
- Broadcasts live snapshots and event logs over Socket.IO.
- Visualizes the office as a retro pixel workspace with animated task packets between desks.
- Shows workflow queue state, task ownership, final output, metrics, and agent-to-agent messages.
- Polls `openclaw status --usage --json` to display real OpenClaw provider quota, recent session token usage, cache reads, and gateway reachability.
- Integrates ClawHub search and install flows so you can search remote skills and install them into OpenClaw from the dashboard.

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

The backend seeds demo workflows automatically a few seconds after boot so the office starts moving immediately.

If the `openclaw` CLI is installed on the host, the dashboard also pulls live usage data from your local OpenClaw environment every 60 seconds.

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
- `GET /api/skills/catalog?query=<term>&limit=<n>` searches ClawHub and returns installable skills.
- `POST /api/skills/install` installs a ClawHub skill into the OpenClaw managed skills directory.
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

- Workflow estimates: each simulated task and workflow includes estimated token usage so you can compare relative workload between desks.
- Real OpenClaw usage: the server polls `openclaw status --usage --json` and surfaces:
  - provider quota windows
  - recent session `inputTokens`, `outputTokens`, `cacheRead`, and `totalTokens`
  - gateway reachability and latency

This aligns with the OpenClaw CLI and the OpenResponses API, where provider-reported `usage` is populated when the underlying model returns token counts.

## Skills marketplace

The dashboard now includes a skill marketplace panel backed by:

- `openclaw skills list --json` for local/bundled/managed skill visibility
- `clawhub search` plus `clawhub inspect --json` for remote discovery
- `clawhub install` for one-click installation

Implementation note:

- The app installs skills into the OpenClaw `managedSkillsDir` reported by the local CLI snapshot so new installs land where OpenClaw can pick them up.
- Based on the current ClawHub/OpenClaw docs, starting a new OpenClaw session is the safe way to ensure a freshly installed skill is picked up immediately.

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
