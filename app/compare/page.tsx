
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  GitCompareArrows,
  RefreshCw,
  FileText,
  Plus,
  Minus,
  AlertCircle,
  CheckCircle2,
  LoaderCircle,
  History,
  Eye,
  Columns2,
  AlignLeft,
} from "lucide-react";

type Patch = {
  hash: string;
  author: string;
  date: string;
  message: string;
};

type ApiData = {
  success: boolean;
  history?: string;
  error?: string;
  details?: string;
};

type CompareResponse = {
  success: boolean;
  output?: string;
  error?: string;
  details?: string;
};

type DiffLine = {
  type: "added" | "removed" | "context" | "header";
  text: string;
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
        lines
          .find((line) => line.startsWith("Author:"))
          ?.replace(/^Author:\s*/, "")
          .trim() || "Unknown author";

      const date =
        lines
          .find((line) => line.startsWith("Date:"))
          ?.replace(/^Date:\s*/, "")
          .trim() || "Date unavailable";

      const message = lines
        .filter((line) => /^\s+\*\s/.test(line))
        .map((line) => line.replace(/^\s+\*\s/, "").trim())
        .join(" ");

      return {
        hash,
        author,
        date,
        message: message || "Recorded changes",
      };
    })
    .filter((patch) => /^[a-f0-9]{8,64}$/i.test(patch.hash));
}

function classifyLine(line: string): DiffLine["type"] {
  if (
    line.startsWith("+++ ") ||
    line.startsWith("--- ") ||
    line.startsWith("diff ") ||
    line.startsWith("patch ") ||
    line.startsWith("hash ") ||
    line.startsWith("@@")
  ) {
    return "header";
  }

  if (line.startsWith("+")) return "added";
  if (line.startsWith("-")) return "removed";

  return "context";
}

function parseDiff(output: string): DiffLine[] {
  return output.split("\n").map((text) => ({
    text,
    type: classifyLine(text),
  }));
}

function buildSideBySide(lines: DiffLine[]) {
  const left: DiffLine[] = [];
  const right: DiffLine[] = [];

  let index = 0;

  while (index < lines.length) {
    const line = lines[index];

    if (line.type === "removed") {
      const removed: DiffLine[] = [];
      const added: DiffLine[] = [];

      while (index < lines.length && lines[index].type === "removed") {
        removed.push(lines[index]);
        index++;
      }

      while (index < lines.length && lines[index].type === "added") {
        added.push(lines[index]);
        index++;
      }

      const rows = Math.max(removed.length, added.length);

      for (let row = 0; row < rows; row++) {
        left.push(
          removed[row] ?? { text: "", type: "context" }
        );
        right.push(
          added[row] ?? { text: "", type: "context" }
        );
      }

      continue;
    }

    if (line.type === "added") {
      left.push({ text: "", type: "context" });
      right.push(line);
      index++;
      continue;
    }

    left.push(line);
    right.push(line);
    index++;
  }

  return { left, right };
}

function DiffPane({
  title,
  lines,
  side,
}: {
  title: string;
  lines: DiffLine[];
  side: "left" | "right";
}) {
  const isLeft = side === "left";

  return (
    <section className="min-w-0 overflow-hidden rounded-xl border border-gray-200 bg-white">
      <div
        className={`border-b px-4 py-3 text-sm font-semibold ${
          isLeft
            ? "border-red-200 bg-red-50 text-red-800"
            : "border-green-200 bg-green-50 text-green-800"
        }`}
      >
        <span className="flex items-center gap-2">
          {isLeft ? <Minus size={15} /> : <Plus size={15} />}
          {title}
        </span>
      </div>

      <div className="max-h-[600px] overflow-auto">
        <pre className="font-mono text-xs leading-6">
          {lines.map((line, index) => {
            let className = "text-gray-700";

            if (line.type === "removed") {
              className = "bg-red-50 text-red-800";
            } else if (line.type === "added") {
              className = "bg-green-50 text-green-800";
            } else if (line.type === "header") {
              className = "bg-blue-50 font-semibold text-blue-800";
            }

            return (
              <div
                key={`${index}-${line.text}`}
                className={`min-h-6 whitespace-pre px-3 ${className}`}
              >
                {line.text || " "}
              </div>
            );
          })}
        </pre>
      </div>
    </section>
  );
}

export default function CompareVersionsPage() {
  const [patches, setPatches] = useState<Patch[]>([]);
  const [fromHash, setFromHash] = useState("");
  const [toHash, setToHash] = useState("");
  const [diffOutput, setDiffOutput] = useState("");
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [comparing, setComparing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [view, setView] = useState<"side" | "raw">("side");

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch("/api/darcs", {
        cache: "no-store",
      });

      const data: ApiData = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Could not load Darcs history.");
      }

      const parsed = parsePatches(data.history || "");
      setPatches(parsed);

      setFromHash((current) =>
        parsed.some((patch) => patch.hash === current)
          ? current
          : parsed[1]?.hash || parsed[0]?.hash || ""
      );

      setToHash((current) =>
        parsed.some((patch) => patch.hash === current)
          ? current
          : parsed[0]?.hash || ""
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not load history."
      );
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const fromPatch = patches.find((patch) => patch.hash === fromHash);
  const toPatch = patches.find((patch) => patch.hash === toHash);

  async function compareVersions() {
    setError("");
    setNotice("");
    setDiffOutput("");

    if (!fromHash || !toHash) {
      setError("Select both versions before comparing.");
      return;
    }

    if (fromHash === toHash) {
      setError("Choose two different versions to compare.");
      return;
    }

    setComparing(true);

    try {
      const response = await fetch("/api/darcs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "compare",
          fromHash,
          toHash,
        }),
      });

      const data: CompareResponse = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.error || data.details || "Comparison failed."
        );
      }

      setDiffOutput(data.output || "No textual differences were returned.");
      setNotice("Darcs comparison completed successfully.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Comparison failed."
      );
    } finally {
      setComparing(false);
    }
  }

  const diffLines = useMemo(
    () => parseDiff(diffOutput),
    [diffOutput]
  );

  const sideBySide = useMemo(
    () => buildSideBySide(diffLines),
    [diffLines]
  );

  const additions = diffLines.filter(
    (line) => line.type === "added"
  ).length;

  const removals = diffLines.filter(
    (line) => line.type === "removed"
  ).length;

  return (
    <main className="min-h-screen bg-[#f7f8fc] px-5 py-8 text-gray-900 md:px-10">
      <div className="mx-auto max-w-7xl">
        <Link
          href="/"
          className="mb-8 inline-flex items-center gap-2 text-sm text-gray-500 hover:text-black"
        >
          <ArrowLeft size={16} />
          Back to Dashboard
        </Link>

        <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-3 flex items-center gap-3">
              <div className="rounded-xl border border-gray-200 bg-white p-3">
                <GitCompareArrows size={23} />
              </div>
              <span className="text-sm font-medium text-gray-600">
                DARCS VERSION CONTROL
              </span>
            </div>

            <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
              Compare Versions
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-500">
              Compare recorded resume versions using Darcs and inspect
              changes in a side-by-side or raw diff view.
            </p>
          </div>

          <button
            onClick={() => void loadHistory()}
            disabled={loadingHistory || comparing}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw
              size={16}
              className={loadingHistory ? "animate-spin" : ""}
            />
            Refresh history
          </button>
        </header>

        {error && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            <AlertCircle size={18} className="mt-0.5 shrink-0" />
            <p className="break-words">{error}</p>
          </div>
        )}

        {notice && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">
            <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
            <p>{notice}</p>
          </div>
        )}

        <section className="mb-7 rounded-2xl border border-gray-200 bg-white p-5 md:p-7">
          <div className="mb-6">
            <h2 className="text-lg font-semibold">Choose versions</h2>
            <p className="mt-1 text-sm text-gray-500">
              Select the older version first and the newer version second.
            </p>
          </div>

          {loadingHistory ? (
            <div className="flex items-center gap-2 py-6 text-sm text-gray-500">
              <LoaderCircle size={17} className="animate-spin" />
              Loading recorded patches...
            </div>
          ) : patches.length < 2 ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              At least two recorded patches are needed. Edit a resume and
              record another Darcs version first.
            </div>
          ) : (
            <>
              <div className="grid gap-5 md:grid-cols-2">
                <div>
                  <label
                    htmlFor="from-version"
                    className="mb-2 block text-sm font-medium text-gray-700"
                  >
                    Older version
                  </label>
                  <select
                    id="from-version"
                    value={fromHash}
                    onChange={(event) => setFromHash(event.target.value)}
                    disabled={comparing}
                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:border-gray-500 disabled:bg-gray-50"
                  >
                    {patches.map((patch) => (
                      <option key={patch.hash} value={patch.hash}>
                        {patch.message} — {patch.hash.slice(0, 10)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="to-version"
                    className="mb-2 block text-sm font-medium text-gray-700"
                  >
                    Newer version
                  </label>
                  <select
                    id="to-version"
                    value={toHash}
                    onChange={(event) => setToHash(event.target.value)}
                    disabled={comparing}
                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:border-gray-500 disabled:bg-gray-50"
                  >
                    {patches.map((patch) => (
                      <option key={patch.hash} value={patch.hash}>
                        {patch.message} — {patch.hash.slice(0, 10)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <PatchCard title="Starting version" patch={fromPatch} />
                <PatchCard title="Target version" patch={toPatch} />
              </div>

              <button
                onClick={() => void compareVersions()}
                disabled={
                  comparing ||
                  !fromHash ||
                  !toHash ||
                  fromHash === toHash
                }
                className="mt-6 inline-flex items-center gap-2 rounded-xl bg-black px-5 py-3 text-sm font-semibold text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {comparing ? (
                  <LoaderCircle size={17} className="animate-spin" />
                ) : (
                  <GitCompareArrows size={17} />
                )}
                {comparing ? "Comparing..." : "Compare versions"}
              </button>
            </>
          )}
        </section>

        {diffOutput && (
          <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-200 px-5 py-4">
              <div>
                <h2 className="font-semibold">Comparison results</h2>
                <p className="mt-1 text-xs text-gray-500">
                  Based on the output returned by Darcs
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-4 text-sm">
                <span className="flex items-center gap-1 text-green-700">
                  <Plus size={15} />
                  {additions} additions
                </span>
                <span className="flex items-center gap-1 text-red-700">
                  <Minus size={15} />
                  {removals} removals
                </span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 border-b border-gray-200 p-4">
              <button
                onClick={() => setView("side")}
                className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${
                  view === "side"
                    ? "bg-gray-900 text-white"
                    : "border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                }`}
              >
                <Columns2 size={16} />
                Side-by-side
              </button>

              <button
                onClick={() => setView("raw")}
                className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${
                  view === "raw"
                    ? "bg-gray-900 text-white"
                    : "border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                }`}
              >
                <AlignLeft size={16} />
                Raw Darcs output
              </button>
            </div>

            {view === "side" ? (
              <div className="grid gap-4 p-4 lg:grid-cols-2">
                <DiffPane
                  title="Removed / previous content"
                  lines={sideBySide.left}
                  side="left"
                />
                <DiffPane
                  title="Added / updated content"
                  lines={sideBySide.right}
                  side="right"
                />
              </div>
            ) : (
              <div className="max-h-[650px] overflow-auto p-4">
                <pre className="font-mono text-xs leading-6 md:text-sm">
                  {diffLines.map((line, index) => {
                    const className =
                      line.type === "added"
                        ? "bg-green-50 text-green-800"
                        : line.type === "removed"
                        ? "bg-red-50 text-red-800"
                        : line.type === "header"
                        ? "bg-blue-50 font-semibold text-blue-800"
                        : "text-gray-700";

                    return (
                      <span
                        key={index}
                        className={`block whitespace-pre ${className}`}
                      >
                        {line.text || " "}
                      </span>
                    );
                  })}
                </pre>
              </div>
            )}
          </section>
        )}

        {!diffOutput && !error && (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-12 text-center">
            <FileText className="mx-auto mb-3 text-gray-400" size={30} />
            <h3 className="font-medium text-gray-800">
              Your comparison will appear here
            </h3>
            <p className="mt-2 text-sm text-gray-500">
              Select two different recorded versions and click Compare versions.
            </p>
          </div>
        )}

        <div className="mt-7 flex flex-wrap gap-3">
          <PageLink href="/history" icon={<History size={16} />}>
            Version History
          </PageLink>
          <PageLink href="/snapshot" icon={<Eye size={16} />}>
            Historical Snapshots
          </PageLink>
          <PageLink href="/" icon={<FileText size={16} />}>
            Dashboard
          </PageLink>
        </div>
      </div>
    </main>
  );
}

function PatchCard({
  title,
  patch,
}: {
  title: string;
  patch?: Patch;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
        {title}
      </p>

      {patch ? (
        <>
          <p className="mt-2 font-medium text-gray-800">{patch.message}</p>
          <p className="mt-2 break-all font-mono text-xs text-gray-500">
            {patch.hash}
          </p>
          <p className="mt-2 text-xs text-gray-500">
            {patch.author} · {patch.date}
          </p>
        </>
      ) : (
        <p className="mt-2 text-sm text-gray-400">Select a version</p>
      )}
    </div>
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
