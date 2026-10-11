
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowDownUp,
  ArrowLeft,
  CheckCircle2,
  FileText,
  Filter,
  LoaderCircle,
  Plus,
  Search,
  Sparkles,
  X,
} from "lucide-react";

type Resume = {
  filename: string;
  content: string;
};

type ApiResponse = {
  success: boolean;
  resumes?: Resume[];
  repository?: string;
  history?: string;
  workingChanges?: string;
  error?: string;
  details?: string;
  filename?: string;
};

type ContentFilter = "all" | "complete" | "empty";
type SortMode = "title" | "filename";

function getTitle(resume: Resume) {
  return resume.content.match(/^#\s+(.+)$/m)?.[1]?.trim()
    || resume.filename.replace(/\.md$/i, "").replace(/[-_]/g, " ");
}

function getPreview(content: string) {
  return content
    .split("\n")
    .map((line) => line.replace(/^\s*[-*+]\s+/, "").trim())
    .filter((line) => line && !line.startsWith("#"))
    .slice(0, 3);
}

function hasResumeContent(content: string) {
  const meaningfulLines = content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));

  return meaningfulLines.length > 0;
}

export default function ResumesPage() {
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [repository, setRepository] = useState("");
  const [workingChanges, setWorkingChanges] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [contentFilter, setContentFilter] = useState<ContentFilter>("all");
  const [sortMode, setSortMode] = useState<SortMode>("title");
  const [createOpen, setCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [creating, setCreating] = useState(false);

  const loadResumes = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/darcs", { cache: "no-store" });
      const result: ApiResponse = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Could not load resumes.");
      }

      setResumes(result.resumes ?? []);
      setRepository(result.repository ?? "");
      setWorkingChanges(result.workingChanges ?? "");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not connect to Darcs."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadResumes();
  }, [loadResumes]);

  const filteredResumes = useMemo(() => {
    const query = search.trim().toLowerCase();

    return resumes
      .filter((resume) => {
        const title = getTitle(resume);
        const matchesSearch =
          !query ||
          title.toLowerCase().includes(query) ||
          resume.filename.toLowerCase().includes(query) ||
          resume.content.toLowerCase().includes(query);

        const hasContent = hasResumeContent(resume.content);
        const matchesFilter =
          contentFilter === "all" ||
          (contentFilter === "complete" && hasContent) ||
          (contentFilter === "empty" && !hasContent);

        return matchesSearch && matchesFilter;
      })
      .sort((a, b) => {
        const first = sortMode === "title" ? getTitle(a) : a.filename;
        const second = sortMode === "title" ? getTitle(b) : b.filename;
        return first.localeCompare(second);
      });
  }, [resumes, search, contentFilter, sortMode]);

  async function createResume(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const title = newTitle.trim();
    if (!title) return;

    setCreating(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch("/api/darcs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", title }),
      });

      const result: ApiResponse = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Could not create the resume.");
      }

      setCreateOpen(false);
      setNewTitle("");
      setNotice(`Created ${result.filename}. It is now tracked by Darcs.`);
      await loadResumes();

      if (result.filename) {
        window.location.href =
          `/resumes/editor?file=${encodeURIComponent(result.filename)}`;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create resume.");
    } finally {
      setCreating(false);
    }
  }

  const workingTreeClean =
    !workingChanges.trim() || workingChanges.trim() === "No changes!";

  return (
    <main className="min-h-screen bg-[#f7f8fc] text-gray-900">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-5 md:px-8">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              aria-label="Back to dashboard"
              className="rounded-xl border p-2.5 transition hover:bg-gray-50"
            >
              <ArrowLeft size={18} />
            </Link>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-black text-white">
              <Sparkles size={20} />
            </div>
            <div>
              <h1 className="text-lg font-bold">My Resumes</h1>
              <p className="text-xs text-gray-500">ResumeFlow · Darcs SCM</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => void loadResumes()}
              disabled={loading}
              className="flex items-center gap-2 rounded-xl border bg-white px-4 py-2.5 text-sm hover:bg-gray-50 disabled:opacity-50"
            >
              {loading && <LoaderCircle size={15} className="animate-spin" />}
              Refresh
            </button>
            <button
              onClick={() => {
                setError("");
                setNotice("");
                setCreateOpen(true);
              }}
              className="flex items-center gap-2 rounded-xl bg-black px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-800"
            >
              <Plus size={16} />
              Create Resume
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-5 py-8 md:px-8">
        <div className="mb-7">
          <p className="text-sm text-gray-500">Your resume workspace</p>
          <h2 className="mt-1 text-3xl font-bold tracking-tight">
            All resumes
          </h2>
          <p className="mt-2 text-sm text-gray-500">
            Search, filter, and open resumes stored in your local Darcs repository.
          </p>
        </div>

        {notice && (
          <div className="mb-5 flex items-start gap-2 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">
            <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
            <p>{notice}</p>
            <button
              onClick={() => setNotice("")}
              className="ml-auto"
              aria-label="Dismiss message"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {error && (
          <div role="alert" className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        <section className="mb-6 grid gap-4 sm:grid-cols-3">
          <Metric label="Total resumes" value={loading ? "…" : String(resumes.length)} />
          <Metric label="Search results" value={loading ? "…" : String(filteredResumes.length)} />
          <div className="rounded-2xl border bg-white p-4">
            <p className="text-xs text-gray-500">Darcs working tree</p>
            <p className={`mt-2 text-lg font-semibold ${workingTreeClean ? "text-green-700" : "text-amber-700"}`}>
              {loading ? "Checking…" : workingTreeClean ? "Clean" : "Changes pending"}
            </p>
            <p className="mt-1 text-xs text-gray-400">
              {workingTreeClean ? "No unrecorded changes detected" : "Review before recording a version"}
            </p>
          </div>
        </section>

        <section className="mb-6 rounded-2xl border bg-white p-4 md:p-5">
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px_190px]">
            <label className="relative block">
              <span className="sr-only">Search resumes</span>
              <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search title, filename, or content…"
                className="w-full rounded-xl border bg-white py-3 pl-10 pr-4 text-sm outline-none focus:border-gray-500"
              />
            </label>

            <label className="relative">
              <span className="sr-only">Filter by content</span>
              <Filter size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <select
                value={contentFilter}
                onChange={(event) => setContentFilter(event.target.value as ContentFilter)}
                className="w-full appearance-none rounded-xl border bg-white py-3 pl-10 pr-3 text-sm outline-none focus:border-gray-500"
              >
                <option value="all">All resumes</option>
                <option value="complete">Has content</option>
                <option value="empty">Needs content</option>
              </select>
            </label>

            <label className="relative">
              <span className="sr-only">Sort resumes</span>
              <ArrowDownUp size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <select
                value={sortMode}
                onChange={(event) => setSortMode(event.target.value as SortMode)}
                className="w-full appearance-none rounded-xl border bg-white py-3 pl-10 pr-3 text-sm outline-none focus:border-gray-500"
              >
                <option value="title">Sort by title</option>
                <option value="filename">Sort by filename</option>
              </select>
            </label>
          </div>
          {(search || contentFilter !== "all") && (
            <button
              onClick={() => {
                setSearch("");
                setContentFilter("all");
              }}
              className="mt-3 text-xs font-medium text-gray-500 hover:text-black"
            >
              Clear search and filters
            </button>
          )}
        </section>

        {loading ? (
          <div className="flex items-center justify-center gap-3 rounded-2xl border bg-white p-12 text-sm text-gray-500">
            <LoaderCircle size={20} className="animate-spin" />
            Loading resumes from Darcs…
          </div>
        ) : filteredResumes.length === 0 ? (
          <div className="rounded-2xl border bg-white px-6 py-14 text-center">
            <FileText size={34} className="mx-auto text-gray-300" />
            <h3 className="mt-4 font-semibold">
              {resumes.length === 0 ? "No resumes yet" : "No matching resumes"}
            </h3>
            <p className="mx-auto mt-2 max-w-md text-sm text-gray-500">
              {resumes.length === 0
                ? "Create a resume to start managing its contents and versions."
                : "Try another search term or clear your filters."}
            </p>
            {resumes.length === 0 ? (
              <button
                onClick={() => setCreateOpen(true)}
                className="mt-5 rounded-xl bg-black px-4 py-2.5 text-sm text-white hover:bg-gray-800"
              >
                <Plus size={15} className="mr-2 inline" />
                Create your first resume
              </button>
            ) : (
              <button
                onClick={() => {
                  setSearch("");
                  setContentFilter("all");
                }}
                className="mt-5 rounded-xl border px-4 py-2.5 text-sm hover:bg-gray-50"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {filteredResumes.map((resume) => {
              const title = getTitle(resume);
              const preview = getPreview(resume.content);
              const populated = hasResumeContent(resume.content);

              return (
                <article
                  key={resume.filename}
                  className="flex min-w-0 flex-col rounded-2xl border bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-gray-700">
                      <FileText size={21} />
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${populated ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"}`}>
                      {populated ? "Has content" : "Needs content"}
                    </span>
                  </div>

                  <h3 className="break-words text-lg font-semibold">{title}</h3>
                  <p className="mt-1 break-all font-mono text-xs text-gray-400">{resume.filename}</p>

                  <div className="mt-4 min-h-24 flex-1 rounded-xl bg-gray-50 p-3">
                    {preview.length ? (
                      <ul className="space-y-2">
                        {preview.map((line, index) => (
                          <li key={`${index}-${line}`} className="truncate text-xs leading-5 text-gray-600">
                            {line}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-gray-400">No preview available yet.</p>
                    )}
                  </div>

                  <Link
                    href={`/resumes/editor?file=${encodeURIComponent(resume.filename)}`}
                    className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-black px-4 py-3 text-sm font-medium text-white hover:bg-gray-800"
                  >
                    Open editor
                  </Link>
                </article>
              );
            })}
          </div>
        )}

        {repository && (
          <p className="mt-8 break-all text-xs text-gray-400">
            Repository: {repository}
          </p>
        )}
      </div>

      {createOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !creating) setCreateOpen(false);
          }}
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-bold">Create a resume</h3>
                <p className="mt-1 text-sm text-gray-500">
                  A Markdown file will be created and added to Darcs tracking.
                </p>
              </div>
              <button
                onClick={() => setCreateOpen(false)}
                disabled={creating}
                aria-label="Close dialog"
                className="rounded-lg p-2 hover:bg-gray-100 disabled:opacity-50"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={createResume} className="mt-6">
              <label htmlFor="new-resume-title" className="text-sm font-medium">
                Resume title
              </label>
              <input
                id="new-resume-title"
                value={newTitle}
                onChange={(event) => setNewTitle(event.target.value)}
                placeholder="e.g. Frontend Developer"
                maxLength={100}
                required
                autoFocus
                className="mt-2 w-full rounded-xl border px-4 py-3 text-sm outline-none focus:border-gray-500"
              />
              <p className="mt-2 text-xs text-gray-400">
                Use a title that describes the role or purpose of this resume.
              </p>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setCreateOpen(false)}
                  disabled={creating}
                  className="rounded-xl border px-4 py-2.5 text-sm hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating || !newTitle.trim()}
                  className="flex items-center gap-2 rounded-xl bg-black px-4 py-2.5 text-sm text-white hover:bg-gray-800 disabled:opacity-50"
                >
                  {creating && <LoaderCircle size={15} className="animate-spin" />}
                  {creating ? "Creating…" : "Create resume"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border bg-white p-4">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="mt-2 text-2xl font-bold">{value}</p>
    </div>
  );
}
