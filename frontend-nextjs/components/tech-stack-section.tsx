import {
  TECH_CATEGORY_COLORS,
  TECH_CATEGORY_LABELS,
  TECH_STACK,
  type TechItem,
} from "@/lib/constants";

function groupByCategory(items: TechItem[]) {
  return items.reduce(
    (acc, item) => {
      if (!acc[item.category]) acc[item.category] = [];
      acc[item.category].push(item);
      return acc;
    },
    {} as Record<TechItem["category"], TechItem[]>
  );
}

export function TechStackSection() {
  const grouped = groupByCategory(TECH_STACK);
  const categories = Object.keys(grouped) as TechItem["category"][];

  return (
    <footer className="mt-16 animate-fade-in border-t border-white/10 pt-10 [animation-delay:400ms]">
      <p className="mb-2 text-center text-sm font-medium text-slate-300">
        Tech Stack
      </p>
      <p className="mb-8 text-center text-xs text-slate-500">
        Built with modern tools across the full deployment pipeline
      </p>

      <div className="grid gap-6 sm:grid-cols-3">
        {categories.map((category) => (
          <div key={category}>
            <p className="mb-3 text-center text-xs font-medium uppercase tracking-wider text-slate-500">
              {TECH_CATEGORY_LABELS[category]}
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {grouped[category].map((tech) => (
                <span
                  key={tech.name}
                  className={`rounded-lg border bg-gradient-to-br px-3 py-1.5 text-xs font-medium backdrop-blur-sm transition-transform hover:scale-105 ${TECH_CATEGORY_COLORS[category]}`}
                >
                  {tech.name}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </footer>
  );
}
