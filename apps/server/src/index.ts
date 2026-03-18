import path from "node:path";
import { createServer } from "node:http";
import { existsSync } from "node:fs";
import cors from "cors";
import express from "express";
import { Server } from "socket.io";

import { buildGateway } from "./core/gateway";
import { fetchOpenClawStatus } from "./core/openclawMonitor";
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
