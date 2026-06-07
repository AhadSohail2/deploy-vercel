import {
  Cloud,
  Cog,
  Database,
  Github,
  Globe,
  Layers,
  Server,
  Terminal,
  Zap,
  type LucideIcon,
} from "lucide-react";

export type TechItem = {
  name: string;
  category: "frontend" | "backend" | "infrastructure";
};

export const TECH_STACK: TechItem[] = [
  { name: "Next.js 14", category: "frontend" },
  { name: "React 18", category: "frontend" },
  { name: "TypeScript", category: "frontend" },
  { name: "Tailwind CSS", category: "frontend" },
  { name: "shadcn/ui", category: "frontend" },
  { name: "Node.js 22", category: "backend" },
  { name: "Express", category: "backend" },
  { name: "Socket.IO", category: "backend" },
  { name: "AWS EC2", category: "infrastructure" },
  { name: "AWS S3", category: "infrastructure" },
  { name: "Redis", category: "infrastructure" },
  { name: "Nginx", category: "infrastructure" },
  { name: "PM2", category: "infrastructure" },
];

export const TECH_CATEGORY_LABELS: Record<TechItem["category"], string> = {
  frontend: "Frontend",
  backend: "Backend",
  infrastructure: "Infrastructure",
};

export const TECH_CATEGORY_COLORS: Record<TechItem["category"], string> = {
  frontend: "from-violet-500/20 to-violet-500/5 border-violet-500/30 text-violet-300",
  backend: "from-sky-500/20 to-sky-500/5 border-sky-500/30 text-sky-300",
  infrastructure:
    "from-emerald-500/20 to-emerald-500/5 border-emerald-500/30 text-emerald-300",
};

export const PROJECT_FEATURES = [
  {
    icon: Github,
    title: "GitHub Integration",
    description:
      "Paste any public repository URL and deploy in one click — no CLI required.",
    accent: "text-violet-400",
    glow: "group-hover:shadow-violet-500/10",
  },
  {
    icon: Terminal,
    title: "Live Build Logs",
    description:
      "Watch npm install and build output stream in real time over WebSockets.",
    accent: "text-sky-400",
    glow: "group-hover:shadow-sky-500/10",
  },
  {
    icon: Cloud,
    title: "Static Hosting",
    description:
      "Built assets land in S3 and go live instantly through a reverse proxy.",
    accent: "text-emerald-400",
    glow: "group-hover:shadow-emerald-500/10",
  },
] as const;

export type PipelineStep = {
  icon: LucideIcon;
  label: string;
  description: string;
};

export const PIPELINE_STEPS: PipelineStep[] = [
  {
    icon: Github,
    label: "Clone",
    description: "Pull repo from GitHub",
  },
  {
    icon: Cog,
    label: "Build",
    description: "npm install & build on EC2",
  },
  {
    icon: Database,
    label: "Upload",
    description: "Assets pushed to S3",
  },
  {
    icon: Globe,
    label: "Live",
    description: "Served via subdomain",
  },
];

export const HEADER_STATS = [
  { icon: Layers, label: "Full-stack pipeline" },
  { icon: Zap, label: "Real-time logs" },
  { icon: Server, label: "Cloud & DevOps" },
] as const;
