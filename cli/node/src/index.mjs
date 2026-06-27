#!/usr/bin/env node
// fileshare — CLI for the FileShare file sharing service.
// Usage:
//   fileshare --file ./path [--duration 24h] [--email x@y] [--json]
//   fileshare send <file>   (legacy)
//   fileshare get  <slug>
//   fileshare login
//   fileshare config set api-url <url>
import {
  createReadStream,
  statSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  existsSync,
} from "node:fs";
import { basename, join, dirname } from "node:path";
import { homedir, tmpdir } from "node:os";
import { execSync } from "node:child_process";
import { createInterface } from "node:readline/promises";

const DEFAULT_API = "http://localhost:8080";
const CONFIG_DIR = join(process.env.XDG_CONFIG_HOME || join(homedir(), ".config"), "fileshare");
const CONFIG_PATH = join(CONFIG_DIR, "config.json");

function loadConfig() {
  if (!existsSync(CONFIG_PATH)) return {};
  try {
    return JSON.parse(readFileSync(CONFIG_PATH, "utf8"));
  } catch {
    return {};
  }
}
function saveConfig(cfg) {
  mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2));
}

const cfg = loadConfig();
const API = process.env.FILESHARE_API_URL || cfg.apiUrl || DEFAULT_API;
const TOKEN_DEFAULT = process.env.FILESHARE_API_KEY || cfg.apiKey || "";

const DURATION_OPTIONS = ["1h", "24h", "3d", "7d"];

function fmtBytes(n) {
  if (n < 1024) return `${n} B`;
  const u = ["KB", "MB", "GB", "TB"];
  let i = -1;
  let v = n;
  do {
    v /= 1024;
    i++;
  } while (v >= 1024 && i < u.length - 1);
  return `${v.toFixed(1)} ${u[i]}`;
}

async function api(path, { method = "GET", body, token, headers = {} } = {}) {
  const t = token ?? TOKEN_DEFAULT;
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      ...(body && typeof body === "object" && !(body instanceof FormData)
        ? { "Content-Type": "application/json" }
        : {}),
      ...(t ? { Authorization: `Bearer ${t}` } : {}),
      ...headers,
    },
    body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { error: text };
  }
  if (!res.ok) {
    const msg = json.error || res.statusText;
    throw new Error(`${msg}${json.message ? ` — ${json.message}` : ""}`);
  }
  return json;
}

function getFlag(flags, names) {
  for (const n of names) {
    if (flags[n] !== undefined) return flags[n];
  }
  return undefined;
}

function hasAnyFlag(flags, names) {
  return names.some((n) => flags[n] !== undefined);
}

function parseFlags(args) {
  const flags = {};
  const positional = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const eqIdx = key.indexOf("=");
      if (eqIdx !== -1) {
        flags[key.slice(0, eqIdx)] = key.slice(eqIdx + 1);
      } else if (i + 1 < args.length && !args[i + 1].startsWith("--")) {
        flags[key] = args[++i];
      } else {
        flags[key] = "true";
      }
    } else {
      positional.push(a);
    }
  }
  return { flags, positional };
}

// ── File upload ──────────────────────────────────────────

async function uploadFile(filePath, options) {
  if (!existsSync(filePath)) {
    throw new Error(`file not found: ${filePath}`);
  }
  let stat = statSync(filePath);
  let name = basename(filePath);

  if (stat.isDirectory()) {
    process.stderr.write(`\u2192 bundling folder ${name}...\n`);
    const tarName = `${name}.tar.gz`;
    const tempTar = join(tmpdir(), tarName);
    // Use system tar which is built into Mac, Linux, and Windows 10+
    execSync(`tar -czf "${tempTar}" -C "${dirname(filePath)}" "${basename(filePath)}"`);
    filePath = tempTar;
    stat = statSync(filePath);
    name = tarName;
  }
  const contentType = "application/octet-stream";

  const duration = options.duration || (options["expires-at"] ? undefined : "24h");
  const expiresAt = options["expires-at"];

  process.stderr.write(`\u2192 ${name} (${fmtBytes(stat.size)})\n`);

  // Use inline upload for smaller files, direct upload for larger ones
  const THRESHOLD = 50 * 1024 * 1024; // 50 MB

  if (stat.size < THRESHOLD) {
    // Inline: POST /api/upload (multipart)
    const form = new FormData();
    const fileBlob = new Blob([readFileSync(filePath)]);
    form.set("file", fileBlob, name);
    if (duration) form.set("duration", duration);
    if (expiresAt) form.set("expiresAt", expiresAt);
    if (options.password) form.set("password", options.password);
    if (options["max-downloads"]) form.set("maxDownloads", options["max-downloads"]);

    const result = await api("/api/upload", {
      method: "POST",
      token: options.token,
      body: form,
      headers: {}, // let fetch set Content-Type for multipart
    });
    return result;
  }

  // Direct upload: session → PUT → complete
  const init = await api("/api/uploads", {
    method: "POST",
    token: options.token,
    body: {
      filename: name,
      size: stat.size,
      contentType,
      duration: duration || undefined,
      expiresAt: expiresAt || undefined,
      password: options.password,
      maxDownloads: options["max-downloads"] ? Number(options["max-downloads"]) : undefined,
    },
  });

  process.stderr.write("\u2192 uploading\u2026\n");
  const stream = createReadStream(filePath);
  const putRes = await fetch(init.uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": contentType, "Content-Length": String(stat.size) },
    body: stream,
    duplex: "half",
  });
  if (!putRes.ok) {
    const errText = await putRes.text().catch(() => "");
    throw new Error(`upload failed: ${putRes.status} ${errText}`);
  }

  const done = await api(`/api/uploads/${init.uploadId}/complete`, {
    method: "POST",
    token: options.token,
  });

  return { id: done.slug, url: done.shareUrl, size: stat.size, filename: name };
}

// ── Commands ─────────────────────────────────────────────

async function cmdSend(args) {
  const { flags, positional } = parseFlags(args);
  const file = getFlag(flags, ["file"]) || positional[0];
  if (!file) {
    throw new Error(
      "usage: fileshare send <file|folder> [--duration 24h] [--expires-at ISO] [--password X] [--max-downloads N] [--email X]",
    );
  }

  const result = await uploadFile(file, { ...flags, token: flags.token });
  if (flags.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(result.url || result.shareUrl);
  }
}

async function cmdGet(args) {
  const { flags, positional } = parseFlags(args);
  const target = getFlag(flags, ["url", "slug"]) || positional[0];
  if (!target) {
    throw new Error("usage: fileshare get <slug|url> [--password X] [--out PATH]");
  }
  const slug = target.includes("/") ? target.replace(/.*\/d\//, "").split(/[?#]/)[0] : target;
  const meta = await api(`/api/files/${slug}`, { method: "GET" });
  const out = flags.out || meta.filename;
  process.stderr.write(`\u2192 ${meta.filename} \u2192 ${out}\n`);

  // Get the download URL (POST returns {url: blobUrl})
  const dlJson = await api(`/api/files/${slug}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: flags.password ? { password: flags.password } : {},
  });

  if (!dlJson.url) throw new Error("server returned no download URL");

  // Stream the file from Vercel Blob directly
  const blobRes = await fetch(dlJson.url);
  if (!blobRes.ok || !blobRes.body) {
    throw new Error(`blob fetch failed: ${blobRes.status}`);
  }

  mkdirSync(dirname(out) || ".", { recursive: true });
  const { createWriteStream } = await import("node:fs");
  const { pipeline } = await import("node:stream/promises");
  const { Readable } = await import("node:stream");
  const ws = createWriteStream(out);
  await pipeline(Readable.fromWeb(blobRes.body), ws);
  console.log(out);
}

async function cmdList(args) {
  const { flags } = parseFlags(args);
  const data = await api("/api/public/v1/me/drops", { token: flags.token });
  if (!data.drops?.length) {
    console.log("(no drops)");
    return;
  }
  for (const d of data.drops) {
    console.log(`${d.slug}\t${fmtBytes(d.size)}\t${d.downloads}\u2193\t${d.name}\t${d.shareUrl}`);
  }
}

async function cmdRm(args) {
  const { flags, positional } = parseFlags(args);
  const slug = getFlag(flags, ["slug"]) || positional[0];
  if (!slug) {
    throw new Error("usage: fileshare rm <slug>");
  }
  await api(`/api/files/${slug}`, { method: "DELETE", token: flags.token }).catch(() =>
    api(`/api/public/v1/drops/${slug}`, { method: "DELETE", token: flags.token }),
  );
  console.log(`deleted: ${slug}`);
}

async function cmdLogin() {
  const rl = createInterface({ input: process.stdin, output: process.stderr });
  const token = (await rl.question("paste your API key (dlv_\u2026): ")).trim();
  rl.close();
  if (!token.startsWith("dlv_")) {
    throw new Error("not a valid fileshare API key");
  }
  saveConfig({ ...cfg, apiKey: token });
  console.log(`saved to ${CONFIG_PATH}`);
}

function cmdConfig(args) {
  const [verb, key, value] = args;
  if (verb === "set" && key === "api-url" && value) {
    saveConfig({ ...cfg, apiUrl: value });
    console.log(`api-url = ${value}`);
    return;
  }
  if (verb === "show") {
    console.log(
      JSON.stringify({ apiUrl: API, hasToken: !!TOKEN_DEFAULT, path: CONFIG_PATH }, null, 2),
    );
    return;
  }
  throw new Error("usage: fileshare config set api-url <url> | fileshare config show");
}

// ── Interactive mode ─────────────────────────────────────

async function interactiveMode() {
  const rl = createInterface({ input: process.stdin, output: process.stderr });

  const file = (await rl.question("file path: ")).trim();
  if (!file || !existsSync(file)) {
    console.error("file not found");
    rl.close();
    process.exit(1);
  }

  const stat = statSync(file);
  const name = basename(file);
  process.stderr.write(`\u2192 ${name} (${fmtBytes(stat.size)})\n`);

  const duration = (await rl.question("duration (1h/24h/3d/7d) [24h]: ")).trim() || "24h";
  const pw = (await rl.question("password (optional): ")).trim();
  const maxDl = (await rl.question("max downloads (optional): ")).trim();

  rl.close();

  const result = await uploadFile(file, {
    duration: DURATION_OPTIONS.includes(duration) ? duration : "24h",
    password: pw || undefined,
    "max-downloads": maxDl || undefined,
  });

  console.log(`\nShare URL: ${result.url || result.shareUrl}`);
  if (flags.json) {
    console.log(JSON.stringify(result, null, 2));
  }
}

// ── Main ─────────────────────────────────────────────────

function help() {
  console.log(`fileshare — file sharing CLI

Usage:
  fileshare --file <path> [--duration 24h] [--expires-at ISO] [--password X]
                        [--max-downloads N] [--email X] [--json]

Commands:
  fileshare send <file|folder> Upload a file or folder
  fileshare get  <slug>        Download a file
  fileshare list               List your drops          (requires API key)
  fileshare rm   <slug>        Delete a drop            (requires API key)
  fileshare login              Save API key
  fileshare config             Manage configuration

Flags:
  --file <path>          File or folder to upload
  --duration <str>       Expiry: 1h, 24h, 3d, 7d  (default: 24h)
  --expires-at <iso>     Fixed expiry date (ISO 8601)
  --password <str>       Protect with password
  --max-downloads <num>  Limit downloads
  --email <addr>         Notification email (repeatable)
  --json                 JSON output
  --token <key>          API key (or FILESHARE_API_KEY env)
  --yes                  Skip prompts (CI mode)

Environment:
  FILESHARE_API_URL   (default ${DEFAULT_API})
  FILESHARE_API_KEY   personal API token
`);
}

const [, , ...all] = process.argv;

// Detect flat mode: --file or no args (interactive)
const isFlat = all.some((a) => a.startsWith("--file") || a === "--file");
const noArgs = all.length === 0 || all[0] === "--help" || all[0] === "-h";

try {
  if (noArgs) {
    help();
  } else if (isFlat) {
    const { flags } = parseFlags(all);
    const file = getFlag(flags, ["file"]);
    if (!file) {
      help();
      process.exit(2);
    }
    const result = await uploadFile(file, flags);
    if (flags.json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(result.url || result.shareUrl);
    }
  } else {
    const [cmd, ...rest] = all;
    switch (cmd) {
      case "send":
      case "upload":
        await cmdSend(rest);
        break;
      case "get":
      case "download":
        await cmdGet(rest);
        break;
      case "list":
      case "ls":
        await cmdList(rest);
        break;
      case "rm":
      case "delete":
        await cmdRm(rest);
        break;
      case "login":
        await cmdLogin();
        break;
      case "config":
        cmdConfig(rest);
        break;
      default:
        // Treat as flat mode with the first arg as the file
        const { flags } = parseFlags(all);
        const file = flags.file || all[0];
        if (file && existsSync(file)) {
          const result = await uploadFile(file, flags);
          if (flags.json) {
            console.log(JSON.stringify(result, null, 2));
          } else {
            console.log(result.url || result.shareUrl);
          }
        } else {
          console.error(`unknown command: ${cmd}`);
          help();
          process.exit(2);
        }
    }
  }
} catch (e) {
  console.error(`fileshare: ${e.message || e}`);
  process.exit(1);
}
