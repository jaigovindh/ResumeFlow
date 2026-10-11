
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  FileText,
  GitBranch,
  History,
  LayoutDashboard,
  Settings,
  Sparkles,
  RefreshCw,
  Plus,
  X,
  LoaderCircle,
  CheckCircle2,
  AlertCircle,
  GitCommit,
  GitCompareArrows,
  Eye,
  RotateCcw,
  Clock3,
  ArrowUpRight,
  Activity,
  FolderGit2,
  ShieldCheck,
} from "lucide-react";

type Resume = {
  filename: string;
  content: string;
};

type Patch = {
  hash: string;
  author: string;
  date: string;
  message: string;
};

type DarcsData = {
  success: boolean;
  repository?: string;
  resumes?: Resume[];
  history?: string;
  workingChanges?: string;
  error?: string;
};

function parsePatches(history: string): Patch[] {
  return history
    .split(/\n(?=patch\s)/)
    .filter((block) => block.trim().startsWith("patch "))
    .map((block) => {
      const lines = block.split("\n");

      return {
        hash: lines[0]?.replace(/^patch\s+/, "").trim() ?? "",
        author:
          lines
            .find((line) => line.startsWith("Author:"))
            ?.replace(/^Author:\s*/, "")
            .trim() || "Unknown author",
        date:
          lines
            .find((line) => line.startsWith("Date:"))
            ?.replace(/^Date:\s*/, "")
            .trim() || "Unknown date",
        message:
          lines
            .filter((line) => /^\s+\*\s/.test(line))
            .map((line) => line.replace(/^\s+\*\s/, "").trim())
            .join(" ") || "Recorded patch",
      };
    })
    .filter((patch) => /^[a-f0-9]{8,64}$/i.test(patch.hash));
}

function isClean(workingChanges?: string) {
  return (
    !workingChanges?.trim() ||
    workingChanges.trim() === "No changes!"
  );
}

export default function Home() {
  const [data, setData] = useState<DarcsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [showHistory, setShowHistory] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/darcs", {
        cache: "no-store",
      });

      const result: DarcsData = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Could not load Darcs data.");
      }

      setData(result);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not connect to Darcs."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  async function createResume(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!title.trim()) return;

    setBusy(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch("/api/darcs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          title: title.trim(),
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Could not create resume.");
      }

      setNotice(`Created ${result.filename} and added it to Darcs tracking.`);
      setTitle("");
      setModalOpen(false);
      await loadData();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not create resume."
      );
    } finally {
      setBusy(false);
    }
  }

  const resumes = data?.resumes ?? [];
  const history = data?.history ?? "";
  const patches = useMemo(() => parsePatches(history), [history]);
  const clean = isClean(data?.workingChanges);

  const quickActions = [
    {
      title: "Version History",
      description: "Review recorded patches and restore versions.",
      href: "/history",
      icon: History,
      color: "bg-blue-50 text-blue-700",
    },
    {
      title: "Compare Versions",
      description: "See changes between two recorded versions.",
      href: "/compare",
      icon: GitCompareArrows,
      color: "bg-violet-50 text-violet-700",
    },
    {
      title: "Historical Snapshots",
      description: "Read an older resume without restoring it.",
      href: "/snapshot",
      icon: Eye,
      color: "bg-emerald-50 text-emerald-700",
    },
    {
      title: "Restore Previous Version",
      description: "Recover a resume from recorded history.",
      href: "/history",
      icon: RotateCcw,
      color: "bg-amber-50 text-amber-700",
    },
  ];

  return (
    <main className="min-h-screen bg-[#f7f8fc] text-gray-900">
      <div className="flex min-h-screen">
        <aside className="hidden w-64 shrink-0 border-r bg-white px-5 py-6 md:flex md:flex-col">
          <div className="mb-10 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-black text-white">
              <Sparkles size={20} />
            </div>
            <div>
              <h1 className="text-lg font-bold">ResumeFlow</h1>
              <p className="text-xs text-gray-500">Resume Version Manager</p>
            </div>
          </div>

          <nav className="space-y-2">
            <NavItem icon={<LayoutDashboard size={18} />} label="Dashboard" active />
            <Link href="/resumes" className="block">
              <NavItem icon={<FileText size={18} />} label="My Resumes" />
            </Link>
            <Link href="/history" className="block">
              <NavItem icon={<History size={18} />} label="Version History" />
            </Link>
            <Link href="/compare" className="block">
              <NavItem icon={<GitCompareArrows size={18} />} label="Compare Versions" />
            </Link>
            <Link href="/snapshot" className="block">
              <NavItem icon={<Eye size={18} />} label="Snapshots" />
            </Link>
          </nav>

          <div className="mt-auto rounded-2xl bg-gray-50 p-4">
            <p className="text-sm font-semibold">Darcs SCM</p>
            <p className="mt-1 text-xs text-gray-500">
              Real patch-based version control
            </p>
            <div className="mt-3 flex items-center gap-2 text-xs">
              <span
                className={`h-2 w-2 rounded-full ${
                  data?.success ? "bg-green-500" : "bg-red-500"
                }`}
              />
              <span className={data?.success ? "text-green-700" : "text-red-600"}>
                {loading ? "Connecting…" : data?.success ? "Connected" : "Error"}
              </span>
            </div>
            {data?.repository && (
              <p className="mt-2 break-all text-[10px] leading-4 text-gray-400">
                {data.repository}
              </p>
            )}
          </div>
        </aside>

        <section className="min-w-0 flex-1 px-5 py-7 md:px-10 md:py-8">
          <header className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm text-gray-500">Welcome back 👋</p>
              <h2 className="mt-1 text-3xl font-bold tracking-tight">
                Resume Dashboard
              </h2>
              <p className="mt-2 text-sm text-gray-500 md:text-base">
                Manage your resumes, versions, and changes in one place.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => void loadData()}
                disabled={loading}
                title="Refresh Darcs data"
                className="flex items-center gap-2 rounded-xl border bg-white px-4 py-3 text-sm hover:bg-gray-50 disabled:opacity-50"
              >
                <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
                Refresh
              </button>

              <button
                onClick={() => {
                  setError("");
                  setNotice("");
                  setModalOpen(true);
                }}
                className="flex items-center gap-2 rounded-xl bg-black px-5 py-3 text-sm font-medium text-white transition hover:bg-gray-800"
              >
                <Plus size={17} />
                Create Resume
              </button>
            </div>
          </header>

          {notice && (
            <div className="mt-6 flex items-start gap-2 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">
              <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
              <p>{notice}</p>
              <button className="ml-auto" onClick={() => setNotice("")} aria-label="Dismiss success message">
                <X size={16} />
              </button>
            </div>
          )}

          {error && (
            <div className="mt-6 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              <AlertCircle size={18} className="mt-0.5 shrink-0" />
              <p className="break-words">{error}</p>
              <button className="ml-auto" onClick={() => setError("")} aria-label="Dismiss error message">
                <X size={16} />
              </button>
            </div>
          )}

          {/* Overview metrics */}
          <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              title="Total Resumes"
              value={loading ? "…" : String(resumes.length)}
              description="Resume files in the repository"
              icon={<FileText size={19} />}
            />
            <StatCard
              title="Recorded Patches"
              value={loading ? "…" : String(patches.length)}
              description="Versions recorded by Darcs"
              icon={<GitCommit size={19} />}
            />
            <StatCard
              title="Working Tree"
              value={loading ? "…" : clean ? "Clean" : "Changes"}
              description={clean ? "No unrecorded changes" : "Review pending changes"}
              icon={clean ? <ShieldCheck size={19} /> : <Activity size={19} />}
              accent={clean ? "green" : "amber"}
            />
            <StatCard
              title="Version Control"
              value={data?.success ? "Connected" : loading ? "…" : "Offline"}
              description="Live Darcs repository status"
              icon={<FolderGit2 size={19} />}
              accent={data?.success ? "green" : "default"}
            />
          </div>

          {/* Quick actions */}
          <section className="mt-10">
            <div className="mb-4">
              <h3 className="text-xl font-semibold">Quick actions</h3>
              <p className="mt-1 text-sm text-gray-500">
                Access your resume version-control tools.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {quickActions.map((action) => {
                const Icon = action.icon;

                return (
                  <Link
                    key={action.title}
                    href={action.href}
                    className="group rounded-2xl border bg-white p-5 transition hover:-translate-y-1 hover:shadow-lg"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${action.color}`}>
                        <Icon size={21} />
                      </span>
                      <ArrowUpRight size={17} className="text-gray-400 transition group-hover:text-gray-900" />
                    </div>
                    <h4 className="mt-4 font-semibold">{action.title}</h4>
                    <p className="mt-2 text-sm leading-5 text-gray-500">
                      {action.description}
                    </p>
                  </Link>
                );
              })}
            </div>
          </section>

          {/* Resume collection */}
          <section className="mt-10">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-xl font-semibold">My Resumes</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Files read directly from the Darcs repository.
                </p>
              </div>
              <Link
                href="/resumes"
                className="text-sm font-medium text-gray-600 hover:text-black"
              >
                View all <span aria-hidden="true">→</span>
              </Link>
            </div>

            {loading ? (
              <div className="flex items-center gap-2 rounded-2xl border bg-white p-8 text-sm text-gray-500">
                <LoaderCircle size={18} className="animate-spin" />
                Loading repository data…
              </div>
            ) : resumes.length === 0 ? (
              <div className="rounded-2xl border bg-white px-6 py-12 text-center">
                <FileText size={34} className="mx-auto text-gray-400" />
                <h4 className="mt-4 font-semibold">No resumes yet</h4>
                <p className="mt-2 text-sm text-gray-500">
                  Create your first resume to add a real file to Darcs.
                </p>
                <button
                  onClick={() => setModalOpen(true)}
                  className="mt-5 rounded-xl bg-black px-5 py-3 text-sm text-white hover:bg-gray-800"
                >
                  <Plus size={16} className="mr-2 inline" />
                  Create your first resume
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
                {resumes.map((resume) => (
                  <ResumeCard
                    key={resume.filename}
                    filename={resume.filename}
                    content={resume.content}
                  />
                ))}
              </div>
            )}
          </section>

          {/* Recent activity */}
          <section className="mt-10 overflow-hidden rounded-2xl border bg-white">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b p-5 md:p-6">
              <div>
                <div className="flex items-center gap-2">
                  <Activity size={19} className="text-gray-500" />
                  <h3 className="font-semibold">Recent Darcs activity</h3>
                </div>
                <p className="mt-1 text-sm text-gray-500">
                  Latest recorded patches from the actual repository.
                </p>
              </div>
              <Link
                href="/history"
                className="text-sm font-medium text-gray-600 hover:text-black"
              >
                Full history →
              </Link>
            </div>

            {loading ? (
              <div className="p-6 text-sm text-gray-500">Loading activity…</div>
            ) : patches.length === 0 ? (
              <div className="p-8 text-center text-sm text-gray-500">
                No recorded patches yet.
              </div>
            ) : (
              <div className="divide-y">
                {patches.slice(0, 5).map((patch, index) => (
                  <div key={patch.hash} className="flex gap-4 p-5">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-gray-600">
                      <GitCommit size={19} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="break-words text-sm font-semibold">
                          {patch.message}
                        </p>
                        {index === 0 && (
                          <span className="rounded-full bg-green-50 px-2 py-1 text-[10px] font-semibold text-green-700">
                            LATEST
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-gray-500">
                        {patch.author}
                      </p>
                      <p className="mt-1 text-xs text-gray-400">
                        <Clock3 size={12} className="mr-1 inline" />
                        {patch.date}
                      </p>
                      <p className="mt-2 break-all font-mono text-[10px] text-gray-400">
                        {patch.hash}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Raw history and working-tree output */}
          <section className="mt-8 rounded-2xl border bg-white p-5 md:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold">Repository diagnostics</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Raw output from Darcs commands.
                </p>
              </div>
              <button
                onClick={() => setShowHistory((value) => !value)}
                className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50"
              >
                {showHistory ? "Hide raw history" : "Show raw history"}
              </button>
            </div>

            {showHistory && (
              <pre className="mt-5 max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-gray-950 p-4 text-xs leading-6 text-green-300">
                {history || "No recorded patches yet."}
              </pre>
            )}

            <div className="mt-5 border-t pt-4">
              <div className="flex items-center gap-2">
                {clean ? (
                  <CheckCircle2 size={16} className="text-green-600" />
                ) : (
                  <AlertCircle size={16} className="text-amber-600" />
                )}
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Working tree status
                </p>
              </div>
              <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-gray-50 p-4 text-sm text-gray-600">
                {loading ? "Checking…" : data?.workingChanges || "No changes!"}
              </pre>
            </div>

            {data?.repository && (
              <div className="mt-4 border-t pt-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Repository location
                </p>
                <p className="mt-2 break-all font-mono text-xs text-gray-500">
                  {data.repository}
                </p>
              </div>
            )}
          </section>

          <footer className="mt-8 flex flex-wrap items-center justify-between gap-3 pb-4 text-xs text-gray-400">
            <span>ResumeFlow · Powered by Darcs SCM</span>
            <span>Local repository · Real patch history</span>
          </footer>
        </section>
      </div>

      {/* Create resume modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setModalOpen(false);
          }}
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-xl font-bold">Create a resume</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Creates a Markdown file and adds it to Darcs tracking.
                </p>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="rounded-lg p-2 hover:bg-gray-100"
                aria-label="Close dialog"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={createResume} className="mt-6">
              <label htmlFor="resume-title" className="text-sm font-medium">
                Resume title
              </label>
              <input
                id="resume-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="e.g. Backend Developer"
                maxLength={100}
                autoFocus
                required
                className="mt-2 w-full rounded-xl border px-4 py-3 text-sm outline-none focus:border-black"
              />

              <p className="mt-2 text-xs text-gray-500">
                The title becomes the filename. You can edit the resume after creating it.
              </p>

              {error && (
                <p className="mt-3 break-words text-sm text-red-600">{error}</p>
              )}

              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-xl border px-4 py-2.5 text-sm hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy || !title.trim()}
                  className="flex items-center gap-2 rounded-xl bg-black px-5 py-2.5 text-sm text-white hover:bg-gray-800 disabled:opacity-50"
                >
                  {busy && <LoaderCircle size={16} className="animate-spin" />}
                  {busy ? "Creating…" : "Create Resume"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}

function NavItem({
  icon,
  label,
  active = false,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition ${
        active
          ? "bg-black text-white"
          : "text-gray-600 hover:bg-gray-100 hover:text-black"
      }`}
    >
      {icon}
      {label}
    </div>
  );
}

function StatCard({
  title,
  value,
  description,
  icon,
  accent = "default",
}: {
  title: string;
  value: string;
  description: string;
  icon: React.ReactNode;
  accent?: "default" | "green" | "amber";
}) {
  const iconStyle =
    accent === "green"
      ? "bg-green-50 text-green-700"
      : accent === "amber"
        ? "bg-amber-50 text-amber-700"
        : "bg-gray-100 text-gray-700";

  return (
    <div className="rounded-2xl border bg-white p-5 transition hover:-translate-y-1 hover:shadow-lg">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-gray-500">{title}</p>
        <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${iconStyle}`}>
          {icon}
        </span>
      </div>
      <p className="mt-4 text-2xl font-bold">{value}</p>
      <p className="mt-1 text-xs text-gray-400">{description}</p>
    </div>
  );
}

function ResumeCard({
  filename,
  content,
}: {
  filename: string;
  content: string;
}) {
  const title = content.match(/^#\s+(.+)$/m)?.[1] || filename;

  const preview = content
    .split("\n")
    .filter((line) => line.trim() && !line.trim().startsWith("#"))
    .slice(0, 5);

  return (
    <Link
      href={`/resumes/editor?file=${encodeURIComponent(filename)}`}
      className="group block rounded-2xl border bg-white p-5 transition duration-300 hover:-translate-y-1 hover:shadow-xl"
    >
      <div className="mb-5 min-h-44 rounded-xl bg-gray-50 p-5">
        <div className="mb-4 flex items-center gap-2">
          <FileText size={18} className="shrink-0 text-gray-500" />
          <span className="break-all text-xs text-gray-500">{filename}</span>
        </div>
        <h4 className="mb-3 line-clamp-2 text-sm font-bold">{title}</h4>
        <div className="space-y-2">
          {preview.length ? (
            preview.map((line, index) => (
              <p
                key={`${index}-${line}`}
                className="truncate text-xs text-gray-500"
              >
                {line.replace(/^[-*]\s*/, "")}
              </p>
            ))
          ) : (
            <p className="text-xs text-gray-400">No content yet</p>
          )}
        </div>
      </div>

      <h4 className="break-words font-semibold">{title}</h4>
      <p className="mt-1 break-all text-sm text-gray-500">{filename}</p>
      <div className="mt-4 flex items-center justify-between gap-2">
        <span className="text-xs text-gray-400">Tracked by Darcs</span>
        <span className="text-sm font-medium text-gray-700 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100">
          Open →
        </span>
      </div>
    </Link>
  );
}
