import { ArrowRight } from "lucide-react";
import { PIPELINE_STEPS } from "@/lib/constants";

export function PipelineFlow() {
  return (
    <section className="mb-10 animate-fade-in [animation-delay:200ms]">
      <p className="mb-4 text-center text-xs font-medium uppercase tracking-widest text-slate-500">
        Deployment Pipeline
      </p>
      <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-center">
        {PIPELINE_STEPS.map((step, i) => (
          <div key={step.label} className="flex items-center gap-3">
            <div className="flex flex-1 items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 backdrop-blur-sm sm:flex-initial">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500/20 to-sky-500/20">
                <step.icon className="h-4 w-4 text-sky-300" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-white">{step.label}</p>
                <p className="truncate text-xs text-slate-500">
                  {step.description}
                </p>
              </div>
            </div>
            {i < PIPELINE_STEPS.length - 1 && (
              <ArrowRight className="hidden h-4 w-4 shrink-0 text-slate-600 sm:block" />
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
