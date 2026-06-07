export function Background() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 bg-[#030712]" />
      <div className="absolute -left-1/4 top-0 h-[600px] w-[600px] animate-pulse-slow rounded-full bg-violet-600/20 blur-[120px]" />
      <div className="absolute -right-1/4 top-1/3 h-[500px] w-[500px] animate-pulse-slow rounded-full bg-sky-600/15 blur-[100px] [animation-delay:2s]" />
      <div className="absolute bottom-0 left-1/3 h-[400px] w-[400px] animate-pulse-slow rounded-full bg-emerald-600/10 blur-[100px] [animation-delay:4s]" />
      <div
        className="absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(148, 163, 184, 0.05) 1px, transparent 1px),
            linear-gradient(90deg, rgba(148, 163, 184, 0.05) 1px, transparent 1px)
          `,
          backgroundSize: "64px 64px",
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#030712]" />
    </div>
  );
}
