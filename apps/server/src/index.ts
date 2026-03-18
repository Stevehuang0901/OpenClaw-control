import path from "node:path";
import { createServer } from "node:http";
import { existsSync } from "node:fs";
import cors from "cors";
import express from "express";
import { Server } from "socket.io";

import { buildGateway } from "./core/gateway";
import { fetchOpenClawStatus } from "./core/openclawMonitor";
import {
  installSkillFromCatalog,
  listOpenClawSkills,
  searchSkillCatalog
} from "./core/skillManager";
import { seedAgents } from "./data/seedAgents";

const gateway = buildGateway(seedAgents());
const app = express();

app.use(
  cors({
    origin: true,
    credentials: true
  })
);
app.use(express.json());

app.get("/api/health", (_request, response) => {
  response.json({ ok: true, timestamp: new Date().toISOString() });
});

app.get("/api/state", (_request, response) => {
  response.json(gateway.getSnapshot());
});

app.get("/api/openclaw/status", (_request, response) => {
  response.json(gateway.getSnapshot().openclaw);
});

app.get("/api/skills/openclaw", async (_request, response) => {
  try {
    const skills = await listOpenClawSkills();
    response.json(skills);
  } catch (error) {
    response.status(500).json({
      error: error instanceof Error ? error.message : "Failed to load OpenClaw skills."
    });
  }
});

app.get("/api/skills/catalog", async (request, response) => {
  try {
    const query =
      typeof request.query.query === "string" ? request.query.query.trim() : "";
    const limit = Number(request.query.limit ?? 8);

    if (!query) {
      response.json({
        query: null,
        items: []
      });
      return;
    }

    const catalog = await searchSkillCatalog(query, Number.isFinite(limit) ? limit : 8);
    response.json(catalog);
  } catch (error) {
    response.status(500).json({
      error: error instanceof Error ? error.message : "Failed to search ClawHub."
    });
  }
});

app.post("/api/skills/install", async (request, response) => {
  try {
    const slug = typeof request.body?.slug === "string" ? request.body.slug.trim() : "";
    const version =
      typeof request.body?.version === "string" ? request.body.version.trim() : undefined;

    if (!slug) {
      response.status(400).json({
        error: "slug is required"
      });
      return;
    }

    const result = await installSkillFromCatalog(slug, version);
    response.status(201).json(result);
  } catch (error) {
    response.status(500).json({
      error: error instanceof Error ? error.message : "Failed to install skill."
    });
  }
});

app.post("/api/workflows", (request, response) => {
  const prompt = typeof request.body?.prompt === "string" ? request.body.prompt : "";

  if (!prompt.trim()) {
    response.status(400).json({
      error: "prompt is required"
    });
    return;
  }

  const workflow = gateway.submitWorkflow(prompt);
  response.status(201).json(workflow);
});

const webBuildPath = path.join(process.cwd(), "dist", "web");
if (existsSync(webBuildPath)) {
  app.use(express.static(webBuildPath));
  app.get("*", (request, response, next) => {
    if (request.path.startsWith("/api")) {
      next();
      return;
    }

    response.sendFile(path.join(webBuildPath, "index.html"));
  });
}

const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: true,
    credentials: true
  }
});

io.on("connection", (socket) => {
  socket.emit("snapshot", gateway.getSnapshot());
});

gateway.subscribe(
  (event) => {
    io.emit("event", event);
  },
  (snapshot) => {
    io.emit("snapshot", snapshot);
  }
);

const port = Number(process.env.PORT ?? 8787);
server.listen(port, () => {
  gateway.bootstrapDemo();
  void refreshOpenClawStatus();
  setInterval(() => {
    void refreshOpenClawStatus();
  }, 60_000);
  // eslint-disable-next-line no-console
  console.log(`ClawControl gateway listening on http://localhost:${port}`);
});

const refreshOpenClawStatus = async () => {
  const status = await fetchOpenClawStatus();
  gateway.setOpenClawStatus(status);
};
