
import { NextResponse } from "next/server";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { promises as fs } from "node:fs";
import path from "node:path";

const execFileAsync = promisify(execFile);

const REPO = path.join(
  process.env.HOME || "",
  "ResumeFlow-Darcs-Data"
);

export const runtime = "nodejs";

type DarcsError = Error & {
  stdout?: string;
  stderr?: string;
  code?: string | number;
};

async function runDarcs(args: string[]) {
  try {
    const { stdout, stderr } = await execFileAsync("darcs", args, {
      cwd: REPO,
      timeout: 15000,
      maxBuffer: 1024 * 1024,
    });

    return { stdout, stderr };
  } catch (error) {
    const err = error as DarcsError;

    // Darcs may return exit code 1 when there are no working changes.
    if (args[0] === "whatsnew" && String(err.code) === "1") {
      const output = `${err.stdout || ""}\n${err.stderr || ""}`;

      if (output.includes("No changes!")) {
        return { stdout: "No changes!", stderr: "" };
      }
    }

    throw error;
  }
}

function validFilename(filename: unknown): filename is string {
  return (
    typeof filename === "string" &&
    /^[a-zA-Z0-9_-]+\.md$/.test(filename) &&
    filename !== "README.md"
  );
}

function validHash(hash: unknown): hash is string {
  return (
    typeof hash === "string" &&
    /^[a-f0-9]{8,64}$/i.test(hash)
  );
}

async function readResumeFiles() {
  const entries = await fs.readdir(REPO, {
    withFileTypes: true,
  });

  const files = entries.filter(
    (entry) =>
      entry.isFile() &&
      entry.name.endsWith(".md") &&
      entry.name !== "README.md"
  );

  return Promise.all(
    files.map(async (file) => ({
      filename: file.name,
      content: await fs.readFile(
        path.join(REPO, file.name),
        "utf8"
      ),
    }))
  );
}

export async function GET() {
  try {
    const changes = await runDarcs(["changes"]);
    const workingChanges = await runDarcs(["whatsnew"]);
    const resumes = await readResumeFiles();

    return NextResponse.json({
      success: true,
      repository: REPO,
      resumes,
      history: changes.stdout,
      workingChanges: workingChanges.stdout,
    });
  } catch (error) {
    const err = error as DarcsError;

    return NextResponse.json(
      {
        success: false,
        error: err.message || "Darcs request failed",
        details: err.stderr || err.stdout || "",
        code: err.code ?? null,
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const action = body.action;

    // CREATE A RESUME
    if (action === "create") {
      const title =
        typeof body.title === "string"
          ? body.title.trim()
          : "";

      if (!title || title.length > 100) {
        return NextResponse.json(
          {
            success: false,
            error: "Enter a title of up to 100 characters.",
          },
          { status: 400 }
        );
      }

      const slug =
        title
          .normalize("NFKD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-zA-Z0-9_-]+/g, "-")
          .replace(/^-+|-+$/g, "")
          .slice(0, 70) || "New-Resume";

      const filename = `${slug}.md`;
      const filePath = path.join(REPO, filename);

      try {
        await fs.access(filePath);

        return NextResponse.json(
          {
            success: false,
            error: "A resume with that filename already exists.",
          },
          { status: 409 }
        );
      } catch {
        // File does not exist; continue creating it.
      }

      const content =
        typeof body.content === "string" && body.content.trim()
          ? body.content
          : `# ${title}

## Summary

## Experience

## Education

## Skills
`;

      await fs.writeFile(filePath, content, {
        flag: "wx",
      });

      try {
        await runDarcs(["add", filename]);
      } catch (error) {
        await fs.unlink(filePath).catch(() => {});
        throw error;
      }

      return NextResponse.json({
        success: true,
        message: "Resume created and added to Darcs tracking.",
        filename,
      });
    }

    // SAVE A RESUME
    if (action === "save") {
      const { filename, content } = body;

      if (
        !validFilename(filename) ||
        typeof content !== "string" ||
        content.length > 200000
      ) {
        return NextResponse.json(
          {
            success: false,
            error: "Invalid filename or resume content.",
          },
          { status: 400 }
        );
      }

      const filePath = path.join(REPO, filename);

      let stat;

      try {
        stat = await fs.stat(filePath);
      } catch {
        return NextResponse.json(
          { success: false, error: "Resume not found." },
          { status: 404 }
        );
      }

      if (!stat.isFile()) {
        return NextResponse.json(
          { success: false, error: "Resume not found." },
          { status: 404 }
        );
      }

      await fs.writeFile(filePath, content, "utf8");

      return NextResponse.json({
        success: true,
        message: "Resume saved. Darcs can detect the changes.",
        filename,
      });
    }

    // RECORD A VERSION
    if (action === "record") {
      const message =
        typeof body.message === "string"
          ? body.message.trim()
          : "";

      if (!message || message.length > 200) {
        return NextResponse.json(
          {
            success: false,
            error: "Enter a patch message of up to 200 characters.",
          },
          { status: 400 }
        );
      }

      const result = await runDarcs([
        "record",
        "--all",
        "-m",
        message,
      ]);

      return NextResponse.json({
        success: true,
        message: "Darcs patch recorded successfully.",
        output: result.stdout + result.stderr,
      });
    }

    // COMPARE TWO RECORDED VERSIONS
    if (action === "compare") {
      const { fromHash, toHash } = body;

      if (!validHash(fromHash) || !validHash(toHash)) {
        return NextResponse.json(
          {
            success: false,
            error: "Invalid Darcs patch hash.",
          },
          { status: 400 }
        );
      }

      if (
        fromHash.toLowerCase() === toHash.toLowerCase()
      ) {
        return NextResponse.json(
          {
            success: false,
            error: "Select two different versions to compare.",
          },
          { status: 400 }
        );
      }

      const result = await runDarcs([
        "diff",
        `--from-hash=${fromHash}`,
        `--to-hash=${toHash}`,
      ]);

      return NextResponse.json({
        success: true,
        output: [result.stdout, result.stderr]
          .filter(Boolean)
          .join("\n"),
      });
    }
    
    // RESTORE A RESUME FROM A PREVIOUS VERSION
    if (action === "restore") {
        const { filename, hash, confirmed } = body;
  
        if (!confirmed) {
          return NextResponse.json(
            {
              success: false,
              error: "Restore confirmation is required.",
            },
            { status: 400 }
          );
        }
  
        if (!validFilename(filename) || !validHash(hash)) {
          return NextResponse.json(
            {
              success: false,
              error: "Invalid resume filename or patch hash.",
            },
            { status: 400 }
          );
        }
  
        const filePath = path.join(REPO, filename);
  
        try {
          const stat = await fs.stat(filePath);
  
          if (!stat.isFile()) {
            return NextResponse.json(
              { success: false, error: "Resume not found." },
              { status: 404 }
            );
          }
        } catch {
          return NextResponse.json(
            { success: false, error: "Resume not found." },
            { status: 404 }
          );
        }
  
        // Ensure the current working tree has no pending changes.
        const working = await runDarcs(["whatsnew"]);
  
        if (
          working.stdout.trim() !== "No changes!" ||
          working.stderr.trim() !== ""
        ) {
          return NextResponse.json(
            {
              success: false,
              error:
                "There are unrecorded changes. Save and record them before restoring a previous version.",
              details: working.stdout + working.stderr,
            },
            { status: 409 }
          );
        }
  
        // Retrieve this file as it existed at the selected Darcs patch.
        const historical = await runDarcs([
          "show",
          "contents",
          `--match=hash ${hash}`,
          filename,
        ]);
  
        // Preserve the current file if the historical result is empty
        // because the file did not exist in that version.
        if (!historical.stdout.trim()) {
          return NextResponse.json(
            {
              success: false,
              error:
                "The selected historical version has no content for this resume.",
            },
            { status: 404 }
          );
        }
  
        const currentContent = await fs.readFile(filePath, "utf8");
  
        if (currentContent === historical.stdout) {
          return NextResponse.json({
            success: true,
            message: "The resume already matches the selected version.",
            restored: false,
          });
        }
  
        await fs.writeFile(filePath, historical.stdout, "utf8");
  
        try {
          const recordResult = await runDarcs([
            "record",
            "--all",
            "-m",
            `Restore ${filename} to version ${hash.slice(0, 10)}`,
          ]);
  
          return NextResponse.json({
            success: true,
            message: "Previous resume version restored and recorded.",
            restored: true,
            output: recordResult.stdout + recordResult.stderr,
          });
        } catch (error) {
          // Keep the restored content available if recording fails.
          // The API reports the failure so it can be inspected.
          const err = error as DarcsError;
  
          return NextResponse.json(
            {
              success: false,
              error: "Resume content was restored, but Darcs could not record it.",
              details: err.stderr || err.stdout || err.message,
            },
            { status: 500 }
          );
        }
      }
    
    // READ A HISTORICAL RESUME WITHOUT RESTORING IT
    if (action === "snapshot") {
        const { filename, hash } = body;
  
        if (!validFilename(filename) || !validHash(hash)) {
          return NextResponse.json(
            {
              success: false,
              error: "Invalid resume filename or patch hash.",
            },
            { status: 400 }
          );
        }
  
        // Verify that the resume exists in the current repository.
        try {
          const stat = await fs.stat(path.join(REPO, filename));
  
          if (!stat.isFile()) {
            return NextResponse.json(
              { success: false, error: "Resume not found." },
              { status: 404 }
            );
          }
        } catch {
          return NextResponse.json(
            { success: false, error: "Resume not found." },
            { status: 404 }
          );
        }
  
        // Read the file at the selected historical patch.
        // This command does not modify the working file.
        const result = await runDarcs([
          "show",
          "contents",
          `--match=hash ${hash}`,
          filename,
        ]);
  
        return NextResponse.json({
          success: true,
          filename,
          hash,
          content: result.stdout,
          readOnly: true,
          message: "Historical snapshot loaded without changing the working file.",
        });
      }
  
    // UNKNOWN ACTION
    return NextResponse.json(
      {
        success: false,
        error: "Unsupported action.",
      },
      { status: 400 }
    );
  } catch (error) {
    const err = error as DarcsError;

    return NextResponse.json(
      {
        success: false,
        error: err.message || "Darcs request failed",
        details: err.stderr || err.stdout || "",
        code: err.code ?? null,
      },
      { status: 500 }
    );
  }
}
