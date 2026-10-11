
"use client";

import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  History,
  FileText,
  Eye,
  RefreshCw,
  LoaderCircle,
  AlertCircle,
  CheckCircle2,
  ShieldCheck,
  Download,
  GitCommit,
  GitCompareArrows,
} from "lucide-react";

type Patch = {
  hash: string;
  author: string;
  date: string;
  message: string;
};

type ResumeFile = {
  filename: string;
  content: string;
};

type HistoryResponse = {
  success: boolean;
  history?: string;
  resumes?: ResumeFile[];
  error?: string;
};

type SnapshotResponse = {
  success: boolean;
  filename?: string;
  hash?: string;
  content?: string;
  message?: string;
  error?: string;
  details?: string;
};

function parsePatches(history: string): Patch[] {
  if (!history.trim()) return [];

  return history
    .split(/\n(?=patch\s)/)
    .filter((block) => block.trim().startsWith("patch "))
    .map((block) => {
      const lines = block.split("\n");
      const hash = lines[0]?.replace(/^patch\s+/, "").trim() ?? "";
      const author =
        lines.find((line) => line.startsWith("Author:"))
          ?.replace(/^Author:\s*/, "").trim() || "Unknown author";
      const date =
        lines.find((line) => line.startsWith("Date:"))
          ?.replace(/^Date:\s*/, "").trim() || "Unknown date";
      const messages = lines
        .filter((line) => /^\s+\*\s/.test(line))
        .map((line) => line.replace(/^\s+\*\s/, "").trim());

      return {
        hash,
        author,
        date,
        message: messages.join(" ") || "Recorded patch",
      };
    })
    .filter((patch) => /^[a-f0-9]{8,64}$/i.test(patch.hash));
}

export default function SnapshotPage() {
  const [patches, setPatches] = useState<Patch[]>([]);
  const [resumes, setResumes] = useState<ResumeFile[]>([]);
  const [filename, setFilename] = useState("");
  const [hash, setHash] = useState("");
  const [snapshot, setSnapshot] = useState("");
  const [snapshotHash, setSnapshotHash] = useState("");
  const [snapshotFilename, setSnapshotFilename] = useState("");
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [loadingSnapshot, setLoadingSnapshot] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const selectedPatch = patches.find((patch) => patch.hash === hash);

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch("/api/darcs", { cache: "no-store" });
      const data: HistoryResponse = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Unable to load Darcs history.");
      }

      const nextPatches = parsePatches(data.history || "");
      const nextResumes = data.resumes || [];

      setPatches(nextPatches);
      setResumes(nextResumes);

      setFilename((current) =>
        nextResumes.some((resume) => resume.filename === current)
          ? current
          : nextResumes[0]?.filename || ""
      );

      setHash((current) =>
        nextPatches.some((patch) => patch.hash === current)
          ? current
          : nextPatches[0]?.hash || ""
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load history.");
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  async function loadSnapshot() {
    if (!filename || !hash) {
      setError("Select both a resume file and a recorded version.");
      return;
    }

    setLoadingSnapshot(true);
    setError("");
    setNotice("");
    setSnapshot("");

    try {
      const response = await fetch("/api/darcs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "snapshot",
          filename,
          hash,
        }),
      });

      const data: SnapshotResponse = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          [data.error, data.details].filter(Boolean).join(" ") ||
            "Could not load the historical snapshot."
        );
      }

      setSnapshot(data.content ?? "");
      setSnapshotHash(hash);
      setSnapshotFilename(filename);
      setNotice(
        data.message || "Historical snapshot loaded in read-only mode."
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not load the snapshot."
      );
    } finally {
      setLoadingSnapshot(false);
    }
  }

  function exportSnapshot() {
    const blob = new Blob([snapshot], {
      type: "text/markdown;charset=utf-8",
    });

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = url;
    anchor.download =
      snapshotFilename.replace(/\.md$/i, "") +
      `-${snapshotHash.slice(0, 10)}-snapshot.md`;

    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  const lineCount = snapshot === "" ? 0 : snapshot.split("\n").length;
  const wordCount = snapshot.trim()
    ? snapshot.trim().split(/\s+/).length
    : 0;

  return (
    <main className="min-h-screen bg-[#f7f8fc] px-5 py-8 text-gray-900 md:px-10">
      <div className="mx-auto max-w-6xl">
        <Link
          href="/"
          className="mb-8 inline-flex items-center gap-2 text-sm text-gray-500 transition hover:text-black"
        >
          <ArrowLeft size={16} />
          Back to Dashboard
        </Link>

        <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-3 flex items-center gap-2 text-sm font-medium text-gray-600">
              <History size={19} />
              RESUMEFLOW · DARCS SCM
            </div>
            <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
              Historical Snapshot Viewer
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-500">
              Inspect resume contents from a recorded Darcs version without
              restoring or editing the current resume.
            </p>
          </div>

          <button
            onClick={() => void loadHistory()}
            disabled={loadingHistory || loadingSnapshot}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw size={16} className={loadingHistory ? "animate-spin" : ""} />
            Refresh history
          </button>
        </header>

        {error && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            <AlertCircle size={18} className="mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold">Could not load snapshot</p>
              <p className="mt-1 break-words">{error}</p>
            </div>
          </div>
        )}

        {notice && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">
            <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
            <p>{notice}</p>
          </div>
        )}

        <section className="rounded-2xl border border-gray-300 bg-white p-5 md:p-7">
          <div className="mb-6 flex items-start gap-3">
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-gray-800">
              <GitCommit size={22} />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Select a historical version</h2>
              <p className="mt-1 text-sm text-gray-500">
                Choose the resume and the patch whose contents you want to inspect.
              </p>
            </div>
          </div>

          {loadingHistory ? (
            <div className="flex items-center gap-3 py-8 text-sm text-gray-500">
              <LoaderCircle size={18} className="animate-spin" />
              Loading recorded versions…
            </div>
          ) : patches.length === 0 || resumes.length === 0 ? (
            <p className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
              No recorded patches or resume files were found in the repository.
            </p>
          ) : (
            <>
              <div className="grid gap-5 md:grid-cols-2">
                <div>
                  <label
                    htmlFor="snapshot-resume"
                    className="mb-2 block text-sm font-medium text-gray-700"
                  >
                    Resume file
                  </label>
                  <select
                    id="snapshot-resume"
                    value={filename}
                    onChange={(event) => {
                      setFilename(event.target.value);
                      setSnapshot("");
                      setNotice("");
                    }}
                    disabled={loadingSnapshot}
                    className="w-full rounded-xl border border-gray-200 bg-white p-3 text-sm outline-none focus:border-gray-500 disabled:bg-gray-50"
                  >
                    {resumes.map((resume) => (
                      <option key={resume.filename} value={resume.filename}>
                        {resume.filename}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="snapshot-patch"
                    className="mb-2 block text-sm font-medium text-gray-700"
                  >
                    Recorded Darcs patch
                  </label>
                  <select
                    id="snapshot-patch"
                    value={hash}
                    onChange={(event) => {
                      setHash(event.target.value);
                      setSnapshot("");
                      setNotice("");
                    }}
                    disabled={loadingSnapshot}
                    className="w-full rounded-xl border border-gray-200 bg-white p-3 text-sm outline-none focus:border-gray-500 disabled:bg-gray-50"
                  >
                    {patches.map((patch) => (
                      <option key={patch.hash} value={patch.hash}>
                        {patch.message} — {patch.hash.slice(0, 10)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {selectedPatch && (
                <div className="mt-5 rounded-xl border border-gray-200 bg-gray-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Selected patch
                  </p>
                  <p className="mt-2 font-medium text-gray-800">
                    {selectedPatch.message}
                  </p>
                  <p className="mt-2 text-xs text-gray-500">
                    {selectedPatch.author} · {selectedPatch.date}
                  </p>
                  <p className="mt-2 break-all font-mono text-xs text-gray-500">
                    {selectedPatch.hash}
                  </p>
                </div>
              )}

              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  onClick={() => void loadSnapshot()}
                  disabled={loadingSnapshot || !filename || !hash}
                  className="inline-flex items-center gap-2 rounded-xl bg-black px-5 py-3 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:opacity-50"
                >
                  {loadingSnapshot ? (
                    <LoaderCircle size={17} className="animate-spin" />
                  ) : (
                    <Eye size={17} />
                  )}
                  {loadingSnapshot ? "Loading snapshot…" : "View Snapshot"}
                </button>

                {snapshot !== "" && (
                  <button
                    onClick={exportSnapshot}
                    className="inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    <Download size={16} />
                    Export snapshot
                  </button>
                )}
              </div>
            </>
          )}
        </section>

        {snapshot !== "" && (
          <section className="mt-7 overflow-hidden rounded-2xl border border-gray-300 bg-white">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-200 px-5 py-4">
              <div className="flex items-start gap-3">
                <FileText className="mt-1 text-gray-700" size={20} />
                <div>
                  <h2 className="font-semibold">Historical resume contents</h2>
                  <p className="mt-1 text-xs text-gray-500">
                    {snapshotFilename} · Patch {snapshotHash.slice(0, 10)}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-3 text-xs text-gray-500">
                <span>{lineCount} lines</span>
                <span>{wordCount} words</span>
              </div>
            </div>

            <div className="border-b border-green-200 bg-green-50 px-5 py-3">
              <p className="flex items-center gap-2 text-xs text-green-800">
                <ShieldCheck size={15} />
                Read-only snapshot — the working resume has not been changed.
              </p>
            </div>

            <pre className="max-h-[700px] overflow-auto whitespace-pre-wrap break-words p-5 font-mono text-xs leading-6 text-gray-800 md:text-sm">
              {snapshot}
            </pre>
          </section>
        )}

        <div className="mt-7 flex flex-wrap gap-3">
          <PageLink href="/history" icon={<History size={16} />}>Version History</PageLink>
          <PageLink href="/compare" icon={<GitCompareArrows size={16} />}>Compare Versions</PageLink>
          <PageLink href="/" icon={<FileText size={16} />}>Dashboard</PageLink>
        </div>
      </div>
    </main>
  );
}

function PageLink({
  href,
  icon,
  children,
}: {
  href: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
    >
      {icon}
      {children}
    </Link>
  );
}
