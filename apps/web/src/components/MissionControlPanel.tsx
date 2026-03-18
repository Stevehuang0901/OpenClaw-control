import { formatClock, formatNumber, truncate } from "../lib/format";
import { taskStatusLabel, taskStatusTone } from "../lib/status";
import {
  buildWorkflowOutputPreview,
  getWorkflowMessages,
  getWorkflowProgress,
  getWorkflowSignalLine
} from "../lib/workflows";
import type { MessageRecord, WorkflowRecord } from "../types/contracts";

interface MissionControlPanelProps {
  connected: boolean;
  error: string | null;
  messages: MessageRecord[];
  prompt: string;
  selectedWorkflowId: string | null;
  submitting: boolean;
  workflows: WorkflowRecord[];
  onPromptChange: (value: string) => void;
  onRestoreStarter: () => void;
  onSelectWorkflow: (workflowId: string) => void;
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
  messages,
  prompt,
  selectedWorkflowId,
  submitting,
  workflows,
  onPromptChange,
  onRestoreStarter,
  onSelectWorkflow,
  onSubmit
}: MissionControlPanelProps) {
  const selectedWorkflow =
    workflows.find((workflow) => workflow.id === selectedWorkflowId) ??
    workflows[0] ??
    null;
  const progress = selectedWorkflow
    ? getWorkflowProgress(selectedWorkflow)
    : null;
  const workflowMessages = selectedWorkflow
    ? getWorkflowMessages(selectedWorkflow, messages)
    : [];

  return (
    <section className="panel p-5">
      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="rounded-none border-2 border-ink/15 bg-[#130f1b] p-5 shadow-pixel">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-xl">
              <p className="pixel-label">Operator Console</p>
              <h2 className="mt-3 text-3xl font-bold text-ink sm:text-4xl">
                Route a problem into the office
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-ink/70">
                Enter the brief here. The gateway will split it into collector,
                analyzer, writer, and validator work, then queue a final approval.
              </p>
            </div>

            <div className="min-w-[220px] rounded-none border-2 border-ink/15 bg-[#0f0c15] px-4 py-3 shadow-pixel">
              <p className="text-[10px] uppercase tracking-[0.24em] text-ink/48">
                Link state
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
                  {workflows.length} requests tracked
                </span>
              </div>
              <p className="mt-3 text-xs leading-relaxed text-ink/58">
                Prompt in, live output out. The office floor below mirrors what the
                desks are doing in real time.
              </p>
            </div>
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
              className="min-h-[190px] w-full rounded-none border-2 border-ink/20 bg-[#0d0a13] px-4 py-4 text-base leading-relaxed text-ink shadow-pixel outline-none transition focus:border-teal"
              placeholder="Describe the task you want the crew to execute..."
            />

            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                className="rounded-none border-2 border-ink bg-teal px-5 py-3 text-sm font-bold uppercase tracking-[0.2em] text-[#071111] shadow-pixel transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:bg-slate disabled:text-[#f0e5ca]/65"
                disabled={submitting || !prompt.trim()}
              >
                {submitting ? "Routing..." : "Send To Office"}
              </button>
              <button
                type="button"
                className="rounded-none border-2 border-ink bg-[#1b1526] px-5 py-3 text-sm font-bold uppercase tracking-[0.2em] text-ink shadow-pixel transition hover:-translate-y-0.5"
                onClick={onRestoreStarter}
              >
                Restore Starter Brief
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
                <p className="pixel-label">Delivery Monitor</p>
                <h2 className="mt-2 text-2xl font-bold text-ink">Live output feed</h2>
              </div>
              <span className="rounded-none border-2 border-ink/20 bg-[#0f0c15] px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-ink/70">
                {selectedWorkflow?.status ?? "standby"}
              </span>
            </div>

            {workflows.length > 0 ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {workflows.slice(0, 6).map((workflow) => (
                  <button
                    key={workflow.id}
                    type="button"
                    className={`rounded-none border-2 px-3 py-2 text-left text-xs shadow-pixel transition hover:-translate-y-0.5 ${
                      workflow.id === selectedWorkflow?.id
                        ? "border-ink bg-[#21192c] text-ink"
                        : "border-ink/15 bg-[#100d17] text-ink/72"
                    }`}
                    onClick={() => onSelectWorkflow(workflow.id)}
                  >
                    <div className="font-bold uppercase tracking-[0.18em]">
                      {workflow.status}
                    </div>
                    <div className="mt-1 max-w-[180px] text-[11px] leading-relaxed">
                      {truncate(workflow.summary, 46)}
                    </div>
                  </button>
                ))}
              </div>
            ) : null}

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
                  <pre className="mt-4 max-h-[360px] overflow-auto whitespace-pre-wrap border-2 border-ink/15 bg-black/20 p-4 text-sm leading-relaxed text-ink/88">
                    {buildWorkflowOutputPreview(selectedWorkflow)}
                  </pre>
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  {workflowMessages.length > 0 ? (
                    workflowMessages.map((message) => (
                      <article
                        key={message.id}
                        className="rounded-none border-2 border-ink/15 bg-[#14101c] p-3 shadow-pixel"
                      >
                        <p className="text-[10px] uppercase tracking-[0.22em] text-ink/50">
                          {message.kind}
                        </p>
                        <p className="mt-2 text-sm leading-relaxed text-ink/76">
                          {truncate(message.payload, 120)}
                        </p>
                      </article>
                    ))
                  ) : (
                    <div className="rounded-none border-2 border-dashed border-ink/15 bg-[#110d18] p-4 text-sm text-ink/58 md:col-span-3">
                      Recent handoff notes for this request will surface here as
                      soon as the desks begin collaborating.
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="mt-5 rounded-none border-2 border-dashed border-ink/15 bg-[#110d18] p-8 text-sm leading-relaxed text-ink/58">
                Nothing is selected yet. Submit a prompt on the left to start a new
                workflow and the delivery feed will begin streaming task output here.
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
