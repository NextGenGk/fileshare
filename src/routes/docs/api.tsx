import { createFileRoute } from "@tanstack/react-router";
import {
  DocsShell,
  Section,
  SubHeading,
  CodeBlock,
  InfoBox,
  FieldTable,
  StatusCodeTable,
  TwoColCard,
} from "@/components/docs-shell";

export const Route = createFileRoute("/docs/api")({
  head: () => ({
    meta: [
      { title: "REST API — FileShare Docs" },
      {
        name: "description",
        content:
          "Upload files, create direct upload sessions, inspect share metadata, and download files without an SDK. Full API reference with v1 endpoints, auth, and rate limits.",
      },
    ],
  }),
  component: DocsApi,
});

function DocsApi() {
  const origin =
    typeof window !== "undefined" ? window.location.origin : "https://fileshare.devgaurav.online";

  return (
    <DocsShell
      activePage="api"
      title="REST API"
      subtitle="Upload files, create direct upload sessions, inspect share metadata, and download files without an SDK. This page documents the full public API surface including v1 endpoints."
      sections={[
        { id: "overview", label: "Overview" },
        { id: "authentication", label: "Authentication" },
        { id: "rate-limiting", label: "Rate limiting" },
        { id: "inline-upload", label: "Inline upload" },
        { id: "direct-upload", label: "Direct upload" },
        { id: "v1-upload", label: "V1 upload" },
        { id: "metadata-download", label: "Metadata and download" },
        { id: "v1-drops", label: "V1 drops" },
        { id: "claims", label: "Claim codes" },
        { id: "me", label: "User endpoints" },
        { id: "api-keys", label: "API keys" },
        { id: "cli-config", label: "CLI config" },
        { id: "qr", label: "QR code" },
        { id: "errors", label: "Errors" },
      ]}
    >
      <Section id="overview" title="Overview">
        <p>
          The API is public and requires no API key for basic uploads and downloads. Two API
          versions exist: the original endpoints under <code>/api/</code> and the v1 public API
          under <code>/api/public/v1/</code>. The v1 endpoints offer more features including OTP
          claim codes and consistent naming.
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <TwoColCard label="Original API">
            <code>POST /api/upload</code>, <code>GET /api/files/:slug</code>, etc.
          </TwoColCard>
          <TwoColCard label="V1 Public API">
            <code>POST /api/public/v1/uploads/init</code>,{" "}
            <code>GET /api/public/v1/drops/:slug</code>, etc.
          </TwoColCard>
        </div>
      </Section>

      <Section id="authentication" title="Authentication">
        <p>
          Two authentication methods are supported via the <code>Authorization</code> header:
        </p>

        <SubHeading>API Keys</SubHeading>
        <p>
          API keys start with <code>dlv_</code>. Create them from the web dashboard or via
          <code>POST /api/public/v1/me/keys</code>. Include the key in requests:
        </p>
        <CodeBlock label="API Key auth">
          {`curl -H "Authorization: Bearer dlv_abc123def456..." ${origin}/api/public/v1/me/drops`}
        </CodeBlock>

        <SubHeading>Clerk JWT</SubHeading>
        <p>Web users authenticated via Clerk can use their session token:</p>
        <CodeBlock label="JWT auth">
          {`curl -H "Authorization: Bearer <clerk-jwt>" ${origin}/api/public/v1/me/drops`}
        </CodeBlock>

        <InfoBox variant="info" title="Unauthenticated access">
          Uploading, downloading, and reading metadata all work without authentication.
          Authentication is required for managing drops, listing drops, and API key management.
        </InfoBox>
      </Section>

      <Section id="rate-limiting" title="Rate limiting">
        <p>
          Rate limits are enforced per sliding window. Three tiers exist based on authentication:
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
          , and <code>X-RateLimit-Reset</code> headers. When exceeded, the API returns{" "}
          <code>429</code> with <code>Retry-After</code>.
        </p>
      </Section>

      <Section id="inline-upload" title="Inline upload">
        <p>
          Use the inline upload endpoint for smaller files. This is the simplest path and works well
          for scripts and small automation jobs. Files are stored directly in the database.
        </p>

        <FieldTable
          fields={[
            { name: "file", type: "multipart file", notes: "Required." },
            {
              name: "duration",
              type: "string",
              notes:
                "Optional. One of <code>1h</code>, <code>24h</code>, <code>3d</code>, <code>7d</code>. Mutually exclusive with <code>expiresAt</code>.",
            },
            {
              name: "expiresAt",
              type: "string",
              notes:
                "Optional. Fixed expiry date in ISO 8601 format with an explicit timezone, e.g. <code>2026-04-25T18:00:00.000Z</code>. Mutually exclusive with <code>duration</code>.",
            },
            { name: "password", type: "string", notes: "Optional. Protects downloads." },
            {
              name: "maxDownloads",
              type: "string/integer",
              notes: "Optional. Positive integer.",
            },
          ]}
        />

        <CodeBlock label="POST /api/upload">
          {`curl -X POST ${origin}/api/upload \\
  -F "file=@./report.pdf" \\
  -F "duration=24h" \\
  -F "password=secret" \\
  -F "maxDownloads=10"`}
        </CodeBlock>

        <CodeBlock label="Success response">
          {`{
  "id": "a1c94e2f",
  "url": "${origin}/d/a1c94e2f",
  "expires": "2026-04-16T14:00:00.000Z",
  "downloads": 0,
  "maxDownloads": 10,
  "passwordRequired": true,
  "filename": "report.pdf",
  "size": 128044
}`}
        </CodeBlock>
      </Section>

      <Section id="direct-upload" title="Direct upload for larger files">
        <p>
          Larger files use a session-based direct upload flow. First create a session, then upload
          the file to the provided URL, then finalize the upload.
        </p>

        <div className="space-y-6">
          <div className="space-y-3">
            <SubHeading>1. Create upload session</SubHeading>
            <CodeBlock label="POST /api/uploads">
              {`curl -X POST ${origin}/api/uploads \\
  -H "Content-Type: application/json" \\
  -d '{
    "filename": "artifact.zip",
    "contentType": "application/zip",
    "size": 104857600,
    "duration": "24h",
    "password": "secret",
    "maxDownloads": 5
  }'`}
            </CodeBlock>
          </div>

          <div className="space-y-3">
            <SubHeading>2. Upload file to returned uploadUrl</SubHeading>
            <CodeBlock label="PUT uploadUrl">
              {`curl -X PUT "$UPLOAD_URL" \\
  -H "Content-Type: application/zip" \\
  --data-binary "@./artifact.zip"`}
            </CodeBlock>
          </div>

          <div className="space-y-3">
            <SubHeading>3. Finalize the upload</SubHeading>
            <CodeBlock label="POST /api/uploads/:id/complete">
              {`curl -X POST "${origin}/api/uploads/$UPLOAD_ID/complete"`}
            </CodeBlock>
          </div>
        </div>

        <p>
          The session creation response includes <code>uploadId</code>, <code>shareId</code>,{" "}
          <code>url</code>, <code>expiresAt</code>, <code>uploadUrl</code>, and any headers required
          for the direct upload request.
        </p>
      </Section>

      <Section id="v1-upload" title="V1 direct upload">
        <p>
          The v1 upload endpoint extends the direct upload flow with OTP delivery mode and
          consistent JSON naming. It is the recommended upload path for new integrations.
        </p>

        <FieldTable
          fields={[
            { name: "filename", type: "string", notes: "Required. Max 255 characters." },
            { name: "size", type: "integer", notes: "Required. File size in bytes (max 2 GiB)." },
            { name: "contentType", type: "string", notes: "Optional. MIME type." },
            {
              name: "deliveryMode",
              type: "string",
              notes:
                "Optional. One of <code>link</code>, <code>password</code>, <code>otp</code>. Defaults to <code>link</code>.",
            },
            {
              name: "password",
              type: "string",
              notes: "Required when deliveryMode is <code>password</code>.",
            },
            {
              name: "expiresInDays",
              type: "integer",
              notes: "Optional. 1-30 days. Defaults to 30.",
            },
            { name: "maxDownloads", type: "integer", notes: "Optional. Positive integer." },
          ]}
        />

        <CodeBlock label="POST /api/public/v1/uploads/init">
          {`curl -X POST ${origin}/api/public/v1/uploads/init \\
  -H "Content-Type: application/json" \\
  -d '{
    "filename": "report.pdf",
    "size": 128044,
    "contentType": "application/pdf",
    "deliveryMode": "password",
    "password": "secret",
    "expiresInDays": 7,
    "maxDownloads": 10
  }'`}
        </CodeBlock>

        <CodeBlock label="Success response">
          {`{
  "id": "uuid-here",
  "slug": "a1c94e2f",
  "deliveryMode": "password",
  "claimCode": null,
  "uploadUrl": "${origin}/api/public/v1/uploads/uuid-here/file",
  "shareUrl": "${origin}/d/a1c94e2f",
  "expiresAt": "2026-07-04T12:00:00.000Z"
}`}
        </CodeBlock>

        <p>
          After creating the session, upload the file to the <code>uploadUrl</code> with
          <code>PUT</code> (same as the original direct upload flow), then finalize with
          <code>POST /api/public/v1/uploads/:id/complete</code>.
        </p>
      </Section>

      <Section id="metadata-download" title="Metadata and download">
        <p>
          Use metadata endpoints when you need to inspect a file before downloading it or render
          your own client-side download experience. Files are served directly from the database.
        </p>

        <div className="space-y-6">
          <div className="space-y-3">
            <SubHeading>GET /api/files/:slug — Metadata</SubHeading>
            <CodeBlock label="GET /api/files/:slug">
              {`curl ${origin}/api/files/a1c94e2f`}
            </CodeBlock>
            <CodeBlock label="Response">
              {`{
  "id": "a1c94e2f",
  "filename": "artifact.zip",
  "size": 10485760,
  "expires": "2026-04-16T14:00:00.000Z",
  "passwordRequired": false,
  "downloads": 0,
  "maxDownloads": null,
  "remainingDownloads": null,
  "expired": false
}`}
            </CodeBlock>
          </div>

          <div className="space-y-3">
            <SubHeading>POST /api/files/:slug — Download</SubHeading>
            <CodeBlock label="POST /api/files/:slug">
              {`curl -X POST ${origin}/api/files/a1c94e2f \\
  -H "Content-Type: application/json" \\
  -d '{"password":"secret"}' \\
  -o artifact.zip`}
            </CodeBlock>
          </div>

          <div className="space-y-3">
            <SubHeading>DELETE /api/files/:slug</SubHeading>
            <CodeBlock label="DELETE /api/files/:slug">
              {`curl -X DELETE -H "Authorization: Bearer $FILESHARE_API_KEY" \\
  ${origin}/api/files/a1c94e2f`}
            </CodeBlock>
          </div>
        </div>

        <p>
          The download endpoint enforces password checks, expiry, and max-download rules before
          streaming the file.
        </p>
      </Section>

      <Section id="v1-drops" title="V1 drops">
        <p>
          The v1 drops endpoint mirrors the original files endpoint but uses consistent snake_case
          JSON naming and supports all delivery modes.
        </p>

        <div className="space-y-6">
          <div className="space-y-3">
            <SubHeading>GET /api/public/v1/drops/:slug — Metadata</SubHeading>
            <CodeBlock label="Response">
              {`{
  "slug": "a1c94e2f",
  "name": "artifact.zip",
  "size": 10485760,
  "contentType": "application/zip",
  "expiresAt": "2026-04-16T14:00:00.000Z",
  "maxDownloads": null,
  "downloadCount": 0,
  "requiresPassword": false,
  "requiresClaim": false
}`}
            </CodeBlock>
          </div>

          <div className="space-y-3">
            <SubHeading>POST /api/public/v1/drops/:slug — Download</SubHeading>
            <CodeBlock label="Download with password">
              {`curl -X POST ${origin}/api/public/v1/drops/a1c94e2f \\
  -H "Content-Type: application/json" \\
  -d '{"password":"secret"}' \\
  -o artifact.zip`}
            </CodeBlock>
          </div>

          <div className="space-y-3">
            <SubHeading>DELETE /api/public/v1/drops/:slug</SubHeading>
            <CodeBlock label="Delete requires auth">
              {`curl -X DELETE -H "Authorization: Bearer $FILESHARE_API_KEY" \\
  ${origin}/api/public/v1/drops/a1c94e2f`}
            </CodeBlock>
          </div>
        </div>
      </Section>

      <Section id="claims" title="Claim codes (OTP)">
        <p>
          Files uploaded with <code>deliveryMode: "otp"</code> require a 4-digit claim code to
          download. The claim code is returned in the init response and can be shared separately
          from the share URL.
        </p>

        <div className="space-y-6">
          <div className="space-y-3">
            <SubHeading>GET /api/public/v1/claims/:code — Claim metadata</SubHeading>
            <CodeBlock label="GET /api/public/v1/claims/1234">
              {`curl ${origin}/api/public/v1/claims/1234`}
            </CodeBlock>
          </div>

          <div className="space-y-3">
            <SubHeading>POST /api/public/v1/claims/:code — Claim and download</SubHeading>
            <CodeBlock label="Claim a file">
              {`curl -X POST ${origin}/api/public/v1/claims/1234 -o artifact.zip`}
            </CodeBlock>
          </div>
        </div>

        <p>
          The claim code is invalidated after the first successful download. Subsequent attempts
          return <code>404</code>. The claim endpoint bypasses password checks — the claim code
          itself is the authentication.
        </p>
      </Section>

      <Section id="me" title="User endpoints">
        <p>Authenticated users can list their drops and manage their account.</p>

        <SubHeading>GET /api/public/v1/me/drops — List your drops</SubHeading>
        <CodeBlock label="List drops">
          {`curl -H "Authorization: Bearer $FILESHARE_API_KEY" \\
  ${origin}/api/public/v1/me/drops`}
        </CodeBlock>
        <CodeBlock label="Response">
          {`{
  "drops": [
    {
      "slug": "a1c94e2f",
      "name": "artifact.zip",
      "size": 10485760,
      "expiresAt": "2026-04-16T14:00:00.000Z",
      "downloads": 3,
      "maxDownloads": null,
      "createdAt": "2026-04-14T12:00:00.000Z",
      "ready": true,
      "shareUrl": "${origin}/d/a1c94e2f"
    }
  ]
}`}
        </CodeBlock>
      </Section>

      <Section id="api-keys" title="API keys">
        <p>
          API keys allow programmatic access to authenticated endpoints. The raw key is only shown
          once on creation — store it securely.
        </p>

        <div className="space-y-6">
          <div className="space-y-3">
            <SubHeading>POST /api/public/v1/me/keys — Create a key</SubHeading>
            <CodeBlock label="Create API key (requires JWT auth)">
              {`curl -X POST ${origin}/api/public/v1/me/keys \\
  -H "Authorization: Bearer <clerk-jwt>" \\
  -H "Content-Type: application/json" \\
  -d '{"name": "ci-cd"}'`}
            </CodeBlock>
            <CodeBlock label="Response">
              {`{
  "key": {
    "id": "uuid",
    "name": "ci-cd",
    "key_prefix": "dlv_aBcDeF",
    "created_at": "2026-04-14T12:00:00.000Z"
  },
  "token": "dlv_aBcDeF123456..."
}`}
            </CodeBlock>
          </div>

          <div className="space-y-3">
            <SubHeading>GET /api/public/v1/me/keys — List keys</SubHeading>
            <CodeBlock label="List API keys">
              {`curl -H "Authorization: Bearer $FILESHARE_API_KEY" \\
  ${origin}/api/public/v1/me/keys`}
            </CodeBlock>
          </div>

          <div className="space-y-3">
            <SubHeading>DELETE /api/public/v1/me/keys/:id — Revoke a key</SubHeading>
            <CodeBlock label="Revoke API key">
              {`curl -X DELETE -H "Authorization: Bearer $FILESHARE_API_KEY" \\
  ${origin}/api/public/v1/me/keys/uuid`}
            </CodeBlock>
          </div>
        </div>
      </Section>

      <Section id="cli-config" title="CLI config">
        <p>
          The CLI fetches its configuration from the API at startup so it stays aligned with the
          live service without requiring updates.
        </p>
        <SubHeading>GET /api/cli/config</SubHeading>
        <CodeBlock label="GET /api/cli/config">{`curl ${origin}/api/cli/config`}</CodeBlock>
        <CodeBlock label="Response">
          {`{
  "maxExpiryDays": 30,
  "maxFileBytes": 2147483648,
  "defaultDuration": "24h",
  "durationOptions": ["1h", "24h", "3d", "7d"],
  "maxRecipients": 0,
  "inlineUpload": true,
  "directUpload": false
}`}
        </CodeBlock>
      </Section>

      <Section id="qr" title="QR code generator">
        <p>
          Generate a QR code PNG for any URL. Useful for sharing download links in physical spaces.
        </p>
        <SubHeading>GET /api/public/v1/qr?url=&lt;url&gt;</SubHeading>
        <CodeBlock label="Generate QR code">
          {`curl -o qr.png "${origin}/api/public/v1/qr?url=https://example.com/d/file"`}
        </CodeBlock>
        <p>Returns a 256x256 PNG image. The response is cached for 1 hour.</p>
      </Section>

      <Section id="errors" title="Errors and status codes">
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
            { status: "429", meaning: "Rate limit exceeded. Check Retry-After header." },
            { status: "500", meaning: "Internal server error." },
          ]}
        />
      </Section>
    </DocsShell>
  );
}
