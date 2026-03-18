import { startTransition, useEffect, useState } from "react";
import { io } from "socket.io-client";

import { AgentRoster } from "./components/AgentRoster";
import { EventFeed } from "./components/EventFeed";
import { MetricStrip } from "./components/MetricStrip";
import { OpenClawUsagePanel } from "./components/OpenClawUsagePanel";
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

    const socket = io({
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
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <header className="panel p-5">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-2xl">
              <p className="pixel-label">ClawControl</p>
              <h1 className="mt-3 text-4xl font-bold tracking-tight text-ink sm:text-5xl">
                Multi-agent office for OpenClaw-style workflows
              </h1>
              <p className="mt-4 text-base leading-relaxed text-ink/75">
                A central gateway routes role-based tasks across collector,
                analyzer, writer, and validator desks while the dashboard renders
                handoffs in real time.
              </p>
            </div>

            <div className="min-w-[280px] rounded-none border-2 border-ink bg-paper p-4 shadow-pixel">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs uppercase tracking-[0.25em] text-ink/55">
                  Gateway link
                </p>
                <span
                  className={`rounded-none border-2 border-ink px-2 py-1 text-[10px] uppercase tracking-[0.2em] ${
                    connected ? "bg-mint/40 text-ink" : "bg-coral/20 text-coral"
                  }`}
                >
                  {connected ? "Connected" : "Disconnected"}
                </span>
              </div>
              <p className="mt-3 text-sm text-ink/75">
                Submit a request and watch the office desks split the work,
                exchange packets, and validate the final product.
              </p>
            </div>
          </div>

          <form
            className="mt-6 grid gap-4 xl:grid-cols-[1fr_auto]"
            onSubmit={(event) => {
              event.preventDefault();
              if (!prompt.trim() || submitting) {
                return;
              }

              void submitWorkflow(prompt);
            }}
          >
            <label className="sr-only" htmlFor="workflow-prompt">
              Workflow prompt
            </label>
            <textarea
              id="workflow-prompt"
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              className="min-h-[108px] rounded-none border-2 border-ink bg-white/80 px-4 py-3 text-base leading-relaxed text-ink shadow-pixel outline-none transition focus:border-teal"
              placeholder="Describe the product you want the agents to deliver..."
            />
            <div className="flex flex-col gap-3">
              <button
                type="submit"
                className="rounded-none border-2 border-ink bg-teal px-5 py-4 text-sm font-bold uppercase tracking-[0.2em] text-paper shadow-pixel transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:bg-slate disabled:text-white/70"
                disabled={submitting || !prompt.trim()}
              >
                {submitting ? "Routing..." : "Dispatch workflow"}
              </button>
              <button
                type="button"
                className="rounded-none border-2 border-ink bg-paper px-5 py-4 text-sm font-bold uppercase tracking-[0.2em] text-ink shadow-pixel transition hover:-translate-y-0.5"
                onClick={() => setPrompt(starterPrompt)}
              >
                Use starter brief
              </button>
            </div>
          </form>

          {error ? (
            <div className="mt-4 rounded-none border-2 border-coral bg-coral/15 px-4 py-3 text-sm text-coral">
              {error}
            </div>
          ) : null}
        </header>

        <MetricStrip metrics={snapshot.metrics} />

        <div className="grid gap-6 xl:grid-cols-[1.45fr_0.95fr]">
          <div className="space-y-6">
            <OfficeScene
              agents={snapshot.agents}
              workflows={snapshot.workflows}
              handoffs={snapshot.handoffs}
            />
            <WorkflowPanel
              workflows={snapshot.workflows}
              agents={snapshot.agents}
            />
          </div>

          <div className="space-y-6">
            <AgentRoster
              agents={snapshot.agents}
              workflows={snapshot.workflows}
            />
            <OpenClawUsagePanel openclaw={snapshot.openclaw} />
            <EventFeed
              agents={snapshot.agents}
              events={events}
              messages={snapshot.messages}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
