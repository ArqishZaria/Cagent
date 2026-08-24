import { useEffect, useRef, useState } from "react";
import { MessageCircle, Paperclip, Send, X } from "lucide-react";
import api from "../lib/api";

/**
 * SupportChatWidget
 *
 * mode="floating" (default): renders a launcher button bottom-right that
 *   expands into a chat panel — used in Company Settings.
 * mode="embedded": renders the chat panel inline with no launcher — used
 *   inside the full-screen Payment Overdue Overlay, where support is the
 *   ONLY thing a locked-out tenant can still reach (core.middleware
 *   .IsSubscriptionActive whitelists /api/support/).
 *
 * Talks to GET /api/support/history/ and POST /api/support/send/.
 */
export default function SupportChatWidget({ mode = "floating" }) {
  const [open, setOpen] = useState(mode === "embedded");
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    api
      .get("/api/support/history/")
      .then((res) => {
        if (!cancelled) setMessages(res.data?.results || res.data || []);
      })
      .catch(() => {
        /* support history not loading shouldn't block the rest of the UI */
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    const optimistic = {
      id: `local-${Date.now()}`,
      message: text,
      is_from_platform_owner: false,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    try {
      await api.post("/api/support/send/", { message: text });
    } catch {
      // leave the optimistic message; a real app would flag it as failed to send
    }
  };

  const panel = (
    <div
      className={
        mode === "embedded"
          ? "flex flex-col h-full"
          : "flex flex-col w-[360px] h-[480px] card-raised overflow-hidden animate-fade-up"
      }
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-ink-500/60 bg-ink-600/50">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-live opacity-60" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-live" />
          </span>
          <h3 className="text-sm font-display font-semibold">Support</h3>
        </div>
        {mode === "floating" && (
          <button
            onClick={() => setOpen(false)}
            className="text-ink-200 hover:text-white transition"
            aria-label="Close support chat"
          >
            <X size={16} />
          </button>
        )}
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {loading && <p className="text-xs text-ink-300 font-mono">Loading conversation…</p>}
        {!loading && messages.length === 0 && (
          <p className="text-xs text-ink-300">
            Send us a message — a real human on the platform team will reply here.
          </p>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            className={`max-w-[85%] rounded-xl px-3 py-2 text-sm leading-relaxed ${
              m.is_from_platform_owner
                ? "bg-ink-600 text-ink-50 self-start mr-auto"
                : "bg-signal text-white ml-auto"
            }`}
          >
            {m.message}
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 px-3 py-3 border-t border-ink-500/60 bg-ink-600/30">
        <button
          type="button"
          className="text-ink-300 hover:text-white transition p-1.5"
          title="Attach a payment receipt"
        >
          <Paperclip size={16} />
        </button>
        <input
          className="input-field flex-1 !py-2 !text-sm"
          placeholder="Type a message…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
        />
        <button onClick={send} className="btn-primary !p-2.5" aria-label="Send message">
          <Send size={15} />
        </button>
      </div>
    </div>
  );

  if (mode === "embedded") return panel;

  return (
    <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-3">
      {open && panel}
      <button
        onClick={() => setOpen((v) => !v)}
        className="btn-primary !rounded-full !p-4 shadow-raised-lg"
        aria-label="Toggle support chat"
      >
        <MessageCircle size={20} />
      </button>
    </div>
  );
}
