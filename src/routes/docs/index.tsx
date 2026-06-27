import { createFileRoute, Link } from "@tanstack/react-router";
import {
  DocsShell,
  Section,
  CodeBlock,
  InfoBox,
  TwoColCard,
  StatusCodeTable,
} from "@/components/docs-shell";

export const Route = createFileRoute("/docs/")({
  head: () => ({
    meta: [
      { title: "Overview — FileShare Docs" },
      {
        name: "description",
        content:
          "Everything to start using FileShare: web uploads, share links, REST API paths, limits, rate limiting, API key auth, and the security model.",
      },
    ],
  }),
  component: DocsOverview,
});

function DocsOverview() {
  const origin =
    typeof window !== "undefined" ? window.location.origin : "https://fileshare.devgaurav.online";

  return (
    <DocsShell
      activePage="overview"
      title="Overview"
      subtitle="Everything you need to start using FileShare: web uploads, share links, REST API paths, limits, rate limits, and the security model."
      sections={[
        { id: "quickstart", label: "Quickstart" },
        { id: "web-uploads", label: "Web uploads" },
        { id: "share-links", label: "Share links" },
        { id: "limits", label: "Limits" },
        { id: "authentication", label: "Authentication" },
        { id: "rate-limiting", label: "Rate limiting" },
        { id: "security", label: "Security" },
        { id: "status-codes", label: "Status codes" },
      ]}
    >
      <Section id="quickstart" title="Quickstart">
        <p>
          FileShare is built for temporary file delivery. Upload a file through the web UI or API,
          get a short share link, and let the service handle expiry, optional passwords, and
          download limits.
        </p>
        <p>
          The fastest way to try the service is the homepage uploader. For automation, use the REST
          API or CLI. Small files go through a single multipart request. Larger files use a two-step
          direct upload flow.
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <TwoColCard label="Web">
            Choose a file, pick an expiry duration, optionally add a password or download limit, and
            upload from the homepage.
          </TwoColCard>
          <TwoColCard label="REST API">
            Use <code>POST /api/upload</code> for smaller files or the direct upload session flow
            for larger ones.
          </TwoColCard>
        </div>

        <div className="mt-6 space-y-4">
          <CodeBlock label="Small file via REST">
            {`curl -X POST ${origin}/api/upload \\
  -F "file=@./report.pdf" \\
  -F "duration=24h" \\
  -F "password=secret" \\
  -F "maxDownloads=10"`}
          </CodeBlock>
        </div>
      </Section>

      <Section id="web-uploads" title="Web uploads">
        <p>
          The homepage uploader supports one file at a time and exposes the same core options as the
          API: expiry controls, password, and max downloads.
        </p>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-muted-foreground">
          <li>The homepage offers a custom expiry up to 30 days for signed-in users.</li>
          <li>Guest (unauthenticated) uploads are automatically set to expire in <strong>5 minutes</strong>.</li>
          <li>Files upload via the direct upload flow through the API, stored in Vercel Blob.</li>
          <li>
            Successful uploads return a short share URL in the form <code>/d/&lt;slug&gt;</code>.
          </li>
        </ul>
      </Section>

      <Section id="share-links" title="Share links and downloads">
        <p>
          Every upload gets a share page under <code>/d/&lt;slug&gt;</code>. That page is the public
          download surface for the file.
        </p>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-muted-foreground">
          <li>
            If the file is password protected, the download page prompts for the password before
            download.
          </li>
          <li>If the file has expired, the page shows that state instead of a download action.</li>
          <li>
            If the file reaches its max download count, the page shows that the limit has been
            reached.
          </li>
          <li>Downloads are counted server-side before the object is streamed.</li>
        </ul>
        <p>
          You can also inspect lightweight metadata through <code>GET /api/files/:slug</code> before
          downloading.
        </p>
      </Section>

      <Section id="limits" title="Limits and current behavior">
        <div className="overflow-x-auto rounded-xl border border-border/60">
          <table className="min-w-full divide-y divide-border/60 text-left text-sm">
            <thead className="bg-muted/10">
              <tr>
                <th className="px-5 py-3 font-medium text-foreground/80">Item</th>
                <th className="px-5 py-3 font-medium text-foreground/80">Current behavior</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60 text-muted-foreground">
              <tr>
                <td className="px-5 py-3 text-foreground/90">Overall file size limit</td>
                <td className="px-5 py-3">2 GiB</td>
              </tr>
              <tr>
                <td className="px-5 py-3 text-foreground/90">Durations</td>
                <td className="px-5 py-3">Guest uploads expire in <strong>5 minutes</strong>; signed-in users get 1h, 24h, 3d, 7d or a custom expiry up to 30 days</td>
              </tr>
              <tr>
                <td className="px-5 py-3 text-foreground/90">Max downloads</td>
                <td className="px-5 py-3">Optional, limited to a positive integer</td>
              </tr>
              <tr>
                <td className="px-5 py-3 text-foreground/90">Storage</td>
                <td className="px-5 py-3">File data stored in Vercel Blob; metadata in PostgreSQL (Neon)</td>
              </tr>
              <tr>
                <td className="px-5 py-3 text-foreground/90">Authentication</td>
                <td className="px-5 py-3">
                  No API key required for basic uploads; API keys and Clerk JWT supported
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <InfoBox variant="warning" title="Large-file REST uploads are two-step">
          A single <code>curl -F</code> request is only for the inline upload path. Larger REST
          uploads use <code>POST /api/uploads</code>, a file upload URL, and then{" "}
          <code>POST /api/uploads/:uploadId/complete</code>.
        </InfoBox>
      </Section>

      <Section id="authentication" title="Authentication">
        <p>
          FileShare supports two authentication methods via the <code>Authorization</code> header:
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <TwoColCard label="API Keys">
            Keys start with the <code>dlv_</code> prefix. Create them from the dashboard or the API.
            Pass as <code>Authorization: Bearer dlv_&lt;key&gt;</code>.
          </TwoColCard>
          <TwoColCard label="Clerk JWT">
            Web users are authenticated via Clerk. Session tokens can also be used in the
            <code>Authorization</code> header for API access.
          </TwoColCard>
        </div>

        <CodeBlock label="Using an API key">
          {`curl -X GET "${origin}/api/public/v1/me/drops" \\
  -H "Authorization: Bearer dlv_abc123def456..."`}
        </CodeBlock>

        <p className="mt-4">
          Unauthenticated requests can still upload files and download public shares. Authentication
          is required for managing drops, creating API keys, and deleting files.
        </p>
      </Section>

      <Section id="rate-limiting" title="Rate limiting">
        <p>
          Rate limits are enforced per sliding window. Limits vary by authentication tier and the
          type of action. Three tiers are available:
        </p>

        <div className="overflow-x-auto rounded-xl border border-border/60">
          <table className="min-w-full divide-y divide-border/60 text-left text-sm">
            <thead className="bg-muted/10">
              <tr>
                <th className="px-5 py-3 font-medium text-foreground/80">Tier</th>
                <th className="px-5 py-3 font-medium text-foreground/80">Upload</th>
                <th className="px-5 py-3 font-medium text-foreground/80">Download</th>
                <th className="px-5 py-3 font-medium text-foreground/80">Metadata</th>
                <th className="px-5 py-3 font-medium text-foreground/80">Management</th>
                <th className="px-5 py-3 font-medium text-foreground/80">Config</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60 text-muted-foreground">
              <tr>
                <td className="px-5 py-3 text-foreground/90">Anonymous (per IP)</td>
                <td className="px-5 py-3">5/min</td>
                <td className="px-5 py-3">20/min</td>
                <td className="px-5 py-3">30/min</td>
                <td className="px-5 py-3">10/min</td>
                <td className="px-5 py-3">60/min</td>
              </tr>
              <tr>
                <td className="px-5 py-3 text-foreground/90">API Key</td>
                <td className="px-5 py-3">60/min</td>
                <td className="px-5 py-3">200/min</td>
                <td className="px-5 py-3">300/min</td>
                <td className="px-5 py-3">100/min</td>
                <td className="px-5 py-3">600/min</td>
              </tr>
              <tr>
                <td className="px-5 py-3 text-foreground/90">Authenticated (JWT)</td>
                <td className="px-5 py-3">60/min</td>
                <td className="px-5 py-3">200/min</td>
                <td className="px-5 py-3">300/min</td>
                <td className="px-5 py-3">100/min</td>
                <td className="px-5 py-3">600/min</td>
              </tr>
            </tbody>
          </table>
        </div>

        <p className="mt-4">
          Every response includes <code>X-RateLimit-Limit</code>, <code>X-RateLimit-Remaining</code>
          , and <code>X-RateLimit-Reset</code> headers. When a limit is exceeded, the API returns{" "}
          <code>429 Too Many Requests</code>.
        </p>
      </Section>

      <Section id="security" title="Security and privacy">
        <p>
          FileShare is designed for temporary delivery, not permanent storage. Files can be
          protected with a password, limited by download count, and expire automatically.
        </p>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-muted-foreground">
          <li>Passwords are SHA-256 hashed server-side and verified on download.</li>
          <li>
            The service stores the metadata required to enforce expiry, passwords, and download
            limits.
          </li>
          <li>
            The public share link is the only thing needed to reach the download page unless a
            password is configured.
          </li>
          <li>
            API keys are hashed with SHA-256 before storage; the raw key is shown only once on
            creation.
          </li>
          <li>Downloads are logged with IP hashes for abuse monitoring.</li>
        </ul>
        <p>
          For the full endpoint reference and request examples, see the{" "}
          <Link to="/docs/api" className="text-accent hover:underline">
            REST API docs
          </Link>
          .
        </p>
      </Section>

      <Section id="status-codes" title="Status codes">
        <StatusCodeTable
          codes={[
            {
              status: "200",
              meaning: "Upload or metadata request succeeded.",
            },
            {
              status: "400",
              meaning: "Missing file, bad JSON, unsupported duration, or malformed parameters.",
            },
            { status: "401", meaning: "Password required or incorrect, or auth required." },
            { status: "403", meaning: "Forbidden — not the owner of the resource." },
            { status: "404", meaning: "Share or underlying object not found." },
            {
              status: "409",
              meaning: "Direct upload incomplete, or download limit reached during claim.",
            },
            { status: "410", meaning: "File has expired or downloads exhausted." },
            { status: "413", meaning: "File exceeds the inline or overall upload limit." },
            {
              status: "415",
              meaning: "Upload blocked by media policy.",
            },
            {
              status: "429",
              meaning:
                "Rate limit exceeded. Retry after the time specified in the Retry-After header.",
            },
            { status: "500", meaning: "Internal server error." },
          ]}
        />
      </Section>
    </DocsShell>
  );
}
