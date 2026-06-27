import { createFileRoute } from "@tanstack/react-router";
// Vite inlines the script at build time so it's available in the Worker bundle.
import scriptSrc from "../../../cli/sh/fileshare.sh?raw";

export const Route = createFileRoute("/cli/fileshare.sh")({
  server: {
    handlers: {
      GET: async () => {
        return new Response(scriptSrc, {
          headers: {
            "Content-Type": "text/x-shellscript; charset=utf-8",
            "Cache-Control": "public, max-age=300",
          },
        });
      },
    },
  },
});
