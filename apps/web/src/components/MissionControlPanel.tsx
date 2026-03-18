import { formatClock, formatNumber, truncate } from "../lib/format";
import { taskStatusTone } from "../lib/status";
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
  "Take this customer request, split it into research, planning, writing, validation, and approval, then show the final output."
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
    <section className="grid gap-4 xl:grid-cols-[1.08fr_0.92fr] xl:items-start">
      <div className="panel p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="pixel-label">Input</p>
            <h2 className="mt-2 text-lg font-bold text-ink">Send a mission</h2>
          </div>

          <div className="flex flex-wrap gap-2">
            <ConsoleChip
              label={connected ? "live" : "offline"}
              tone={connected ? "mint" : "coral"}
            />
            <ConsoleChip label={`${workflows.length} queued`} tone="neutral" />
          </div>
        </div>

        <form
          className="mt-4 space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!prompt.trim() || submitting) {
              return;
            }

            onSubmit();
          }}
        >
          <textarea
            id="workflow-prompt"
            value={prompt}
            onChange={(event) => onPromptChange(event.target.value)}
            className="min-h-[160px] w-full rounded-none border-2 border-ink/16 bg-[#0d0a13] px-4 py-4 text-base leading-relaxed text-ink shadow-pixel outline-none transition focus:border-teal"
            placeholder="Describe the task you want the crew to execute..."
          />

          <div className="flex flex-wrap items-center gap-3">
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
              Use sample brief
            </button>
          </div>
        </form>

        <div className="mt-4 flex flex-wrap gap-2">
          {promptSuggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              className="rounded-none border-2 border-ink/14 bg-[#0f0c15] px-3 py-2 text-left text-[10px] leading-relaxed text-ink/66 transition hover:-translate-y-0.5 hover:border-ink/40 hover:bg-[#17121f]"
              onClick={() => onPromptChange(suggestion)}
            >
              {truncate(suggestion, 44)}
            </button>
          ))}
        </div>

        {error ? (
          <div className="mt-4 rounded-none border-2 border-coral/45 bg-coral/10 px-4 py-3 text-sm text-coral">
            {error}
          </div>
        ) : null}
      </div>

      <div className="space-y-4 xl:sticky xl:top-4">
        <div className="panel p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="pixel-label">Output</p>
              <p className="mt-2 text-sm text-ink/72">
                {selectedWorkflow?.finalOutput ? "Final package" : "Live output"}
              </p>
            </div>
            <span className="rounded-none border-2 border-ink/20 bg-[#14101c] px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-ink/72">
              {selectedWorkflow?.finalOutput ? "complete" : "streaming"}
            </span>
          </div>

          <pre className="mt-4 max-h-[320px] overflow-auto whitespace-pre-wrap border-2 border-ink/15 bg-black/20 p-4 text-sm leading-relaxed text-ink/88">
            {selectedWorkflow
              ? buildWorkflowOutputPreview(selectedWorkflow)
              : "Submit a mission and the live package will appear here."}
          </pre>
        </div>

        <div className="panel p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="pixel-label">Current</p>
              <h2 className="mt-2 max-w-[28ch] text-[15px] font-bold leading-tight text-ink [text-wrap:balance]">
                {selectedWorkflow ? truncate(selectedWorkflow.summary, 52) : "Waiting"}
              </h2>
            </div>
            <span className="rounded-none border-2 border-ink/20 bg-[#0f0c15] px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-ink/70">
              {selectedWorkflow?.status ?? "standby"}
            </span>
          </div>

          {selectedWorkflow && progress ? (
            <div className="mt-4 space-y-4">
              <p className="text-[11px] leading-relaxed text-ink/62">
                {getWorkflowSignalLine(selectedWorkflow)}
              </p>

              <div className="flex items-center justify-between gap-3 text-[10px] uppercase tracking-[0.18em] text-ink/52">
                <span>Mission progress</span>
                <span>{progress.percent}%</span>
              </div>
              <div className="h-3 border-2 border-ink/18 bg-[#17121f]">
                <div
                  className="h-full bg-teal transition-[width] duration-500"
                  style={{ width: `${progress.percent}%` }}
                />
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <MiniReadout
                  label="Now"
                  value={
                    progress.activeTask
                      ? truncate(progress.activeTask.title, 40)
                      : "No active desk"
                  }
                />
                <MiniReadout
                  label="Next"
                  value={
                    progress.nextTask
                      ? truncate(progress.nextTask.title, 40)
                      : selectedWorkflow.finalOutput
                        ? "Package ready"
                        : "Waiting"
                  }
                />
                <MiniReadout
                  label="Tokens"
                  value={
                    selectedWorkflow.usage
                      ? `${formatNumber(selectedWorkflow.usage.totalTokens)} total`
                      : "--"
                  }
                  className="sm:col-span-2"
                />
              </div>

              <div className="space-y-2">
                {selectedWorkflow.tasks.slice(0, 4).map((task) => (
                  <div
                    key={task.id}
                    className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2 rounded-none border-2 border-ink/14 bg-[#130f1b] px-2 py-2"
                  >
                    <span className="inline-flex h-6 min-w-6 items-center justify-center border border-ink/16 bg-[#0d0a13] px-1.5 text-[10px] uppercase tracking-[0.16em] text-ink/58">
                      {task.order}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-[11px] font-bold text-ink">
                        {task.title}
                      </p>
                      <p
                        className={`mt-1 inline-flex rounded-none border px-1.5 py-0.5 text-[9px] uppercase tracking-[0.16em] ${taskStatusTone[task.status]}`}
                      >
                        {task.status.replace("_", " ")}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <p className="text-[10px] uppercase tracking-[0.18em] text-ink/46">
                Updated {formatClock(selectedWorkflow.updatedAt)}
              </p>
            </div>
          ) : (
            <div className="mt-4 rounded-none border-2 border-dashed border-ink/15 bg-[#110d18] p-4 text-sm leading-relaxed text-ink/58">
              Start a mission to see status here.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function ConsoleChip({
  label,
  tone
}: {
  label: string;
  tone: "mint" | "coral" | "neutral";
}) {
  const toneClass =
    tone === "mint"
      ? "border-mint/35 bg-mint/10 text-mint"
      : tone === "coral"
        ? "border-coral/35 bg-coral/10 text-coral"
        : "border-ink/15 bg-[#0f0c15] text-ink/70";

  return (
    <span
      className={`rounded-none border-2 px-3 py-2 text-[10px] uppercase tracking-[0.2em] ${toneClass}`}
    >
      {label}
    </span>
  );
}

function MiniReadout({
  label,
  value,
  className = ""
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={`min-w-0 rounded-none border-2 border-ink/15 bg-[#15101d] px-3 py-3 ${className}`}>
      <p className="text-[10px] uppercase tracking-[0.22em] text-ink/46">{label}</p>
      <p className="mt-2 break-words text-sm font-bold leading-snug text-ink">{value}</p>
    </div>
  );
}
