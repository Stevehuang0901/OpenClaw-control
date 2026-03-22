import type { ReactNode } from "react";

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
    <section className="space-y-4 xl:sticky xl:top-4">
      <div className="panel overflow-hidden p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="pixel-label">Dispatch</p>
            <h2 className="mt-3 text-xl font-semibold leading-tight text-ink">
              Route a brief or redirect the current run
            </h2>
            <p className="mt-2 max-w-[34ch] text-sm leading-relaxed text-ink/62">
              Describe the outcome, constraints, and release bar. This rail should
              stay operational even when the office scene gets busy.
            </p>
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
            className="min-h-[132px] w-full rounded-[22px] border border-white/10 bg-black/20 px-4 py-4 text-[15px] leading-relaxed text-ink outline-none transition placeholder:text-ink/34 focus:border-teal focus:bg-black/28"
            placeholder="Describe the outcome you want, what matters most, and any constraints or approvals the crew should respect..."
          />

          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="submit"
              className="rounded-[18px] border border-teal/60 bg-teal px-5 py-3 text-sm font-bold uppercase tracking-[0.2em] text-[#071111] transition hover:-translate-y-0.5 hover:shadow-[0_18px_30px_rgba(88,178,169,0.22)] disabled:cursor-not-allowed disabled:border-slate disabled:bg-slate disabled:text-[#f0e5ca]/65"
              disabled={submitting || !prompt.trim()}
            >
              {submitting ? "Routing..." : "Dispatch Workflow"}
            </button>
            <button
              type="button"
              className="rounded-[18px] border border-white/10 bg-white/5 px-5 py-3 text-sm font-bold uppercase tracking-[0.2em] text-ink transition hover:-translate-y-0.5 hover:bg-white/8"
              onClick={onRestoreStarter}
            >
              Load sample brief
            </button>
          </div>
        </form>

        <div className="mt-4 grid gap-2">
          {promptSuggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              className="rounded-[18px] border border-white/8 bg-white/5 px-3 py-3 text-left text-sm leading-relaxed text-ink/70 transition hover:-translate-y-0.5 hover:border-teal/30 hover:bg-white/8"
              onClick={() => onPromptChange(suggestion)}
            >
              {truncate(suggestion, 112)}
            </button>
          ))}
        </div>

        {error ? (
          <div className="mt-4 rounded-[18px] border border-coral/45 bg-coral/10 px-4 py-3 text-sm text-coral">
            {error}
          </div>
        ) : null}
      </div>

      <div className="panel overflow-hidden p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="pixel-label">Final Output</p>
            <p className="mt-2 text-sm text-ink/72">
              {selectedWorkflow?.finalOutput ? "Final package" : "Live draft output"}
            </p>
          </div>
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] uppercase tracking-[0.18em] text-ink/72">
            {selectedWorkflow?.finalOutput ? "complete" : "streaming"}
          </span>
        </div>

        <div className="mt-4 min-h-[220px] max-h-[360px] overflow-auto rounded-[20px] border border-white/8 bg-black/20 p-4">
          <OutputPreview
            content={
              selectedWorkflow
                ? buildWorkflowOutputPreview(selectedWorkflow)
                : "Submit a mission and the live package will appear here."
            }
          />
        </div>
      </div>

      <div className="panel overflow-hidden p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="pixel-label">Current Run</p>
            <h2 className="mt-3 max-w-[26ch] text-xl font-semibold leading-tight text-ink [text-wrap:balance]">
              {selectedWorkflow ? truncate(selectedWorkflow.summary, 72) : "Waiting for a brief"}
            </h2>
          </div>
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] uppercase tracking-[0.18em] text-ink/72">
            {selectedWorkflow?.status ?? "standby"}
          </span>
        </div>

        {selectedWorkflow && progress ? (
          <div className="mt-4 space-y-4">
            <p className="text-sm leading-relaxed text-ink/62">
              {getWorkflowSignalLine(selectedWorkflow)}
            </p>

            <div className="flex items-center justify-between gap-3 text-[10px] uppercase tracking-[0.18em] text-ink/52">
              <span>Mission progress</span>
              <span>{progress.percent}%</span>
            </div>
            <div className="h-2.5 rounded-full bg-white/8">
              <div
                className="h-full rounded-full bg-teal transition-[width] duration-500"
                style={{ width: `${progress.percent}%` }}
              />
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <MiniReadout
                label="Now"
                value={
                  progress.activeTask
                    ? truncate(progress.activeTask.title, 48)
                    : "No active desk"
                }
              />
              <MiniReadout
                label="Next"
                value={
                  progress.nextTask
                    ? truncate(progress.nextTask.title, 48)
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
                  className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-3 rounded-[18px] border border-white/8 bg-black/15 px-3 py-3"
                >
                  <span className="inline-flex h-8 min-w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 px-2 text-[10px] uppercase tracking-[0.16em] text-ink/62">
                    {task.order}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink">
                      {task.title}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <p
                        className={`inline-flex rounded-full border px-2 py-1 text-[9px] uppercase tracking-[0.16em] ${taskStatusTone[task.status]}`}
                      >
                        {task.status.replace("_", " ")}
                      </p>
                      <span className="text-[10px] uppercase tracking-[0.18em] text-ink/42">
                        step {task.order}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <p className="text-[10px] uppercase tracking-[0.18em] text-ink/46">
              Updated {formatClock(selectedWorkflow.updatedAt)}
            </p>
          </div>
        ) : (
          <div className="mt-4 rounded-[18px] border border-dashed border-white/12 bg-black/10 p-4 text-sm leading-relaxed text-ink/58">
            Start a mission to see the active step, next handoff, and token load here.
          </div>
        )}
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
        : "border-white/10 bg-white/5 text-ink/70";

  return (
    <span
      className={`rounded-full border px-3 py-2 text-[10px] uppercase tracking-[0.2em] ${toneClass}`}
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
    <div
      className={`min-w-0 rounded-[18px] border border-white/8 bg-black/15 px-3 py-3 ${className}`}
    >
      <p className="text-[10px] uppercase tracking-[0.22em] text-ink/46">{label}</p>
      <p className="mt-2 break-words text-sm font-bold leading-snug text-ink">{value}</p>
    </div>
  );
}

function OutputPreview({ content }: { content: string }) {
  const blocks: ReactNode[] = [];
  const lines = content.split(/\r?\n/);
  const listItems: string[] = [];
  const codeLines: string[] = [];
  let inCodeBlock = false;
  let key = 0;

  const flushList = () => {
    if (listItems.length === 0) {
      return;
    }

    blocks.push(
      <ul key={`list-${key++}`} className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-ink/80 marker:text-ink/42">
        {listItems.map((item, index) => (
          <li key={`item-${key}-${index}`}>{renderInlineMarkup(item)}</li>
        ))}
      </ul>
    );
    listItems.length = 0;
  };

  const flushCode = () => {
    if (codeLines.length === 0) {
      return;
    }

    blocks.push(
      <pre
        key={`code-${key++}`}
        className="overflow-auto rounded-[16px] border border-white/8 bg-black/30 p-3 text-[13px] leading-relaxed text-ink/88"
      >
        {codeLines.join("\n")}
      </pre>
    );
    codeLines.length = 0;
  };

  lines.forEach((line) => {
    const trimmed = line.trim();

    if (trimmed.startsWith("```")) {
      flushList();
      if (inCodeBlock) {
        flushCode();
      }
      inCodeBlock = !inCodeBlock;
      return;
    }

    if (inCodeBlock) {
      codeLines.push(line);
      return;
    }

    if (!trimmed) {
      flushList();
      return;
    }

    const listMatch =
      trimmed.match(/^[-*+]\s+(.*)$/) ?? trimmed.match(/^\d+\.\s+(.*)$/);
    if (listMatch) {
      listItems.push(listMatch[1]);
      return;
    }

    flushList();

    const headingMatch = trimmed.match(/^(#{1,3})\s+(.*)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const headingClass =
        level === 1
          ? "text-xl font-semibold leading-tight text-ink"
          : level === 2
            ? "text-base font-semibold leading-snug text-ink"
            : "text-sm font-semibold uppercase tracking-[0.14em] text-ink/74";

      blocks.push(
        <p key={`heading-${key++}`} className={headingClass}>
          {renderInlineMarkup(headingMatch[2])}
        </p>
      );
      return;
    }

    blocks.push(
      <p key={`paragraph-${key++}`} className="text-sm leading-relaxed text-ink/84">
        {renderInlineMarkup(trimmed)}
      </p>
    );
  });

  flushList();
  flushCode();

  return <div className="space-y-3">{blocks}</div>;
}

function renderInlineMarkup(text: string) {
  return text
    .split(/(\*\*[^*]+\*\*|`[^`]+`)/g)
    .filter(Boolean)
    .map((part, index) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return (
          <strong key={`${part}-${index}`} className="font-semibold text-ink">
            {part.slice(2, -2)}
          </strong>
        );
      }

      if (part.startsWith("`") && part.endsWith("`")) {
        return (
          <code
            key={`${part}-${index}`}
            className="rounded-[8px] border border-white/8 bg-white/6 px-1.5 py-0.5 text-[0.92em] text-ink"
          >
            {part.slice(1, -1)}
          </code>
        );
      }

      return <span key={`${part}-${index}`}>{part}</span>;
    });
}
