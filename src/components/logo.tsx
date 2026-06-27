import * as React from "react";
import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-end gap-1.5", className)}>
      <svg
        width="32"
        height="32"
        viewBox="0 0 22 22"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M2 6a2 2 0 0 1 2-2h3.586a1 1 0 0 1 .707.293L9.707 5.707A1 1 0 0 0 10.414 6H16a2 2 0 0 1 2 2v1.5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-muted-foreground"
        />
        <path
          d="M2 7.5V16a2 2 0 0 0 2 2h5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-muted-foreground"
        />
        <path
          d="M18 11.5a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-5a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h5z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-muted-foreground"
        />
        <path
          d="M13.5 14a.5.5 0 1 0 0-1 .5.5 0 0 0 0 1z"
          fill="currentColor"
          className="text-muted-foreground"
        />
        <path
          d="M6.5 11.5v-3M6.5 8.5l-1.5 1.5M6.5 8.5l1.5 1.5"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-accent"
        />
      </svg>
      <span className="mono text-xl font-bold tracking-tight">fileshare</span>
    </span>
  );
}
