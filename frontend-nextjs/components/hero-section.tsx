import { GraduationCap } from "lucide-react";
import { HEADER_STATS } from "@/lib/constants";

export function HeroSection() {
  return (
    <header className="mb-14 animate-fade-in text-center">
      <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-sm text-slate-300 backdrop-blur-sm">
        <GraduationCap className="h-4 w-4 text-violet-400" />
        <span>Semester Project · Spring 2026</span>
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
      </div>

      <h1 className="font-display mb-4 text-5xl font-bold tracking-tight sm:text-6xl lg:text-7xl">
        <span className="bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
          Deploy
        </span>
        <span className="bg-gradient-to-r from-violet-400 via-sky-400 to-emerald-400 bg-clip-text text-transparent">
          Hub
        </span>
      </h1>

      <p className="mx-auto mb-8 max-w-2xl text-lg leading-relaxed text-slate-400">
        A Vercel-inspired cloud deployment platform. Clone on EC2, build with
        npm, upload to S3 — with live deployment logs and instant preview
        URLs.
      </p>

      <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-slate-400">
        {HEADER_STATS.map(({ icon: Icon, label }) => (
          <span
            key={label}
            className="inline-flex items-center gap-2 rounded-lg border border-white/5 bg-white/[0.03] px-3 py-1.5 backdrop-blur-sm"
          >
            <Icon className="h-4 w-4 text-sky-400" />
            {label}
          </span>
        ))}
      </div>
    </header>
  );
}
