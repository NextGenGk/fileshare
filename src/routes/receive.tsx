import { createFileRoute } from "@tanstack/react-router";
import { ReceiveForm } from "@/components/receive-form";

export const Route = createFileRoute("/receive")({
  head: () => ({ 
    meta: [
      { title: "Receive a file — FileShare" },
      { name: "description", content: "Enter your claim code to securely receive a file." }
    ] 
  }),
  component: ReceivePage,
});

function ReceivePage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-16">
      <ReceiveForm />
    </div>
  );
}
