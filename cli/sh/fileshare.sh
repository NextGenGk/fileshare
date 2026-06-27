#!/usr/bin/env sh
# fileshare — minimal shell CLI for the FileShare file sharing service.
# Usage:
#   fileshare send <file> [--duration 24h] [--max-downloads N] [--password X]
#   fileshare get  <slug|url> [--password X] [--out PATH]
#   fileshare rm   <slug>            (requires FILESHARE_API_KEY)
#
# Env:
#   FILESHARE_API_URL   default: http://localhost:8080
#   FILESHARE_API_KEY   personal API key (for auth-required ops)

set -eu

API_URL="${FILESHARE_API_URL:-http://localhost:8080}"
API_KEY="${FILESHARE_API_KEY:-}"

have() { command -v "$1" >/dev/null 2>&1; }

need() {
  for cmd in curl; do
    have "$cmd" || { echo "fileshare: missing dependency: $cmd" >&2; exit 1; }
  done
}

pyjson() {
  # tiny JSON extractor: $1 = key  (reads json from stdin)
  if have jq; then jq -r --arg k "$1" '.[$k] // empty'
  elif have python3; then python3 -c "import sys,json;d=json.load(sys.stdin);print(d.get('$1',''))"
  else
    sed -n "s/.*\"$1\"[[:space:]]*:[[:space:]]*\"\\([^\"]*\\)\".*/\\1/p" | head -n1
  fi
}

auth_header() {
  [ -n "$API_KEY" ] && printf 'Authorization: Bearer %s' "$API_KEY"
}

cmd_send() {
  FILE="${1:-}"; shift || true
  [ -n "$FILE" ] || { echo "usage: fileshare send <file> [--duration 24h] [--max-downloads N] [--password X]" >&2; exit 2; }
  [ -f "$FILE" ] || { echo "fileshare: file not found: $FILE" >&2; exit 1; }

  DURATION="24h"; MAX_DL=""; PASSWORD=""
  while [ $# -gt 0 ]; do
    case "$1" in
      --duration) DURATION="$2"; shift 2 ;;
      --expires-at) EXPIRES_AT="$2"; shift 2 ;;
      --max-downloads) MAX_DL="$2"; shift 2 ;;
      --password) PASSWORD="$2"; shift 2 ;;
      *) echo "unknown flag: $1" >&2; exit 2 ;;
    esac
  done

  NAME=$(basename "$FILE")
  SIZE=$(wc -c <"$FILE" | tr -d ' ')

  AUTH=""
  [ -n "$API_KEY" ] && AUTH="-H \"Authorization: Bearer $API_KEY\""

  echo "→ uploading $NAME" >&2

  # Use inline upload
  RESP=$(eval curl -fsS -X POST \
    -F "'file=@$FILE'" \
    -F "'duration=$DURATION'" \
    ${MAX_DL:+-F "'maxDownloads=$MAX_DL'"} \
    ${PASSWORD:+-F "'password=$PASSWORD'"} \
    $AUTH \
    "$API_URL/api/upload")

  URL=$(printf '%s' "$RESP" | pyjson url)
  echo "${URL:-$RESP}"
}

cmd_get() {
  TARGET="${1:-}"; shift || true
  [ -n "$TARGET" ] || { echo "usage: fileshare get <slug|url> [--password X] [--out PATH]" >&2; exit 2; }
  case "$TARGET" in
    http*://*) SLUG=$(printf '%s' "$TARGET" | sed -E 's|.*/d/([^/?#]+).*|\1|') ;;
    *) SLUG="$TARGET" ;;
  esac
  PASSWORD=""; OUT=""
  while [ $# -gt 0 ]; do
    case "$1" in
      --password) PASSWORD="$2"; shift 2 ;;
      --out) OUT="$2"; shift 2 ;;
      *) echo "unknown flag: $1" >&2; exit 2 ;;
    esac
  done

  # Get metadata first to know the filename
  META=$(curl -fsS "$API_URL/api/files/$SLUG")
  NAME=$(printf '%s' "$META" | pyjson filename)
  [ -n "$NAME" ] || { echo "fileshare: not found: $SLUG" >&2; exit 1; }

  OUT="${OUT:-$NAME}"
  BODY='{}'
  [ -n "$PASSWORD" ] && BODY=$(printf '{"password":"%s"}' "$PASSWORD")

  echo "→ downloading $NAME → $OUT" >&2
  curl -fSL --progress-bar -X POST -H "Content-Type: application/json" \
    --data "$BODY" "$API_URL/api/files/$SLUG/download" \
    -o "$OUT"
  echo "$OUT"
}

cmd_rm() {
  SLUG="${1:-}"
  [ -n "$SLUG" ] || { echo "usage: fileshare rm <slug>" >&2; exit 2; }
  [ -n "$API_KEY" ] || { echo "fileshare: FILESHARE_API_KEY required" >&2; exit 1; }
  curl -fsS -X DELETE -H "Authorization: Bearer $API_KEY" \
    "$API_URL/api/files/$SLUG" 2>/dev/null || \
  curl -fsS -X DELETE -H "Authorization: Bearer $API_KEY" \
    "$API_URL/api/public/v1/drops/$SLUG" >/dev/null
  echo "deleted: $SLUG"
}

main() {
  need
  CMD="${1:-}"; shift || true
  case "$CMD" in
    send) cmd_send "$@" ;;
    get|download) cmd_get "$@" ;;
    rm|delete) cmd_rm "$@" ;;
    ""|-h|--help|help)
      cat <<EOF
fileshare — file sharing CLI

  fileshare send <file> [--duration 24h] [--max-downloads N] [--password X]
  fileshare get  <slug|url> [--password X] [--out PATH]
  fileshare rm   <slug>   (needs FILESHARE_API_KEY)

Flags:
  --duration <str>       Expiry: 1h, 24h, 3d, 7d  (default: 24h)
  --expires-at <iso>     Fixed expiry date (ISO 8601)
  --password <str>       Protect with password
  --max-downloads <num>  Limit downloads

Env:
  FILESHARE_API_URL   default: $API_URL
  FILESHARE_API_KEY   personal API key
EOF
      ;;
    *) echo "unknown command: $CMD" >&2; exit 2 ;;
  esac
}

main "$@"
