import { Terminal } from "lucide-react";
import { RefObject } from "react";

type BuildTerminalProps = {
  logs: string[];
  logContainerRef: RefObject<HTMLElement>;
  fontClassName: string;
};

export function BuildTerminal({
  logs,
  logContainerRef,
  fontClassName,
}: BuildTerminalProps) {
  if (logs.length === 0) return null;

  return (
    <section className="animate-fade-in overflow-hidden rounded-2xl border border-emerald-500/20 bg-black/60 shadow-2xl shadow-emerald-500/5 backdrop-blur-sm">
      <div className="flex items-center gap-3 border-b border-white/10 bg-white/[0.03] px-4 py-3">
        <div className="flex gap-1.5">
          <span className="h-3 w-3 rounded-full bg-red-500/80" />
          <span className="h-3 w-3 rounded-full bg-yellow-500/80" />
          <span className="h-3 w-3 rounded-full bg-emerald-500/80" />
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Terminal className="h-3.5 w-3.5 text-emerald-400" />
          <span>build-output.log</span>
        </div>
        <span className="ml-auto flex items-center gap-1.5 text-xs text-emerald-400">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
          Live
        </span>
      </div>
      <div
        className={`${fontClassName} terminal-scroll h-[300px] overflow-y-auto p-4 text-sm leading-relaxed text-emerald-400/90`}
      >
        <pre className="flex flex-col gap-0.5">
          {logs.map((log, i) => (
            <code
              ref={logs.length - 1 === i ? logContainerRef : undefined}
              key={i}
              className="block"
            >
              <span className="select-none text-slate-600">$ </span>
              {log}
            </code>
          ))}
        </pre>
      </div>
    </section>
  );
}
