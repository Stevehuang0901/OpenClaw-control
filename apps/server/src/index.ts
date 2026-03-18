import path from "node:path";
import { createServer } from "node:http";
import { existsSync } from "node:fs";
import cors from "cors";
import express from "express";
import { Server } from "socket.io";

import { APPROVAL_STATUSES } from "../../../packages/shared/src/index";
import { buildGateway } from "./core/gateway";
import { createOpenClawTaskExecutor } from "./core/openclawExecutor";
import { probeGatewayConnection, validateGatewayUrl } from "./core/gatewayProbe";
import { fetchOpenClawStatus } from "./core/openclawMonitor";
import {
  getCatalogSkillDetail,
  getManagedSkillDetail,
  installSkillFromCatalog,
  listManagedSkills,
  listOpenClawSkills,
  searchSkillCatalog,
  uninstallManagedSkill,
  updateManagedSkill
} from "./core/skillManager";
import { seedAgents } from "./data/seedAgents";

const gateway = buildGateway(seedAgents(), {
  executor: createOpenClawTaskExecutor()
});
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

app.get("/api/approvals", (_request, response) => {
  response.json(gateway.getSnapshot().approvals);
});

app.post("/api/approvals/:approvalId", (request, response) => {
  const status = typeof request.body?.status === "string" ? request.body.status : "";
  const reviewer =
    typeof request.body?.reviewer === "string" ? request.body.reviewer : null;
  const decisionNote =
    typeof request.body?.decisionNote === "string" ? request.body.decisionNote : null;

  if (!APPROVAL_STATUSES.includes(status as (typeof APPROVAL_STATUSES)[number])) {
    response.status(400).json({
      error: "status must be one of pending, approved, or rejected"
    });
    return;
  }

  const approval = gateway.updateApproval({
    approvalId: request.params.approvalId,
    status,
    reviewer,
    decisionNote
  });

  if (!approval) {
    response.status(404).json({
      error: "Approval not found."
    });
    return;
  }

  response.json(approval);
});

app.post("/api/gateway/probe", async (request, response) => {
  const gatewayUrl =
    typeof request.body?.gatewayUrl === "string" ? request.body.gatewayUrl : "";
  const validationError = validateGatewayUrl(gatewayUrl);

  if (validationError) {
    response.status(400).json({
      error: validationError
    });
    return;
  }

  try {
    const result = await probeGatewayConnection({
      gatewayUrl,
      gatewayToken:
        typeof request.body?.gatewayToken === "string"
          ? request.body.gatewayToken
          : undefined,
      gatewayDisableDevicePairing: Boolean(
        request.body?.gatewayDisableDevicePairing
      ),
      gatewayAllowInsecureTls: Boolean(request.body?.gatewayAllowInsecureTls)
    });

    response.json(result);
  } catch (error) {
    response.status(500).json({
      error: error instanceof Error ? error.message : "Failed to probe gateway."
    });
  }
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

app.get("/api/skills/managed", async (_request, response) => {
  try {
    const skills = await listManagedSkills();
    response.json(skills);
  } catch (error) {
    response.status(500).json({
      error: error instanceof Error ? error.message : "Failed to load managed skills."
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

app.get("/api/skills/catalog/:slug", async (request, response) => {
  try {
    const detail = await getCatalogSkillDetail(request.params.slug);
    response.json(detail);
  } catch (error) {
    response.status(500).json({
      error: error instanceof Error ? error.message : "Failed to inspect skill."
    });
  }
});

app.get("/api/skills/managed/:slug", async (request, response) => {
  try {
    const detail = await getManagedSkillDetail(request.params.slug);
    response.json(detail);
  } catch (error) {
    response.status(404).json({
      error: error instanceof Error ? error.message : "Managed skill not found."
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

app.post("/api/skills/update", async (request, response) => {
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

    const result = await updateManagedSkill(slug, version);
    response.status(200).json(result);
  } catch (error) {
    response.status(500).json({
      error: error instanceof Error ? error.message : "Failed to update skill."
    });
  }
});

app.post("/api/skills/uninstall", async (request, response) => {
  try {
    const slug = typeof request.body?.slug === "string" ? request.body.slug.trim() : "";

    if (!slug) {
      response.status(400).json({
        error: "slug is required"
      });
      return;
    }

    const result = await uninstallManagedSkill(slug);
    response.status(200).json(result);
  } catch (error) {
    response.status(500).json({
      error: error instanceof Error ? error.message : "Failed to uninstall skill."
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
  if (process.env.CLAWCONTROL_BOOTSTRAP_DEMOS === "true") {
    gateway.bootstrapDemo();
  }
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
