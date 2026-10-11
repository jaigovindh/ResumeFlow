"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  Download,
  FileText,
  History,
  Loader2,
  Printer,
  RefreshCw,
  Save,
  ShieldCheck,
  Sparkles,
  WandSparkles,
} from "lucide-react";

type ResumeFile = {
  filename: string;
  content: string;
};

type TemplateName = "modern" | "minimal" | "professional";

type ApiData = {
  success?: boolean;
  error?: string;
  repository?: string;
  resumes?: ResumeFile[];
  history?: string;
  workingChanges?: string;
};

const TEMPLATE_KEY = "resumeflow-global-template";

const templates: {
  id: TemplateName;
  name: string;
  description: string;
}[] = [
  {
    id: "modern",
    name: "Modern",
    description: "Contemporary layout with blue accents",
  },
  {
    id: "minimal",
    name: "Minimal",
    description: "Clean monochrome layout",
  },
  {
    id: "professional",
    name: "Professional",
    description: "Traditional corporate layout",
  },
];

function renderInline(text: string) {
  const parts = text.split(/(\*\*.*?\*\*|\*.*?\*|`.*?`)/g);

  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }

    if (
      part.startsWith("*") &&
      part.endsWith("*") &&
      part.length > 2
    ) {
      return <em key={index}>{part.slice(1, -1)}</em>;
    }

    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code
          key={index}
          className="rounded bg-slate-100 px-1 py-0.5 text-[0.92em]"
        >
          {part.slice(1, -1)}
        </code>
      );
    }

    return part;
  });
}

function MarkdownPreview({
  content,
  template,
}: {
  content: string;
  template: TemplateName;
}) {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const blocks: React.ReactNode[] = [];
  let paragraph: string[] = [];
  let listItems: string[] = [];
  let key = 0;

  const flushParagraph = () => {
    if (!paragraph.length) return;

    const text = paragraph.join(" ").trim();

    if (text) {
      blocks.push(
        <p key={key++} className="mb-3 leading-7">
          {renderInline(text)}
        </p>
      );
    }

    paragraph = [];
  };

  const flushList = () => {
    if (!listItems.length) return;

    blocks.push(
      <ul
        key={key++}
        className="mb-4 ml-5 list-disc space-y-1.5"
      >
        {listItems.map((item, index) => (
          <li key={index} className="pl-1 leading-6">
            {renderInline(item)}
          </li>
        ))}
      </ul>
    );

    listItems = [];
  };

  lines.forEach((rawLine) => {
    const line = rawLine.trim();

    if (!line) {
      flushParagraph();
      flushList();
      return;
    }

    if (/^[-*_]{3,}$/.test(line)) {
      flushParagraph();
      flushList();
      blocks.push(
        <hr key={key++} className="my-5 border-slate-200" />
      );
      return;
    }

    const heading = line.match(/^(#{1,6})\s+(.+)$/);

    if (heading) {
      flushParagraph();
      flushList();

      const level = heading[1].length;
      const text = heading[2];

      if (level === 1) {
        blocks.push(
          <h1
            key={key++}
            className="mb-4 text-3xl font-bold tracking-tight"
          >
            {renderInline(text)}
          </h1>
        );
      } else if (level === 2) {
        blocks.push(
          <h2
            key={key++}
            className={`mb-3 mt-6 border-b pb-2 text-lg font-bold uppercase tracking-wide ${
              template === "modern"
                ? "border-blue-200 text-blue-800"
                : template === "minimal"
                ? "border-slate-300 text-black"
                : "border-slate-400 text-slate-800"
            }`}
          >
            {renderInline(text)}
          </h2>
        );
      } else {
        blocks.push(
          <h3 key={key++} className="mb-2 mt-4 font-semibold">
            {renderInline(text)}
          </h3>
        );
      }

      return;
    }

    const bullet = line.match(/^[-*+]\s+(.+)$/);

    if (bullet) {
      flushParagraph();
      listItems.push(bullet[1]);
      return;
    }

    const numbered = line.match(/^\d+\.\s+(.+)$/);

    if (numbered) {
      flushParagraph();
      listItems.push(numbered[1]);
      return;
    }

    flushList();
    paragraph.push(line);
  });

  flushParagraph();
  flushList();

  return <div className="resume-content">{blocks}</div>;
}

export default function ResumeEditorPage() {
  const [filename, setFilename] = useState("");
  const [content, setContent] = useState("");
  const [originalContent, setOriginalContent] = useState("");
  const [repository, setRepository] = useState("");
  const [history, setHistory] = useState("");
  const [workingChanges, setWorkingChanges] = useState("");
  const [template, setTemplate] = useState<TemplateName>("modern");
  const [recordMessage, setRecordMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const dirty = content !== originalContent;
  const title = filename.replace(/\.md$/i, "").replace(/[-_]/g, " ");

  const patchCount = useMemo(() => {
    const matches = history.match(/^\s*hash:\s*[a-f0-9]+/gim);
    return matches?.length ?? 0;
  }, [history]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setFilename(params.get("file") || "");

    try {
      const saved = window.localStorage.getItem(TEMPLATE_KEY);

      if (
        saved === "modern" ||
        saved === "minimal" ||
        saved === "professional"
      ) {
        setTemplate(saved);
      }
    } catch {
      // The default template still works if browser storage is unavailable.
    }
  }, []);

  const changeTemplate = (value: TemplateName) => {
    setTemplate(value);

    try {
      window.localStorage.setItem(TEMPLATE_KEY, value);
    } catch {
      // Keep the selected template for this page even if storage is unavailable.
    }
  };

  const loadResume = useCallback(async () => {
    if (!filename) {
      setLoading(false);
      setError("No resume filename was provided. Open a resume from the Resumes page.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/darcs", { cache: "no-store" });
      const data: ApiData = await response.json();

      if (!response.ok || data.success === false) {
        throw new Error(data.error || "Unable to load repository data.");
      }

      const resume = (data.resumes || []).find(
        (item) => item.filename === filename
      );

      if (!resume) {
        throw new Error(
          `Could not find ${filename} in the Darcs repository.`
        );
      }

      setContent(resume.content ?? "");
      setOriginalContent(resume.content ?? "");
      setRepository(data.repository || "");
      setHistory(data.history || "");
      setWorkingChanges(data.workingChanges || "");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to load the resume."
      );
    } finally {
      setLoading(false);
    }
  }, [filename]);

  useEffect(() => {
    if (filename) {
      void loadResume();
    }
  }, [filename, loadResume]);

  async function saveResume(): Promise<boolean> {
    if (!filename) {
      setError("No resume is selected.");
      return false;
    }

    setSaving(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch("/api/darcs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save",
          filename,
          content,
        }),
      });

      const data: ApiData = await response.json();

      if (!response.ok || data.success === false) {
        throw new Error(data.error || "Could not save the resume.");
      }

      setOriginalContent(content);
      setWorkingChanges(data.workingChanges ?? workingChanges);
      setNotice("Resume saved. Your changes are ready to be recorded in Darcs.");
      return true;
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not save the resume."
      );
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function recordVersion() {
    const message = recordMessage.trim();

    if (!message) {
      setError("Enter a description for this version before recording.");
      return;
    }

    if (
      !window.confirm(
        "Record this version in Darcs? Your repository's pending changes may also be included."
      )
    ) {
      return;
    }

    setRecording(true);
    setError("");
    setNotice("");

    try {
      if (dirty) {
        const saved = await saveResume();
        if (!saved) return;
      }

      const response = await fetch("/api/darcs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "record",
          message,
        }),
      });

      const data: ApiData = await response.json();

      if (!response.ok || data.success === false) {
        throw new Error(data.error || "Could not record the version.");
      }

      setRecordMessage("");
      setNotice("Version recorded successfully in Darcs.");
      await loadResume();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not record the version."
      );
    } finally {
      setRecording(false);
    }
  }

  function exportMarkdown() {
    const blob = new Blob([content], {
      type: "text/markdown;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = filename || "resume.md";
    link.click();

    URL.revokeObjectURL(url);
  }

  function printResume() {
    window.print();
  }

  const templateClasses: Record<TemplateName, string> = {
    modern: "border-t-4 border-t-blue-600",
    minimal: "border-t border-t-slate-300",
    professional: "border-t-2 border-t-slate-700",
  };

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <style jsx global>{`
        @media print {
          @page {
            size: A4;
            margin: 14mm;
          }

          html,
          body {
            background: white !important;
          }

          body * {
            visibility: hidden !important;
          }

          .resume-print,
          .resume-print * {
            visibility: visible !important;
          }

          .resume-print {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            border: none !important;
            box-shadow: none !important;
            padding: 0 !important;
            margin: 0 !important;
            color: #111827 !important;
            background: white !important;
          }

          .resume-content {
            font-size: 10.5pt !important;
            line-height: 1.45 !important;
          }

          .resume-content h1 {
            font-size: 23pt !important;
          }

          .resume-content h2 {
            break-after: avoid;
            font-size: 12pt !important;
          }

          .resume-content h3 {
            break-after: avoid;
          }

          .resume-content p,
          .resume-content li {
            orphans: 3;
            widows: 3;
          }

          .resume-content ul {
            break-inside: auto;
          }
        }
      `}</style>

      <header className="editor-controls sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <Link
              href="/resumes"
              className="rounded-lg border border-slate-200 p-2 transition hover:bg-slate-100"
              aria-label="Back to resumes"
            >
              <ArrowLeft size={18} />
            </Link>

            <div>
              <div className="flex items-center gap-2">
                <FileText size={18} className="text-blue-600" />
                <h1 className="text-base font-semibold">Resume editor</h1>
              </div>
              <p className="max-w-[260px] truncate text-xs text-slate-500">
                {filename || "Loading resume..."}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={exportMarkdown}
              disabled={!filename || loading}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
            >
              <Download size={16} />
              <span className="hidden sm:inline">Markdown</span>
            </button>

            <button
              onClick={printResume}
              disabled={loading || !content.trim()}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
            >
              <Printer size={16} />
              Print / PDF
            </button>

            <button
              onClick={() => void saveResume()}
              disabled={loading || saving || !dirty}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Save size={16} />
              )}
              Save
            </button>
          </div>
        </div>
      </header>

      <div className="editor-controls mx-auto max-w-[1600px] px-4 py-4 sm:px-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5">
              <ShieldCheck size={15} className="text-emerald-600" />
              Darcs version control
            </span>

            <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5">
              <History size={15} />
              {patchCount} recorded version{patchCount === 1 ? "" : "s"}
            </span>

            <span
              className={`rounded-full px-3 py-1.5 ${
                dirty
                  ? "bg-amber-50 text-amber-700"
                  : "bg-emerald-50 text-emerald-700"
              }`}
            >
              {dirty ? "Unsaved changes" : "All changes saved"}
            </span>
          </div>

          <button
            onClick={() => void loadResume()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm hover:bg-slate-100 disabled:opacity-50"
          >
            <RefreshCw
              size={15}
              className={loading ? "animate-spin" : ""}
            />
            Reload from repository
          </button>
        </div>

        {error && (
          <div
            role="alert"
            className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            {error}
          </div>
        )}

        {notice && (
          <div
            role="status"
            className="mb-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"
          >
            <Check size={16} />
            {notice}
          </div>
        )}

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h2 className="font-semibold">Resume content</h2>
                <p className="mt-1 text-xs text-slate-500">
                  Edit your resume using Markdown.
                </p>
              </div>
              <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs text-slate-600">
                Markdown
              </span>
            </div>

            <div className="p-4 sm:p-5">
              {loading ? (
                <div className="flex min-h-[480px] items-center justify-center text-sm text-slate-500">
                  <Loader2 size={18} className="mr-2 animate-spin" />
                  Loading resume...
                </div>
              ) : (
                <textarea
                  value={content}
                  onChange={(event) => setContent(event.target.value)}
                  spellCheck
                  aria-label="Resume Markdown content"
                  placeholder={"# Your Name\n\n## Summary\n\nWrite your professional summary here..."}
                  className="min-h-[480px] w-full resize-y rounded-xl border border-slate-200 bg-slate-50 p-4 font-mono text-sm leading-6 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
                />
              )}

              <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                <span>{content.length.toLocaleString()} characters</span>
                <span>Changes are saved to Darcs when recorded.</span>
              </div>
            </div>

            <div className="border-t border-slate-200 bg-slate-50 p-5">
              <div className="mb-3 flex items-center gap-2">
                <History size={17} className="text-blue-600" />
                <h3 className="font-semibold">Record a version</h3>
              </div>

              <p className="mb-3 text-sm text-slate-600">
                Save a named checkpoint in your Darcs history.
              </p>

              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  value={recordMessage}
                  onChange={(event) =>
                    setRecordMessage(event.target.value)
                  }
                  maxLength={200}
                  placeholder="e.g. Add project experience"
                  className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
                />

                <button
                  onClick={() => void recordVersion()}
                  disabled={loading || saving || recording || !recordMessage.trim()}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {recording ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <History size={16} />
                  )}
                  Record version
                </button>
              </div>

              <p className="mt-3 text-xs leading-5 text-slate-500">
                Recording creates a Darcs patch. The selected template is
                stored separately and does not modify your resume Markdown.
              </p>
            </div>
          </section>

          <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
              <div>
                <h2 className="font-semibold">Live preview</h2>
                <p className="mt-1 text-xs text-slate-500">
                  Your formatted resume updates as you type.
                </p>
              </div>

              <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
                <Sparkles size={13} />
                Live
              </span>
            </div>

            <div className="editor-controls border-b border-slate-200 bg-slate-50 p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-700">
                <WandSparkles size={16} className="text-blue-600" />
                Global resume template
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {templates.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => changeTemplate(item.id)}
                    aria-pressed={template === item.id}
                    className={`rounded-xl border p-3 text-left transition ${
                      template === item.id
                        ? "border-blue-500 bg-blue-50 ring-2 ring-blue-100"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold">
                        {item.name}
                      </span>
                      {template === item.id && (
                        <Check size={15} className="text-blue-600" />
                      )}
                    </div>
                    <p className="mt-1 text-xs leading-4 text-slate-500">
                      {item.description}
                    </p>
                  </button>
                ))}
              </div>

              <p className="mt-3 text-xs text-slate-500">
                This selection applies to all resumes in this browser.
              </p>
            </div>

            <div className="bg-slate-100 p-3 sm:p-5">
              <article
                className={`resume-print mx-auto min-h-[700px] w-full max-w-[650px] bg-white px-6 py-8 text-[14px] leading-6 text-slate-800 shadow-sm sm:px-10 sm:py-10 ${templateClasses[template]}`}
              >
                {loading ? (
                  <div className="flex min-h-[400px] items-center justify-center text-sm text-slate-500">
                    Preparing preview...
                  </div>
                ) : content.trim() ? (
                  <>
                    <div
                      className={`mb-5 text-xs font-medium uppercase tracking-widest ${
                        template === "modern"
                          ? "text-blue-600"
                          : template === "minimal"
                          ? "text-slate-500"
                          : "text-slate-700"
                      }`}
                    >
                      {template === "modern"
                        ? "Resume"
                        : template === "minimal"
                        ? "Curriculum Vitae"
                        : "Professional Resume"}
                    </div>

                    <MarkdownPreview
                      content={content}
                      template={template}
                    />

                    <div className="mt-8 border-t border-slate-200 pt-3 text-[10px] text-slate-400">
                      {title}
                    </div>
                  </>
                ) : (
                  <div className="flex min-h-[400px] flex-col items-center justify-center text-center text-slate-400">
                    <FileText size={36} strokeWidth={1.2} />
                    <p className="mt-3 text-sm font-medium">
                      Your resume preview will appear here
                    </p>
                    <p className="mt-1 text-xs">
                      Add some content in the editor to get started.
                    </p>
                  </div>
                )}
              </article>
            </div>
          </section>
        </div>

        <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold">Darcs repository status</h2>
              <p className="mt-1 text-sm text-slate-500">
                Your resume versions are tracked in your local Darcs repository.
              </p>
            </div>
            <Link
              href="/history"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50"
            >
              <History size={15} />
              View history
              <ChevronDown size={14} className="-rotate-90" />
            </Link>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Repository
              </p>
              <p className="mt-1 break-all text-sm text-slate-800">
                {repository || "Loading repository path..."}
              </p>
            </div>

            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Working tree
              </p>
              <p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-800">
                {workingChanges.trim() || "No unrecorded changes reported."}
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}