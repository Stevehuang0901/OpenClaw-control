import { formatClock, truncate } from "../lib/format";
import type { AgentRecord, GatewayEvent, MessageRecord } from "../types/contracts";

interface EventFeedProps {
  agents: AgentRecord[];
  events: GatewayEvent[];
  messages: MessageRecord[];
}

export function EventFeed({ agents, events, messages }: EventFeedProps) {
  const agentById = new Map(agents.map((agent) => [agent.id, agent.name]));

  return (
    <section className="panel p-5">
      <p className="pixel-label">Activity</p>
      <h2 className="mt-2 text-2xl font-bold text-ink">Realtime feed</h2>

      <div className="mt-5 grid gap-5 xl:grid-cols-1">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-ink/50">
            Agent messages
          </p>
          <div className="mt-3 space-y-3">
            {messages.slice(0, 8).map((message) => (
              <article
                key={message.id}
                className="rounded-none border-2 border-ink/15 bg-[#14101c] p-3 shadow-pixel"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-bold text-ink">
                    {agentById.get(message.fromAgentId) ?? "Gateway"} to{" "}
                    {agentById.get(message.toAgentId) ?? "Gateway"}
                  </p>
                  <span className="text-[10px] uppercase tracking-[0.2em] text-ink/50">
                    {message.kind}
                  </span>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-ink/74">
                  {truncate(message.payload, 160)}
                </p>
                {message.reasoning ? (
                  <p className="mt-2 text-xs italic text-ink/52">
                    {truncate(message.reasoning, 132)}
                  </p>
                ) : null}
                <p className="mt-3 text-[10px] uppercase tracking-[0.18em] text-ink/40">
                  {formatClock(message.timestamp)}
                </p>
              </article>
            ))}
          </div>
        </div>

        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-ink/50">
            System events
          </p>
          <div className="mt-3 space-y-2">
            {events.slice(0, 12).map((event, index) => (
              <div
                key={`${event.timestamp}-${index}`}
                className="flex items-center justify-between gap-3 rounded-none border-2 border-ink/12 bg-[#100d17] px-3 py-3 text-sm text-ink/72"
              >
                <span>{event.type.replaceAll("_", " ")}</span>
                <span className="text-[10px] uppercase tracking-[0.18em] text-ink/42">
                  {formatClock(event.timestamp)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
