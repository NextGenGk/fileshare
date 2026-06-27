# FileShare

Temporary file sharing made simple. Upload files up to 2 GiB, get a short share link, set expiry dates, passwords, and download limits — no account required.

## Quick Start

```bash
# Upload a file (web)
open https://fileshare.devgaurav.online

# Upload a file (API)
curl -X POST https://fileshare.devgaurav.online/api/upload -F "file=@./report.pdf" -F "duration=24h"

# Download
curl -X POST https://fileshare.devgaurav.online/d/a1c94e2f -o report.pdf
```

## Features

- **No account required** for basic uploads and downloads
- **Up to 2 GiB** per file
- **Expiry controls**: 1h, 24h, 3d, 7d, or custom date up to 30 days
- **Password protection** with SHA-256 hashing
- **Download limits** with automatic enforcement
- **Claim codes** (OTP) for one-time access
- **QR code generation** for any URL
- **Authentication** via Clerk (Google, GitHub, email) or API keys
- **CLI tools**: Node.js (`@fileshare/cli`) and POSIX shell script
- **Rate limiting**: per-IP and per-key with sliding windows

## Architecture

```
┌─────────────┐     ┌──────────────────┐     ┌──────────────┐
│  Browser     │────▶│  Cloudflare      │────▶│  Neon        │
│  (React SPA) │     │  Workers         │     │  PostgreSQL  │
│              │     │  (Nitro SSR)     │     │  (files +    │
│  CLI/curl    │────▶│                  │     │   metadata)  │
└─────────────┘     └──────────────────┘     └──────────────┘
```

- **Frontend**: React 19 + TanStack Start (SSR) + Tailwind CSS v4 + shadcn/ui
- **API**: TanStack Router server handlers (Nitro/h3 under the hood)
- **Database**: PostgreSQL via Neon + Prisma ORM
- **Auth**: Clerk (web) + API keys (`dlv_` prefix)
- **Storage**: Files stored in PostgreSQL BYTEA columns
- **Rate Limiting**: In-memory sliding window counters (per-isolate)
- **CLI**: Node.js (npm) + POSIX shell script

## Environment Variables

| Variable                     | Required | Description                       |
| ---------------------------- | -------- | --------------------------------- |
| `DATABASE_URL`               | Yes      | Neon PostgreSQL connection string |
| `CLERK_SECRET_KEY`           | Yes      | Clerk API secret key              |
| `VITE_CLERK_PUBLISHABLE_KEY` | Yes      | Clerk publishable key (frontend)  |

## API

### Base URL

All API endpoints are served from your deployment URL.

### Authentication

Two methods supported via the `Authorization` header:

**API Key** (machine-to-machine):

```
Authorization: Bearer dlv_abc123...
```

**Clerk JWT** (user sessions):

```
Authorization: Bearer <clerk-session-token>
```

Unauthenticated requests can still upload and download files.

### Endpoints

| Method   | Path                                  | Auth     | Description                           |
| -------- | ------------------------------------- | -------- | ------------------------------------- |
| `POST`   | `/api/upload`                         | No       | Inline multipart upload (small files) |
| `POST`   | `/api/uploads`                        | No       | Create direct upload session          |
| `PUT`    | `/api/uploads/:id/file`               | No       | Upload file body                      |
| `POST`   | `/api/uploads/:id/complete`           | Optional | Finalize upload                       |
| `GET`    | `/api/files/:slug`                    | No       | File metadata                         |
| `POST`   | `/api/files/:slug`                    | No       | Download file                         |
| `DELETE` | `/api/files/:slug`                    | Yes      | Delete file                           |
| `POST`   | `/api/public/v1/uploads/init`         | No       | V1 init upload                        |
| `PUT`    | `/api/public/v1/uploads/:id/file`     | No       | V1 upload file body                   |
| `POST`   | `/api/public/v1/uploads/:id/complete` | Optional | V1 finalize                           |
| `GET`    | `/api/public/v1/drops/:slug`          | No       | V1 metadata                           |
| `POST`   | `/api/public/v1/drops/:slug`          | No       | V1 download                           |
| `DELETE` | `/api/public/v1/drops/:slug`          | Yes      | V1 delete                             |
| `GET`    | `/api/public/v1/claims/:code`         | No       | Claim metadata                        |
| `POST`   | `/api/public/v1/claims/:code`         | No       | Claim download                        |
| `GET`    | `/api/public/v1/me/drops`             | Yes      | List user drops                       |
| `GET`    | `/api/public/v1/me/keys`              | Yes      | List API keys                         |
| `POST`   | `/api/public/v1/me/keys`              | Yes      | Create API key                        |
| `DELETE` | `/api/public/v1/me/keys/:id`          | Yes      | Revoke API key                        |
| `GET`    | `/api/public/v1/qr`                   | No       | Generate QR code                      |
| `GET`    | `/api/cli/config`                     | No       | CLI configuration                     |
| `POST`   | `/api/public/cron/cleanup`            | No       | Cleanup expired files                 |

### Rate Limiting

Rate limits are enforced per sliding window. Limits vary by authentication tier and action type.

| Tier          | Upload | Download | Metadata | Management | Config  |
| ------------- | ------ | -------- | -------- | ---------- | ------- |
| Anonymous     | 5/min  | 20/min   | 30/min   | 10/min     | 60/min  |
| API Key       | 60/min | 200/min  | 300/min  | 100/min    | 600/min |
| Authenticated | 60/min | 200/min  | 300/min  | 100/min    | 600/min |

Rate limit headers are returned on every response:

- `X-RateLimit-Limit` — max requests per window
- `X-RateLimit-Remaining` — remaining requests in current window
- `X-RateLimit-Reset` — unix timestamp when the window resets

When exceeded, the API returns `429 Too Many Requests` with `Retry-After` header.

### Status Codes

| Code | Meaning                                              |
| ---- | ---------------------------------------------------- |
| 200  | Success                                              |
| 400  | Bad request (missing file, bad JSON, invalid params) |
| 401  | Password required/incorrect, or auth required        |
| 403  | Forbidden (not your resource)                        |
| 404  | Not found                                            |
| 409  | Upload incomplete or limit reached                   |
| 410  | Expired or downloads exhausted                       |
| 413  | File too large                                       |
| 415  | Upload blocked by media policy                       |
| 429  | Rate limited                                         |
| 500  | Server error                                         |
| 503  | Feature not configured                               |

## CLI

### Node.js CLI

```bash
npm install -g @fileshare/cli
fileshare --file ./artifact.zip --duration 24h
```

### Shell CLI

```bash
curl -fsSL https://fileshare.devgaurav.online/cli/install.sh | sh
fileshare send ./artifact.zip
```

## Deployment

### Cloudflare Workers (recommended)

1. Configure `wrangler.toml` with your KV namespace and account details
2. Set environment variables via `wrangler secret put`
3. Run `npm run build`
4. Deploy with `npx wrangler deploy`

### Prerequisites

- Node.js 18+
- PostgreSQL database (Neon recommended)
- Clerk account for authentication
- Cloudflare account (for Workers deployment)

## Development

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build

# Lint
npm run lint

# Format
npm run format
```

## License

MIT
