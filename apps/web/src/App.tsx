import { startTransition, useEffect, useState } from "react";
import { io } from "socket.io-client";

import { AgentRoster } from "./components/AgentRoster";
import { ApprovalsPanel } from "./components/ApprovalsPanel";
import { EventFeed } from "./components/EventFeed";
import { GatewayOpsPanel } from "./components/GatewayOpsPanel";
import { MetricStrip } from "./components/MetricStrip";
import { MissionControlPanel } from "./components/MissionControlPanel";
import { OpenClawUsagePanel } from "./components/OpenClawUsagePanel";
import { OperationsSidebar } from "./components/OperationsSidebar";
import { SkillMarketplacePanel } from "./components/SkillMarketplacePanel";
import { OfficeScene } from "./components/OfficeScene";
import { TaskBoardPanel } from "./components/TaskBoardPanel";
import { WorkflowPanel } from "./components/WorkflowPanel";
import type { GatewayEvent, SystemSnapshot } from "./types/contracts";

const emptySnapshot: SystemSnapshot = {
  generatedAt: new Date(0).toISOString(),
  agents: [],
  workflows: [],
  approvals: [],
  messages: [],
  handoffs: [],
  metrics: {
    totalWorkflows: 0,
    completedWorkflows: 0,
    runningWorkflows: 0,
    tasksCompleted: 0,
    pendingTasks: 0,
    pendingApprovals: 0,
    averageHandoffMs: 0,
    averageCycleMs: 0,
    estimatedInputTokens: 0,
    estimatedOutputTokens: 0,
    estimatedTotalTokens: 0
  },
  openclaw: {
    available: false,
    source: "unavailable",
    updatedAt: null,
    error: null,
    providers: [],
    recentSessions: [],
    totals: {
      recentSessionCount: 0,
      inputTokens: 0,
      outputTokens: 0,
      cacheRead: 0,
      cacheWrite: 0,
      totalTokens: 0,
      averagePercentUsed: 0
    },
    gateway: {
      mode: null,
      url: null,
      reachable: false,
      connectLatencyMs: null,
      error: null
    }
  }
};

const starterPrompt =
  "Build a full OpenClaw-style multi-agent system with a dark pixel office, playful idle animations, approvals, token tracking, and a final delivery output.";

export default function App() {
  const [snapshot, setSnapshot] = useState<SystemSnapshot>(emptySnapshot);
  const [events, setEvents] = useState<GatewayEvent[]>([]);
  const [prompt, setPrompt] = useState(starterPrompt);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const loadInitialState = async () => {
      try {
        const response = await fetch("/api/state");
        if (!response.ok) {
          throw new Error("Failed to load gateway state.");
        }

        const data = (await response.json()) as SystemSnapshot;
        if (!mounted) {
          return;
        }

        startTransition(() => {
          setSnapshot(data);
        });
      } catch (loadError) {
        if (!mounted) {
          return;
        }

        setError(
          loadError instanceof Error ? loadError.message : "Unable to load state."
        );
      }
    };

    void loadInitialState();

    const socket =
      window.location.port === "5173"
        ? io(`${window.location.protocol}//${window.location.hostname}:8787`, {
            transports: ["websocket"]
          })
        : io({
            transports: ["websocket"]
          });

    socket.on("connect", () => {
      setConnected(true);
    });

    socket.on("disconnect", () => {
      setConnected(false);
    });

    socket.on("snapshot", (nextSnapshot: SystemSnapshot) => {
      startTransition(() => {
        setSnapshot(nextSnapshot);
      });
    });

    socket.on("event", (event: GatewayEvent) => {
      startTransition(() => {
        setEvents((current) => [event, ...current].slice(0, 40));
      });
    });

    return () => {
      mounted = false;
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    if (snapshot.workflows.length === 0) {
      if (selectedWorkflowId !== null) {
        setSelectedWorkflowId(null);
      }
      return;
    }

    if (
      !selectedWorkflowId ||
      !snapshot.workflows.some((workflow) => workflow.id === selectedWorkflowId)
    ) {
      setSelectedWorkflowId(snapshot.workflows[0].id);
    }
  }, [selectedWorkflowId, snapshot.workflows]);

  const submitWorkflow = async (nextPrompt: string) => {
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/workflows", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          prompt: nextPrompt
        })
      });

      if (!response.ok) {
        throw new Error("The gateway rejected the workflow request.");
      }

      const workflow = (await response.json()) as { id: string };
      setSelectedWorkflowId(workflow.id);
      setPrompt("");
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Unable to create workflow."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#09070d] px-3 py-4 text-ink sm:px-4 lg:px-5">
      <div className="mx-auto grid max-w-[1700px] gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <OperationsSidebar
          approvals={snapshot.approvals}
          connected={connected}
          metrics={snapshot.metrics}
          openclaw={snapshot.openclaw}
          workflows={snapshot.workflows}
        />

        <main className="space-y-6">
          <header className="panel overflow-hidden">
            <div className="grid gap-5 px-5 py-5 xl:grid-cols-[1.1fr_0.9fr]">
              <div>
                <p className="pixel-label">ClawControl</p>
                <h1 className="mt-3 text-4xl font-bold tracking-tight text-ink sm:text-5xl">
                  Dark pixel mission control for the OpenClaw office
                </h1>
                <p className="mt-4 max-w-4xl text-base leading-relaxed text-ink/72">
                  Dispatch a task, watch the crustacean crew roam between desks,
                  cards, mahjong, and nap stations, then inspect approvals, gateway
                  health, token usage, and skill installs without leaving the room.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <HeaderCard
                  label="Gateway"
                  value={connected ? "online" : "offline"}
                  note={`${snapshot.metrics.runningWorkflows} workflows moving`}
                />
                <HeaderCard
                  label="Approvals"
                  value={String(snapshot.metrics.pendingApprovals)}
                  note="Release packages waiting"
                />
                <HeaderCard
                  label="OpenClaw"
                  value={snapshot.openclaw.available ? "live" : "cold"}
                  note={
                    snapshot.openclaw.gateway.reachable
                      ? "Gateway reachable"
                      : "Probe recommended"
                  }
                />
              </div>
            </div>
          </header>

          <div id="mission-input">
            <MissionControlPanel
              connected={connected}
              error={error}
              messages={snapshot.messages}
              prompt={prompt}
              selectedWorkflowId={selectedWorkflowId}
              submitting={submitting}
              workflows={snapshot.workflows}
              onPromptChange={setPrompt}
              onRestoreStarter={() => setPrompt(starterPrompt)}
              onSelectWorkflow={setSelectedWorkflowId}
              onSubmit={() => {
                void submitWorkflow(prompt);
              }}
            />
          </div>

          <MetricStrip metrics={snapshot.metrics} />

          <div id="office-floor">
            <OfficeScene
              agents={snapshot.agents}
              workflows={snapshot.workflows}
              handoffs={snapshot.handoffs}
              messages={snapshot.messages}
            />
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            <div id="task-board">
              <TaskBoardPanel
                approvals={snapshot.approvals}
                agents={snapshot.agents}
                selectedWorkflowId={selectedWorkflowId}
                workflows={snapshot.workflows}
                onSelectWorkflow={setSelectedWorkflowId}
              />
            </div>
            <div id="approvals">
              <ApprovalsPanel
                approvals={snapshot.approvals}
                workflows={snapshot.workflows}
              />
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
            <div id="workflow-trace">
              <WorkflowPanel
                workflows={snapshot.workflows}
                agents={snapshot.agents}
                selectedWorkflowId={selectedWorkflowId}
                onSelectWorkflow={setSelectedWorkflowId}
              />
            </div>
            <div id="activity-feed">
              <EventFeed
                agents={snapshot.agents}
                events={events}
                messages={snapshot.messages}
              />
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
            <div id="gateway-ops">
              <GatewayOpsPanel openclaw={snapshot.openclaw} />
            </div>
            <div id="agents">
              <AgentRoster
                agents={snapshot.agents}
                workflows={snapshot.workflows}
                handoffs={snapshot.handoffs}
              />
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
            <div id="openclaw-usage">
              <OpenClawUsagePanel openclaw={snapshot.openclaw} />
            </div>
            <div id="skills">
              <SkillMarketplacePanel />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

function HeaderCard({
  label,
  value,
  note
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <article className="rounded-none border-2 border-ink/15 bg-[#15101d] px-4 py-4 shadow-pixel">
      <p className="text-[10px] uppercase tracking-[0.24em] text-ink/48">{label}</p>
      <p className="mt-2 text-2xl font-bold text-ink">{value}</p>
      <p className="mt-3 text-sm text-ink/62">{note}</p>
    </article>
  );
}
