import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router";
import { supabase } from "@/lib/supabase";
import { useAskMunshee } from "../hooks";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { EmptyState } from "@/components/EmptyState";
import { PlanGatingError } from "@/components/PlanGatingError";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

export function AskPage() {
  const navigate = useNavigate();
  const ask = useAskMunshee();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [gatingError, setGatingError] = useState<{ mode: "actions_exhausted" | "feature_cap"; feature?: string } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user.id) {
        setTenantId(data.session.user.id);
      } else {
        navigate("/login");
      }
    });
  }, [navigate]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function onSend() {
    const question = input.trim();
    if (!question || !tenantId) return;
    setInput("");
    setError(null);

    const userMessage: Message = {
      role: "user",
      content: question,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMessage]);

    try {
      const response = await ask.mutateAsync({
        tenantId,
        question,
      });
      const assistantMessage: Message = {
        role: "assistant",
        content: response.answer,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err: unknown) {
      const maybeErr = err as { status?: number; body?: { code?: string; feature?: string; actionsLeft?: number; actionsMonthly?: number } };
      if (maybeErr?.status === 402 && maybeErr?.body?.code) {
        setGatingError({
          mode: maybeErr.body.code === "FEATURE_CAP" ? "feature_cap" : "actions_exhausted",
          feature: maybeErr.body.feature,
        });
      } else {
        setError(err instanceof Error ? err.message : "Something went wrong");
      }
    }
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      <div className="mb-4">
        <h1 className="text-2xl font-semibold text-ink">Ask Munshee</h1>
        <p className="text-sm text-ink-muted">
          Ask questions about your business. I'll only answer using your verified facts.
        </p>
      </div>

      {error && <p className="mb-4 text-sm text-danger">{error}</p>}

      <Card className="mb-4 flex-1 overflow-y-auto p-4">
        {messages.length === 0 && (
          <EmptyState
            title="No messages yet"
            description="Ask a question about your business to get started."
          />
        )}
        <div className="space-y-4">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] rounded-lg px-4 py-2 ${
                  msg.role === "user"
                    ? "bg-brand-600 text-white"
                    : "bg-gray-100 text-ink"
                }`}
              >
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                <p
                  className={`mt-1 text-xs ${
                    msg.role === "user" ? "text-brand-100" : "text-ink-muted"
                  }`}
                >
                  {new Date(msg.timestamp).toLocaleTimeString()}
                </p>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </Card>

      <div className="flex gap-2">
        <Input
          label="Your question"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSend();
            }
          }}
          placeholder="Ask about your business..."
          disabled={ask.isPending}
        />
        <Button onClick={onSend} disabled={!input.trim() || ask.isPending}>
          {ask.isPending ? "Asking…" : "Send"}
        </Button>
      </div>
      {gatingError && (
        <PlanGatingError
          open={!!gatingError}
          onClose={() => setGatingError(null)}
          mode={gatingError.mode}
          feature={gatingError.feature}
        />
      )}
    </div>
  );
}

