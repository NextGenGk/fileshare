# fileshare CLI

Minimal Node.js CLI for the [FileShare](https://fileshare.devgaurav.online) file transfer service.

## Install

```sh
npm install -g fileshare
```

## Quick start

```sh
# Upload a file (anonymous — expires in 5 minutes)
fileshare send ./photo.jpg

# Upload with your API key (signed-in — custom expiry)
fileshare send ./photo.jpg --token dlv_... --duration 7d

# Download a file
fileshare get <slug>

# Download with password protection
fileshare get <slug> --password mysecret --out ./saved.jpg
```

## Usage

```
fileshare --file <path> [options]

Commands:
  fileshare send <file>   Upload a file and print the share URL
  fileshare get  <slug>   Download a file by slug or share URL
  fileshare list          List your drops             (requires API key)
  fileshare rm   <slug>   Delete a drop               (requires API key)
  fileshare login         Save your API key locally
  fileshare config        Manage configuration

Flags:
  --file <path>          File to upload
  --duration <str>       Expiry: 1h, 24h, 3d, 7d     (default: 24h, signed-in only)
  --expires-at <iso>     Fixed expiry date (ISO 8601)
  --password <str>       Protect with a password
  --max-downloads <num>  Limit number of downloads
  --json                 JSON output
  --token <key>          API key (or FILESHARE_API_KEY env var)
  --out <path>           Output path for downloads

Environment variables:
  FILESHARE_API_URL   Base URL of the server (default: https://fileshare.devgaurav.online)
  FILESHARE_API_KEY   Personal API key (get one from the dashboard)
```

## Storage model

- **File data** is stored in [Vercel Blob](https://vercel.com/storage/blob) — no raw bytes in the database.
- **Metadata** (name, size, expiry, download count) is stored in PostgreSQL (Neon).

## Expiry rules

| User type | Default expiry |
|-----------|----------------|
| Guest (no API key) | **5 minutes** — enforced server-side, cannot be changed |
| Signed-in (API key or Clerk) | 24h default; customisable up to 30 days |

## API key

Generate one from the dashboard at [fileshare.devgaurav.online](https://fileshare.devgaurav.online) → Settings → API Keys.

## License

MIT
