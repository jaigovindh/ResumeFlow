
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  RefreshCw,
  History,
  GitCommit,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  LoaderCircle,
  RotateCcw,
  ShieldAlert,
  GitCompareArrows,
  Eye,
  FileText,
} from "lucide-react";

type Patch = {
  hash: string;
  author: string;
  date: string;
  message: string;
  details: string;
};

type ResumeFile = {
  filename: string;
  content: string;
};

type ApiResponse = {
  success: boolean;
  history?: string;
  workingChanges?: string;
  repository?: string;
  resumes?: ResumeFile[];
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
        details: block.trim(),
      };
    })
    .filter((patch) => /^[a-f0-9]{8,64}$/i.test(patch.hash));
}

export default function VersionHistoryPage() {
  const [patches, setPatches] = useState<Patch[]>([]);
  const [resumes, setResumes] = useState<ResumeFile[]>([]);
  const [repository, setRepository] = useState("");
  const [workingChanges, setWorkingChanges] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [expandedHash, setExpandedHash] = useState<string | null>(null);
  const [selectedFilename, setSelectedFilename] = useState("");
  const [selectedHash, setSelectedHash] = useState("");
  const [restoring, setRestoring] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/darcs", { cache: "no-store" });
      const data: ApiResponse = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Unable to retrieve Darcs history.");
      }

      const nextPatches = parsePatches(data.history ?? "");
      const nextResumes = data.resumes ?? [];

      setPatches(nextPatches);
      setResumes(nextResumes);
      setRepository(data.repository ?? "Darcs repository");
      setWorkingChanges(data.workingChanges ?? "");

      setSelectedFilename((current) =>
        nextResumes.some((resume) => resume.filename === current)
          ? current
          : nextResumes[0]?.filename ?? ""
      );
      setSelectedHash((current) =>
        nextPatches.some((patch) => patch.hash === current)
          ? current
          : nextPatches[1]?.hash ?? nextPatches[0]?.hash ?? ""
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load history.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const hasWorkingChanges =
    workingChanges.trim() !== "" &&
    workingChanges.trim() !== "No changes!";

  const selectedPatch = patches.find((patch) => patch.hash === selectedHash);
  const selectedResume = resumes.find(
    (resume) => resume.filename === selectedFilename
  );

  async function restoreSelectedVersion() {
    if (!selectedFilename || !selectedHash) {
      setError("Select a resume and a recorded version first.");
      setShowConfirmation(false);
      return;
    }

    setRestoring(true);
    setError("");
    setNotice("");
    setShowConfirmation(false);

    try {
      const response = await fetch("/api/darcs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "restore",
          filename: selectedFilename,
          hash: selectedHash,
          confirmed: true,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          [data.error, data.details].filter(Boolean).join(" ") ||
            "Could not restore the selected version."
        );
      }

      setNotice(data.message || "The selected resume version was restored.");
      await loadHistory();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not restore the version."
      );
    } finally {
      setRestoring(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f7f8fc] text-gray-900">
      <header className="border-b border-gray-200 bg-white px-5 py-5 md:px-10">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="rounded-xl border border-gray-300 p-2 transition hover:bg-gray-100"
              aria-label="Back to dashboard"
            >
              <ArrowLeft size={19} />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <History size={21} />
                <h1 className="text-2xl font-bold">Version History</h1>
              </div>
              <p className="mt-1 text-sm text-gray-500">
                Actual patches recorded by Darcs SCM
              </p>
            </div>
          </div>

          <button
            onClick={() => void loadHistory()}
            disabled={loading || restoring}
            className="flex items-center gap-2 rounded-xl bg-black px-4 py-3 text-sm font-medium text-white transition hover:bg-gray-800 disabled:opacity-50"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            Refresh History
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-5 py-8 md:px-10">
        {error && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            <AlertCircle size={19} className="mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold">Operation failed</p>
              <p className="mt-1 break-words">{error}</p>
            </div>
          </div>
        )}

        {notice && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">
            <CheckCircle2 size={19} className="mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold">Success</p>
              <p className="mt-1">{notice}</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          <StatCard
            label="Recorded Patches"
            value={loading ? "…" : String(patches.length)}
            description="Read from darcs changes"
            icon={<GitCommit size={20} />}
          />
          <StatCard
            label="Working Tree"
            value={loading ? "…" : hasWorkingChanges ? "Changes detected" : "Clean"}
            description={hasWorkingChanges ? "Unrecorded changes exist" : "No unrecorded changes"}
            icon={hasWorkingChanges ? <AlertCircle size={20} /> : <CheckCircle2 size={20} />}
          />
          <StatCard
            label="Version Control"
            value="Darcs"
            description="Patch-based version history"
            icon={<History size={20} />}
          />
        </div>

        <section className="mt-8 rounded-2xl border border-gray-200 bg-white p-5 md:p-6">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-amber-50 p-3 text-amber-700">
              <RotateCcw size={21} />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Restore Previous Version</h2>
              <p className="mt-1 text-sm leading-6 text-gray-500">
                Recover resume contents from a recorded Darcs patch. Restoring
                changes the current file, so review your selection carefully.
              </p>
            </div>
          </div>

          {hasWorkingChanges && (
            <div className="mt-5 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <ShieldAlert size={18} className="mt-0.5 shrink-0" />
              <p>
                Your working tree has unrecorded changes. Record or resolve
                them before restoring a version.
              </p>
            </div>
          )}

          <div className="mt-6 grid gap-5 md:grid-cols-2">
            <div>
              <label htmlFor="restore-resume" className="mb-2 block text-sm font-medium text-gray-700">
                Resume file
              </label>
              <select
                id="restore-resume"
                value={selectedFilename}
                onChange={(event) => setSelectedFilename(event.target.value)}
                disabled={loading || restoring || resumes.length === 0}
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:border-gray-500 disabled:bg-gray-50"
              >
                <option value="">Select a resume</option>
                {resumes.map((resume) => (
                  <option key={resume.filename} value={resume.filename}>
                    {resume.filename}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="restore-patch" className="mb-2 block text-sm font-medium text-gray-700">
                Recorded version
              </label>
              <select
                id="restore-patch"
                value={selectedHash}
                onChange={(event) => setSelectedHash(event.target.value)}
                disabled={loading || restoring || patches.length === 0}
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:border-gray-500 disabled:bg-gray-50"
              >
                <option value="">Select a version</option>
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
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Selected historical patch
              </p>
              <p className="mt-2 font-medium">{selectedPatch.message}</p>
              <p className="mt-1 text-sm text-gray-500">
                {selectedPatch.author} · {selectedPatch.date}
              </p>
              <p className="mt-2 break-all font-mono text-xs text-gray-500">
                {selectedPatch.hash}
              </p>
              <p className="mt-3 text-sm text-gray-600">
                Target file:{" "}
                <span className="font-medium">
                  {selectedResume?.filename || "No resume selected"}
                </span>
              </p>
            </div>
          )}

          <button
            onClick={() => {
              setError("");
              setNotice("");
              setShowConfirmation(true);
            }}
            disabled={loading || restoring || hasWorkingChanges || !selectedFilename || !selectedHash || !selectedPatch}
            className="mt-5 inline-flex items-center justify-center gap-2 rounded-xl bg-black px-5 py-3 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RotateCcw size={17} />
            Restore Selected Version
          </button>
          <p className="mt-3 text-xs leading-5 text-gray-500">
            The current file contents will change. Confirm the target before proceeding.
          </p>
        </section>

        <section className="mt-8 overflow-hidden rounded-2xl border border-gray-200 bg-white">
          <div className="border-b border-gray-200 p-5 md:p-6">
            <h2 className="font-semibold">Recorded Patch Timeline</h2>
            <p className="mt-1 text-sm text-gray-500">
              Expand a patch to inspect the raw output returned by Darcs.
            </p>
          </div>

          {loading ? (
            <div className="flex items-center gap-2 p-6 text-sm text-gray-500">
              <LoaderCircle size={17} className="animate-spin" />
              Loading patch history…
            </div>
          ) : patches.length === 0 ? (
            <p className="p-6 text-sm text-gray-500">No recorded patches found.</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {patches.map((patch, index) => {
                const expanded = expandedHash === patch.hash;
                return (
                  <article key={patch.hash} className="p-5 md:p-6">
                    <div className="flex items-start gap-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-gray-700">
                        <GitCommit size={19} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold">{patch.message}</h3>
                          {index === 0 && (
                            <span className="rounded-full bg-green-50 px-2 py-1 text-[10px] font-semibold text-green-700">
                              LATEST
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-sm text-gray-500">
                          {patch.author} · {patch.date}
                        </p>
                        <p className="mt-2 break-all font-mono text-xs text-gray-400">
                          {patch.hash}
                        </p>
                        <button
                          onClick={() => setExpandedHash(expanded ? null : patch.hash)}
                          className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-black"
                        >
                          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          {expanded ? "Hide patch details" : "View patch details"}
                        </button>
                        {expanded && (
                          <pre className="mt-4 max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-gray-50 p-4 font-mono text-xs leading-5 text-gray-700">
                            {patch.details}
                          </pre>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <div className="mt-7 flex flex-wrap gap-3">
          <PageLink href="/compare" icon={<GitCompareArrows size={16} />}>Compare Versions</PageLink>
          <PageLink href="/snapshot" icon={<Eye size={16} />}>Historical Snapshots</PageLink>
          <PageLink href="/" icon={<FileText size={16} />}>Dashboard</PageLink>
        </div>

        {repository && (
          <p className="mt-6 break-all text-xs text-gray-400">
            Repository: {repository}
          </p>
        )}
      </div>

      {showConfirmation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-5">
          <div role="dialog" aria-modal="true" aria-labelledby="restore-title" className="w-full max-w-lg rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-amber-50 p-3 text-amber-700">
                <ShieldAlert size={23} />
              </div>
              <div>
                <h2 id="restore-title" className="text-lg font-bold">Confirm version restoration</h2>
                <p className="mt-2 text-sm leading-6 text-gray-600">
                  This will replace <strong>{selectedFilename}</strong> with contents from the selected historical patch.
                </p>
              </div>
            </div>
            <div className="mt-4 rounded-xl bg-gray-50 p-4">
              <p className="font-semibold">{selectedPatch?.message}</p>
              <p className="mt-1 break-all font-mono text-xs text-gray-500">{selectedHash}</p>
            </div>
            <p className="mt-4 text-sm leading-6 text-gray-600">
              Continue only if this is the version you want to restore.
            </p>
            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                onClick={() => setShowConfirmation(false)}
                disabled={restoring}
                className="rounded-xl border border-gray-200 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => void restoreSelectedVersion()}
                disabled={restoring}
                className="inline-flex items-center gap-2 rounded-xl bg-black px-4 py-3 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-50"
              >
                {restoring ? <LoaderCircle size={17} className="animate-spin" /> : <RotateCcw size={17} />}
                {restoring ? "Restoring…" : "Confirm Restore"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function StatCard({
  label,
  value,
  description,
  icon,
}: {
  label: string;
  value: string;
  description: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-gray-300 bg-white p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-gray-500">{label}</p>
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 text-gray-800">
          {icon}
        </span>
      </div>
      <p className="mt-4 break-words text-2xl font-bold">{value}</p>
      <p className="mt-1 text-xs text-gray-400">{description}</p>
    </div>
  );
}

function PageLink({
  href,
  icon,
  children,
}: {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
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
