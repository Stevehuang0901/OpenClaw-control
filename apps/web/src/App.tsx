import { startTransition, useEffect, useState } from "react";
import { io } from "socket.io-client";

import { AgentRoster } from "./components/AgentRoster";
import { EventFeed } from "./components/EventFeed";
import { MetricStrip } from "./components/MetricStrip";
import { MissionControlPanel } from "./components/MissionControlPanel";
import { OpenClawUsagePanel } from "./components/OpenClawUsagePanel";
import { SkillMarketplacePanel } from "./components/SkillMarketplacePanel";
import { OfficeScene } from "./components/OfficeScene";
import { WorkflowPanel } from "./components/WorkflowPanel";
import type { GatewayEvent, SystemSnapshot } from "./types/contracts";

const emptySnapshot: SystemSnapshot = {
  generatedAt: new Date(0).toISOString(),
  agents: [],
  workflows: [],
  messages: [],
  handoffs: [],
  metrics: {
    totalWorkflows: 0,
    completedWorkflows: 0,
    runningWorkflows: 0,
    tasksCompleted: 0,
    pendingTasks: 0,
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
  "Build a full OpenClaw-style multi-agent system with an office dashboard, live task handoffs, and final delivery output.";

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
        setEvents((current) => [event, ...current].slice(0, 30));
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
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#fff5de_0%,#f7ecd8_34%,#e0cfb3_100%)] px-4 py-6 text-ink sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-[1500px] flex-col gap-6">
        <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <p className="pixel-label">ClawControl</p>
            <h1 className="mt-3 text-4xl font-bold tracking-tight text-ink sm:text-5xl">
              OpenClaw mission control with a chaotic little crustacean office
            </h1>
            <p className="mt-4 text-base leading-relaxed text-ink/75">
              Submit work, watch the desks collaborate in real time, inspect
              token and skill data, and see the final delivery appear without
              leaving the dashboard.
            </p>
          </div>

          <div className="rounded-none border-2 border-ink bg-paper/90 px-4 py-3 shadow-pixel">
            <p className="text-[10px] uppercase tracking-[0.24em] text-ink/55">
              Office pulse
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-ink/70">
              <span
                className={`rounded-none border-2 border-ink px-2 py-1 text-[10px] uppercase tracking-[0.18em] ${
                  connected ? "bg-mint/30 text-ink" : "bg-coral/20 text-coral"
                }`}
              >
                {connected ? "Gateway live" : "Gateway offline"}
              </span>
              <span>{snapshot.metrics.runningWorkflows} running</span>
              <span>{snapshot.metrics.completedWorkflows} shipped</span>
            </div>
          </div>
        </header>

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

        <MetricStrip metrics={snapshot.metrics} />

        <OfficeScene
          agents={snapshot.agents}
          workflows={snapshot.workflows}
          handoffs={snapshot.handoffs}
          messages={snapshot.messages}
        />

        <div className="grid gap-6 xl:grid-cols-[1.25fr_0.95fr]">
          <div className="space-y-6">
            <WorkflowPanel
              workflows={snapshot.workflows}
              agents={snapshot.agents}
              selectedWorkflowId={selectedWorkflowId}
              onSelectWorkflow={setSelectedWorkflowId}
            />
            <EventFeed
              agents={snapshot.agents}
              events={events}
              messages={snapshot.messages}
            />
          </div>

          <div className="space-y-6">
            <AgentRoster
              agents={snapshot.agents}
              workflows={snapshot.workflows}
              handoffs={snapshot.handoffs}
            />
            <OpenClawUsagePanel openclaw={snapshot.openclaw} />
            <SkillMarketplacePanel />
          </div>
        </div>
      </div>
    </div>
  );
}
