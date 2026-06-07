import { PROJECT_FEATURES } from "@/lib/constants";

export function FeatureCards() {
  return (
    <section className="mb-10 grid gap-4 sm:grid-cols-3">
      {PROJECT_FEATURES.map(({ icon: Icon, title, description, accent, glow }, i) => (
        <div
          key={title}
          className={`group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:border-white/20 hover:bg-white/[0.06] hover:shadow-xl ${glow} animate-fade-in`}
          style={{ animationDelay: `${i * 100}ms` }}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-white/[0.04] to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
          <div className="relative">
            <div
              className={`mb-4 inline-flex rounded-xl border border-white/10 bg-white/5 p-2.5 ${accent}`}
            >
              <Icon className="h-5 w-5" />
            </div>
            <h2 className="mb-2 font-semibold text-white">{title}</h2>
            <p className="text-sm leading-relaxed text-slate-400">{description}</p>
          </div>
        </div>
      ))}
    </section>
  );
}
