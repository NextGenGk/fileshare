import { createFileRoute, Link } from "@tanstack/react-router";
import { DocsShell, Section, CodeBlock, InfoBox } from "@/components/docs-shell";

export const Route = createFileRoute("/docs/cli")({
  head: () => ({
    meta: [
      { title: "CLI — FileShare Docs" },
      {
        name: "description",
        content:
          "Install @fileshare/cli to upload files from your terminal with flags for expiry, passwords, download limits, and JSON output.",
      },
    ],
  }),
  component: DocsCli,
});

function DocsCli() {
  const origin =
    typeof window !== "undefined" ? window.location.origin : "https://fileshare.devgaurav.online";

  return (
    <DocsShell
      activePage="cli"
      title="CLI"
      subtitle="Install @fileshare/cli to upload files from your terminal with flags for expiry, passwords, download limits, and JSON output."
      sections={[
        { id: "install", label: "Install" },
        { id: "usage", label: "Usage" },
        { id: "api-key", label: "API key" },
        { id: "interactive", label: "Interactive mode" },
        { id: "large-files", label: "Large files" },
        { id: "rate-limits", label: "Rate limits" },
      ]}
    >
      <Section id="install" title="Install">
        <p>
          The command-line client ships as the npm package <code>@fileshare/cli</code> and installs
          the <code>fileshare</code> executable.
        </p>

        <CodeBlock label="Install globally">
          {`npm install -g @fileshare/cli
fileshare --help`}
        </CodeBlock>

        <p>Or use the one-liner shell install:</p>

        <CodeBlock label="Shell install">{`curl -fsSL ${origin}/cli/install.sh | sh`}</CodeBlock>
      </Section>

      <Section id="usage" title="Usage">
        <p>
          Use flags for CI and scripted uploads. The CLI supports file path, duration or fixed
          expiry date, password protection, max downloads, base URL override, and JSON output.
        </p>
        <p>
          Fixed expiry dates must include an explicit timezone such as <code>Z</code> or{" "}
          <code>+02:00</code>.
        </p>

        <CodeBlock label="Basic upload">
          {`fileshare \\
  --file ./artifact.zip \\
  --duration 24h`}
        </CodeBlock>

        <CodeBlock label="Fixed expiry date">
          {`fileshare --file ./artifact.zip \\
  --expires-at 2026-04-25T18:00:00.000Z`}
        </CodeBlock>

        <CodeBlock label="JSON output for automation">
          {`fileshare --file ./artifact.zip --duration 24h --json`}
        </CodeBlock>
      </Section>

      <Section id="api-key" title="API key authentication">
        <p>
          Set your API key via the <code>FILESHARE_API_KEY</code> environment variable for
          authenticated operations like listing your drops and deleting files.
        </p>

        <CodeBlock label="Set API key">
          {`export FILESHARE_API_KEY=dlv_abc123def456...
fileshare list`}
        </CodeBlock>

        <p>
          You can also set a custom API base URL with <code>FILESHARE_API_URL</code>.
        </p>

        <InfoBox variant="info" title="Key security">
          The API key is included in every request. Keep it secure and rotate it regularly. Revoke
          compromised keys from the dashboard.
        </InfoBox>
      </Section>

      <Section id="interactive" title="Interactive mode">
        <p>
          Run <code>fileshare</code> with no arguments to open the full terminal form. The form
          shows all currently active fields at once, lets you move with the arrow keys, switch
          between duration and fixed-date expiry modes inline, and submit without leaving the
          terminal UI.
        </p>
        <p>
          The active fields, default duration, and validation rules are fetched from{" "}
          <code>GET /api/cli/config</code>, so the service can enable or require options without
          shipping a new CLI first.
        </p>
        <p>
          That config also carries the current recipient cap and expiry rules, so the terminal UI
          stays aligned with the live API.
        </p>

        <InfoBox variant="info" title="CI mode">
          Use <code>--yes</code> in CI or scripted environments to disable prompts. Missing required
          values fail fast instead of blocking on stdin.
        </InfoBox>
      </Section>

      <Section id="large-files" title="Large files">
        <p>
          Smaller files go through <code>POST /api/upload</code>. Larger files automatically switch
          to the direct upload flow based on file size or the inline API response.
        </p>
        <p>
          See the{" "}
          <Link to="/docs/api" className="text-accent hover:underline">
            REST API docs
          </Link>{" "}
          for the underlying endpoint reference used by the CLI.
        </p>
      </Section>

      <Section id="rate-limits" title="Rate limits">
        <p>
          The CLI is subject to the same rate limits as the API. Using an API key grants you
          significantly higher limits (60 uploads/min vs 5 uploads/min for anonymous requests).
        </p>
        <p>
          Rate limit headers are returned in every response. Use <code>--json</code> mode to inspect
          them for debugging.
        </p>
      </Section>
    </DocsShell>
  );
}
