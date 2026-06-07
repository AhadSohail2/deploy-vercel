"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import axios from "axios";
import type { Socket } from "socket.io-client";
import { Fira_Code } from "next/font/google";
import {
  CheckCircle2,
  ExternalLink,
  Github,
  Loader2,
  Rocket,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Background } from "@/components/background";
import { HeroSection } from "@/components/hero-section";
import { FeatureCards } from "@/components/feature-cards";
import { PipelineFlow } from "@/components/pipeline-flow";
import { BuildTerminal } from "@/components/build-terminal";
import { TechStackSection } from "@/components/tech-stack-section";

function resolveApiUrl(): string {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, "");
  }
  if (typeof window !== "undefined") {
    const { protocol, hostname, port } = window.location;
    if (port === "3000") {
      return `${protocol}//${hostname}:9000`;
    }
    return `${window.location.origin}/api`;
  }
  return "http://localhost:9000";
}

function resolveSocketConfig(): { url: string; path?: string } {
  if (process.env.NEXT_PUBLIC_SOCKET_URL) {
    const url = process.env.NEXT_PUBLIC_SOCKET_URL.replace(/\/$/, "");
    const viaNginx = !/:9002$/.test(url);
    return viaNginx ? { url, path: "/socket.io/" } : { url };
  }
  if (typeof window !== "undefined") {
    const { protocol, hostname, port } = window.location;
    if (port === "3000") {
      return { url: `${protocol}//${hostname}:9002` };
    }
    return { url: window.location.origin, path: "/socket.io/" };
  }
  return { url: "http://localhost:9002" };
}

function createSocket(): Socket {
  const { url, path } = resolveSocketConfig();
  return path ? io(url, { path }) : io(url);
}

const firaCode = Fira_Code({ subsets: ["latin"] });

export default function Home() {
  const [repoURL, setURL] = useState<string>("");
  const [logs, setLogs] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [projectId, setProjectId] = useState<string | undefined>();
  const [deployPreviewURL, setDeployPreviewURL] = useState<
    string | undefined
  >();
  const [deployError, setDeployError] = useState<string | null>(null);

  const logContainerRef = useRef<HTMLElement>(null);
  const socketRef = useRef<Socket | null>(null);

  const isValidURL: [boolean, string | null] = useMemo(() => {
    if (!repoURL || repoURL.trim() === "") return [false, null];
    const regex = new RegExp(
      /^(?:https?:\/\/)?(?:www\.)?github\.com\/([^\/]+)\/([^\/]+)(?:\/)?$/
    );
    return [regex.test(repoURL), "Enter a valid GitHub repository URL"];
  }, [repoURL]);

  const handleClickDeploy = useCallback(async () => {
    setLoading(true);
    setDeployError(null);
    setLogs([]);

    try {
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
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.data?.message) {
        setDeployError(err.response.data.message);
      } else {
        setDeployError("Deploy failed. Check pm2 logs api-server.");
      }
    } finally {
      setLoading(false);
    }
  }, [projectId, repoURL]);

  const handleSocketIncommingMessage = useCallback((message: string) => {
    try {
      const parsed = JSON.parse(message);
      if (parsed?.log) {
        setLogs((prev) => [...prev, parsed.log]);
        logContainerRef.current?.scrollIntoView({ behavior: "smooth" });
      }
    } catch {
      // ignore non-JSON socket messages
    }
  }, []);

  useEffect(() => {
    const socket = createSocket();
    socketRef.current = socket;
    socket.on("message", handleSocketIncommingMessage);

    return () => {
      socket.off("message", handleSocketIncommingMessage);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [handleSocketIncommingMessage]);

  return (
    <>
      <Background />
      <main className="relative min-h-screen">
        <div className="mx-auto max-w-5xl px-6 py-12 lg:py-16">
          <HeroSection />
          <FeatureCards />
          <PipelineFlow />

          <section className="mb-8 animate-fade-in overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-6 shadow-2xl shadow-black/20 backdrop-blur-md [animation-delay:300ms] sm:p-8">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/30 to-sky-500/30">
                <Rocket className="h-5 w-5 text-sky-300" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-white">
                  Deploy a Repository
                </h2>
                <p className="text-sm text-slate-500">
                  Enter a public GitHub URL to start building
                </p>
              </div>
            </div>

            <div className="relative">
              <Github className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
              <Input
                disabled={loading}
                value={repoURL}
                onChange={(e) => setURL(e.target.value)}
                type="url"
                placeholder="https://github.com/username/repository"
                className="h-12 border-white/10 bg-black/40 pl-11 text-white placeholder:text-slate-600 focus-visible:ring-violet-500/50"
              />
            </div>

            {!isValidURL[0] && repoURL.trim() !== "" && (
              <p className="mt-2 text-sm text-red-400">{isValidURL[1]}</p>
            )}

            <Button
              onClick={handleClickDeploy}
              disabled={!isValidURL[0] || loading}
              className="mt-5 h-12 w-full bg-gradient-to-r from-violet-600 to-sky-600 text-base font-medium text-white shadow-lg shadow-violet-500/20 transition-all hover:from-violet-500 hover:to-sky-500 hover:shadow-violet-500/30 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Building & Deploying...
                </>
              ) : (
                <>
                  <Rocket className="mr-2 h-5 w-5" />
                  Deploy Project
                </>
              )}
            </Button>

            {deployError && (
              <p className="mt-3 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-sm text-red-400">
                {deployError}
              </p>
            )}

            {deployPreviewURL && (
              <div className="mt-4 flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3.5">
                <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />
                <p className="min-w-0 text-sm text-slate-300">
                  Live at{" "}
                  <a
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-medium text-emerald-400 underline-offset-4 hover:underline"
                    href={deployPreviewURL}
                  >
                    {deployPreviewURL}
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </p>
              </div>
            )}
          </section>

          <BuildTerminal
            logs={logs}
            logContainerRef={logContainerRef}
            fontClassName={firaCode.className}
          />

          <TechStackSection />
        </div>
      </main>
    </>
  );
}
