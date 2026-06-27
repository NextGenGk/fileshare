import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/cli/install.sh")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const origin = new URL(request.url).origin;
        const script = `#!/usr/bin/env sh
# FileShare CLI installer
set -eu
BIN_DIR="\${FILESHARE_BIN:-$HOME/.local/bin}"
mkdir -p "$BIN_DIR"
TARGET="$BIN_DIR/fileshare"
echo "→ installing fileshare to $TARGET"
curl -fsSL "${origin}/cli/fileshare.sh" -o "$TARGET"
chmod +x "$TARGET"
echo "✓ installed."
case ":$PATH:" in
  *":$BIN_DIR:"*) ;;
  *) echo "note: add $BIN_DIR to your PATH" ;;
esac
echo
echo "try: fileshare send ./somefile.zip"
`;
        return new Response(script, {
          headers: {
            "Content-Type": "text/x-shellscript; charset=utf-8",
            "Cache-Control": "no-store",
          },
        });
      },
    },
  },
});
