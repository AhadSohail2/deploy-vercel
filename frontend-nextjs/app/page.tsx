"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  BookOpen,
  Cloud,
  Github,
  GraduationCap,
  Rocket,
  Server,
  Terminal,
} from "lucide-react";
import { Fira_Code } from "next/font/google";
import axios from "axios";
import type { Socket } from "socket.io-client";

function resolveApiUrl(): string {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, "");
  }
  if (typeof window !== "undefined") {
    return `${window.location.origin}/api`;
  }
  return "http://localhost:9000";
}

function resolveSocketUrl(): string {
  if (process.env.NEXT_PUBLIC_SOCKET_URL) {
    return process.env.NEXT_PUBLIC_SOCKET_URL.replace(/\/$/, "");
  }
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  return "http://localhost:9002";
}

function createSocket(url: string): Socket {
  const isDirectSocketPort = /:9002$/.test(url);
  return io(url, isDirectSocketPort ? {} : { path: "/socket.io/" });
}

const firaCode = Fira_Code({ subsets: ["latin"] });

const TECH_STACK = [
  "Next.js",
  "Node.js",
  "Docker",
  "AWS S3",
  "Redis",
  "Nginx",
  "Socket.IO",
];

const PROJECT_FEATURES = [
  {
    icon: Github,
    title: "GitHub Integration",
    description: "Deploy any public repository by pasting its URL.",
  },
  {
    icon: Terminal,
    title: "Live Build Logs",
    description: "Stream build output in real time via WebSockets.",
  },
  {
    icon: Cloud,
    title: "Static Hosting",
    description: "Built assets are uploaded to S3 and served through a reverse proxy.",
  },
];

export default function Home() {
  const [repoURL, setURL] = useState<string>("");
  const [logs, setLogs] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [projectId, setProjectId] = useState<string | undefined>();
  const [deployPreviewURL, setDeployPreviewURL] = useState<
    string | undefined
  >();

  const logContainerRef = useRef<HTMLElement>(null);
  const socketRef = useRef<Socket | null>(null);

  const isValidURL: [boolean, string | null] = useMemo(() => {
    if (!repoURL || repoURL.trim() === "") return [false, null];
    const regex = new RegExp(
      /^(?:https?:\/\/)?(?:www\.)?github\.com\/([^\/]+)\/([^\/]+)(?:\/)?$/
    );
    return [regex.test(repoURL), "Enter valid Github Repository URL"];
  }, [repoURL]);

  const handleClickDeploy = useCallback(async () => {
    setLoading(true);

    const { data } = await axios.post(`${resolveApiUrl()}/project`, {
      gitURL: repoURL,
      slug: projectId,
    });

    if (data && data.data) {
      const { projectSlug, url } = data.data;
      setProjectId(projectSlug);
      setDeployPreviewURL(url);

      socketRef.current?.emit("subscribe", `logs:${projectSlug}`);
    }
  }, [projectId, repoURL]);

  const handleSocketIncommingMessage = useCallback((message: string) => {
    const { log } = JSON.parse(message);
    setLogs((prev) => [...prev, log]);
    logContainerRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    const socket = createSocket(resolveSocketUrl());
    socketRef.current = socket;
    socket.on("message", handleSocketIncommingMessage);

    return () => {
      socket.off("message", handleSocketIncommingMessage);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [handleSocketIncommingMessage]);

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      <div className="mx-auto max-w-5xl px-6 py-12">
        <header className="mb-12 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900/80 px-4 py-1.5 text-sm text-slate-300">
            <GraduationCap className="h-4 w-4 text-sky-400" />
            Semester Project · Spring 2026
          </div>

          <h1 className="mb-3 text-4xl font-bold tracking-tight text-white sm:text-5xl">
            DeployHub
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-slate-400">
            A Vercel-inspired cloud deployment platform built as a semester
            project. Clone, build, and host static sites from GitHub with live
            deployment logs.
          </p>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-3 text-sm text-slate-400">
            <span className="inline-flex items-center gap-1.5">
              <BookOpen className="h-4 w-4 text-sky-400" />
              Cloud Computing & DevOps
            </span>
            <span className="hidden text-slate-600 sm:inline">·</span>
            <span className="inline-flex items-center gap-1.5">
              <Server className="h-4 w-4 text-sky-400" />
              Full-stack deployment pipeline
            </span>
          </div>
        </header>

        <section className="mb-10 grid gap-4 sm:grid-cols-3">
          {PROJECT_FEATURES.map(({ icon: Icon, title, description }) => (
            <div
              key={title}
              className="rounded-xl border border-slate-800 bg-slate-900/50 p-5"
            >
              <Icon className="mb-3 h-5 w-5 text-sky-400" />
              <h2 className="mb-1 font-semibold text-white">{title}</h2>
              <p className="text-sm text-slate-400">{description}</p>
            </div>
          ))}
        </section>

        <section className="mb-8 rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-xl shadow-black/20">
          <div className="mb-5 flex items-center gap-2">
            <Rocket className="h-5 w-5 text-sky-400" />
            <h2 className="text-xl font-semibold text-white">
              Deploy a Repository
            </h2>
          </div>

          <span className="flex items-center gap-2">
            <Github className="h-10 w-10 shrink-0 text-slate-300" />
            <Input
              disabled={loading}
              value={repoURL}
              onChange={(e) => setURL(e.target.value)}
              type="url"
              placeholder="https://github.com/username/repository"
              className="border-slate-700 bg-slate-950"
            />
          </span>

          {!isValidURL[0] && repoURL.trim() !== "" && (
            <p className="mt-2 text-sm text-red-400">{isValidURL[1]}</p>
          )}

          <Button
            onClick={handleClickDeploy}
            disabled={!isValidURL[0] || loading}
            className="mt-4 w-full bg-sky-600 text-white hover:bg-sky-500"
          >
            {loading ? "Building & Deploying..." : "Deploy Project"}
          </Button>

          {deployPreviewURL && (
            <div className="mt-4 rounded-lg border border-slate-700 bg-slate-950 px-4 py-3">
              <p className="text-sm text-slate-300">
                Live preview{" "}
                <a
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-sky-400 underline-offset-4 hover:underline"
                  href={deployPreviewURL}
                >
                  {deployPreviewURL}
                </a>
              </p>
            </div>
          )}
        </section>

        {logs.length > 0 && (
          <section className="rounded-2xl border border-emerald-900/50 bg-slate-950 p-1">
            <div className="flex items-center gap-2 border-b border-slate-800 px-4 py-3">
              <Terminal className="h-4 w-4 text-emerald-400" />
              <span className="text-sm font-medium text-slate-300">
                Build Logs
              </span>
            </div>
            <div
              className={`${firaCode.className} h-[280px] overflow-y-auto p-4 text-sm text-emerald-400`}
            >
              <pre className="flex flex-col gap-1">
                {logs.map((log, i) => (
                  <code
                    ref={logs.length - 1 === i ? logContainerRef : undefined}
                    key={i}
                  >{`> ${log}`}</code>
                ))}
              </pre>
            </div>
          </section>
        )}

        <footer className="mt-12 border-t border-slate-800 pt-8 text-center">
          <p className="mb-4 text-sm text-slate-500">Technologies used</p>
          <div className="flex flex-wrap justify-center gap-2">
            {TECH_STACK.map((tech) => (
              <span
                key={tech}
                className="rounded-md border border-slate-800 bg-slate-900 px-3 py-1 text-xs text-slate-400"
              >
                {tech}
              </span>
            ))}
          </div>
        </footer>
      </div>
    </main>
  );
}
