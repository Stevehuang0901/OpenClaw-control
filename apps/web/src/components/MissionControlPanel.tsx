import { formatClock, formatNumber, truncate } from "../lib/format";
import { taskStatusLabel, taskStatusTone } from "../lib/status";
import {
  buildWorkflowOutputPreview,
  getWorkflowProgress,
  getWorkflowSignalLine
} from "../lib/workflows";
import type { WorkflowRecord } from "../types/contracts";

interface MissionControlPanelProps {
  connected: boolean;
  error: string | null;
  prompt: string;
  selectedWorkflowId: string | null;
  submitting: boolean;
  workflows: WorkflowRecord[];
  onPromptChange: (value: string) => void;
  onRestoreStarter: () => void;
  onSubmit: () => void;
}

const promptSuggestions = [
  "Build a lively OpenClaw office where idle agents nap, play cards, and jump back into work when tasks arrive.",
  "Take this customer request, split it into research, planning, writing, validation, and approval, then show the final output.",
  "Create a live dashboard that installs skills, tracks token usage, probes gateways, and visualizes agent collaboration with a playful dark pixel scene."
];

export function MissionControlPanel({
  connected,
  error,
  prompt,
  selectedWorkflowId,
  submitting,
  workflows,
  onPromptChange,
  onRestoreStarter,
  onSubmit
}: MissionControlPanelProps) {
  const selectedWorkflow =
    workflows.find((workflow) => workflow.id === selectedWorkflowId) ??
    workflows[0] ??
    null;
  const progress = selectedWorkflow
    ? getWorkflowProgress(selectedWorkflow)
    : null;

  return (
    <section className="panel p-5">
      <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
        <div className="rounded-none border-2 border-ink/15 bg-[#130f1b] p-5 shadow-pixel">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-2xl">
              <p className="pixel-label">Operator Console</p>
              <h2 className="mt-3 text-3xl font-bold text-ink sm:text-4xl">
                Send a mission to the floor
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-ink/70">
                Write the task once. The gateway will route it through the crew,
                and the output will come back here as it finishes.
              </p>
            </div>

            <div className="min-w-[220px] rounded-none border-2 border-ink/15 bg-[#0f0c15] px-4 py-3 shadow-pixel">
              <p className="text-[10px] uppercase tracking-[0.24em] text-ink/48">
                Gateway
              </p>
              <div className="mt-3 flex items-center justify-between gap-3">
                <span
                  className={`rounded-none border-2 border-current px-2 py-1 text-[10px] uppercase tracking-[0.18em] ${
                    connected
                      ? "bg-mint/20 text-mint"
                      : "bg-coral/14 text-coral"
                  }`}
                >
                  {connected ? "Gateway live" : "Gateway offline"}
                </span>
                <span className="text-xs text-ink/60">
                  {workflows.length} requests
                </span>
              </div>
              <p className="mt-3 text-xs leading-relaxed text-ink/58">
                Type a request, submit it, and watch the crew move in the office
                above.
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <ConsoleStep
              index="01"
              title="Write the brief"
              detail="Describe the feature, task, or deliverable you want."
            />
            <ConsoleStep
              index="02"
              title="Crew picks it up"
              detail="Collectors, analyzers, writers, and validators handle each step."
            />
            <ConsoleStep
              index="03"
              title="Watch the result"
              detail="Output, progress, and collaboration notes update in real time."
            />
          </div>

          <form
            className="mt-6 space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (!prompt.trim() || submitting) {
                return;
              }

              onSubmit();
            }}
          >
            <label className="sr-only" htmlFor="workflow-prompt">
              Workflow prompt
            </label>
            <textarea
              id="workflow-prompt"
              value={prompt}
              onChange={(event) => onPromptChange(event.target.value)}
              className="min-h-[160px] w-full rounded-none border-2 border-ink/20 bg-[#0d0a13] px-4 py-4 text-base leading-relaxed text-ink shadow-pixel outline-none transition focus:border-teal"
              placeholder="Describe the task you want the crew to execute..."
            />

            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                className="rounded-none border-2 border-ink bg-teal px-5 py-3 text-sm font-bold uppercase tracking-[0.2em] text-[#071111] shadow-pixel transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:bg-slate disabled:text-[#f0e5ca]/65"
                disabled={submitting || !prompt.trim()}
              >
                {submitting ? "Routing..." : "Start mission"}
              </button>
              <button
                type="button"
                className="rounded-none border-2 border-ink bg-[#1b1526] px-5 py-3 text-sm font-bold uppercase tracking-[0.2em] text-ink shadow-pixel transition hover:-translate-y-0.5"
                onClick={onRestoreStarter}
              >
                Restore starter brief
              </button>
            </div>
          </form>

          <div className="mt-5">
            <p className="text-[10px] uppercase tracking-[0.24em] text-ink/48">
              Quick fills
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {promptSuggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  className="rounded-none border-2 border-ink/15 bg-[#0f0c15] px-3 py-2 text-left text-xs leading-relaxed text-ink/72 transition hover:-translate-y-0.5 hover:border-ink hover:bg-[#17121f]"
                  onClick={() => onPromptChange(suggestion)}
                >
                  {truncate(suggestion, 92)}
                </button>
              ))}
            </div>
          </div>

          {error ? (
            <div className="mt-5 rounded-none border-2 border-coral/45 bg-coral/10 px-4 py-3 text-sm text-coral">
              {error}
            </div>
          ) : null}
        </div>

        <div className="space-y-4">
          <div className="rounded-none border-2 border-ink/15 bg-[#130f1b] p-4 shadow-pixel">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="pixel-label">Active Mission</p>
                <h2 className="mt-2 text-2xl font-bold text-ink">Current request</h2>
              </div>
              <span className="rounded-none border-2 border-ink/20 bg-[#0f0c15] px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-ink/70">
                {selectedWorkflow?.status ?? "standby"}
              </span>
            </div>

            {selectedWorkflow && progress ? (
              <>
                <div className="mt-5 rounded-none border-2 border-ink/15 bg-[#0f0c15] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.24em] text-ink/50">
                        {selectedWorkflow.id}
                      </p>
                      <h3 className="mt-2 text-lg font-bold text-ink">
                        {selectedWorkflow.summary}
                      </h3>
                      <p className="mt-2 text-sm leading-relaxed text-ink/68">
                        {selectedWorkflow.prompt}
                      </p>
                    </div>
                    <div className="text-right text-xs uppercase tracking-[0.18em] text-ink/50">
                      <div>Updated {formatClock(selectedWorkflow.updatedAt)}</div>
                      <div className="mt-2">
                        {selectedWorkflow.usage
                          ? `${formatNumber(selectedWorkflow.usage.totalTokens)} tok`
                          : "--"}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4">
                    <div className="flex items-center justify-between gap-3 text-xs uppercase tracking-[0.18em] text-ink/52">
                      <span>{getWorkflowSignalLine(selectedWorkflow)}</span>
                      <span>{progress.percent}%</span>
                    </div>
                    <div className="mt-2 h-4 border-2 border-ink/20 bg-[#17121f]">
                      <div
                        className="h-full bg-teal transition-[width] duration-500"
                        style={{ width: `${progress.percent}%` }}
                      />
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 xl:grid-cols-3">
                    <MonitorCard
                      label="Now"
                      title={
                        progress.activeTask
                          ? progress.activeTask.title
                          : "No desk is actively working"
                      }
                      detail={
                        progress.activeTask
                          ? `${progress.activeTask.role} desk is handling the current step.`
                          : getWorkflowSignalLine(selectedWorkflow)
                      }
                      tone="teal"
                    />
                    <MonitorCard
                      label="Next"
                      title={
                        progress.nextTask
                          ? progress.nextTask.title
                          : selectedWorkflow.finalOutput
                            ? "Final package is ready"
                            : "Waiting for the next beat"
                      }
                      detail={
                        progress.nextTask
                          ? `${progress.completedTasks}/${progress.totalTasks} steps settled so far.`
                          : selectedWorkflow.finalOutput
                            ? "The validator has already delivered a final answer."
                            : "The packet is between steps or waiting on approval."
                      }
                      tone="brass"
                    />
                    <MonitorCard
                      label="Delivery"
                      title={
                        selectedWorkflow.finalOutput
                          ? "Final output available"
                          : "Streaming partial output"
                      }
                      detail={
                        selectedWorkflow.finalOutput
                          ? "The complete package is ready in the output screen below."
                          : "Finished task packets appear in the output screen as they land."
                      }
                      tone={selectedWorkflow.finalOutput ? "mint" : "neutral"}
                    />
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2 2xl:grid-cols-4">
                    {selectedWorkflow.tasks.map((task) => (
                      <div
                        key={task.id}
                        className="rounded-none border-2 border-ink/15 bg-[#15101d] px-3 py-3"
                      >
                        <p className="text-sm font-bold text-ink">{task.title}</p>
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <span className="text-[10px] uppercase tracking-[0.18em] text-ink/50">
                            {task.role}
                          </span>
                          <span
                            className={`rounded-none border-2 border-current px-2 py-1 text-[10px] uppercase tracking-[0.16em] ${taskStatusTone[task.status]}`}
                          >
                            {taskStatusLabel[task.status]}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-none border-2 border-ink bg-[#07050a] p-4 text-ink shadow-pixel">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="pixel-label text-ink/55">Output Screen</p>
                      <p className="mt-2 text-sm text-ink/72">
                        {selectedWorkflow.finalOutput
                          ? "Final delivery package"
                          : "Live assembly feed"}
                      </p>
                    </div>
                    <span className="rounded-none border-2 border-ink/20 bg-[#14101c] px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-ink/72">
                      {selectedWorkflow.finalOutput ? "complete" : "streaming"}
                    </span>
                  </div>
                  <pre className="mt-4 max-h-[320px] overflow-auto whitespace-pre-wrap border-2 border-ink/15 bg-black/20 p-4 text-sm leading-relaxed text-ink/88">
                    {buildWorkflowOutputPreview(selectedWorkflow)}
                  </pre>
                </div>
              </>
            ) : (
              <div className="mt-5 rounded-none border-2 border-dashed border-ink/15 bg-[#110d18] p-8 text-sm leading-relaxed text-ink/58">
                Nothing is selected yet. Start a mission on the left and this side
                will switch into progress, output, and mission history view.
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function ConsoleStep({
  index,
  title,
  detail
}: {
  index: string;
  title: string;
  detail: string;
}) {
  return (
    <div className="rounded-none border-2 border-ink/15 bg-[#0f0c15] px-4 py-3">
      <p className="text-[10px] uppercase tracking-[0.22em] text-ink/46">{index}</p>
      <p className="mt-2 text-sm font-bold text-ink">{title}</p>
      <p className="mt-2 text-sm leading-relaxed text-ink/62">{detail}</p>
    </div>
  );
}

function MonitorCard({
  label,
  title,
  detail,
  tone
}: {
  label: string;
  title: string;
  detail: string;
  tone: "teal" | "brass" | "mint" | "neutral";
}) {
  const toneClass =
    tone === "teal"
      ? "border-teal/35 bg-teal/10"
      : tone === "brass"
        ? "border-brass/35 bg-brass/10"
        : tone === "mint"
          ? "border-mint/35 bg-mint/10"
          : "border-ink/15 bg-[#15101d]";

  return (
    <div className={`rounded-none border-2 px-4 py-3 ${toneClass}`}>
      <p className="text-[10px] uppercase tracking-[0.22em] text-ink/46">{label}</p>
      <p className="mt-3 text-sm font-bold text-ink">{title}</p>
      <p className="mt-3 text-sm leading-relaxed text-ink/64">{detail}</p>
    </div>
  );
}
