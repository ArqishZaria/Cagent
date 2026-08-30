import { useEffect, useRef, useState } from "react";
import { MessageCircle, Paperclip, Send, X } from "lucide-react";
import api from "../lib/api";

/**
 * SupportChatWidget
 *
 * mode="floating" (default): renders a launcher button bottom-right that
 *   expands into a chat panel.
 * mode="embedded": renders the chat panel inline with no launcher — used
 *   inside the full-screen Payment Overdue Overlay, where support is the
 *   ONLY thing a locked-out tenant can still reach.
 *
 * Attachment support: clicking the paperclip opens a file picker; the
 * selected file rides along with the next message sent, as multipart form
 * data. Historical attachments come back as an authenticated URL
 * (attachment_url) that a plain <img> can't load (no way to attach an
 * Authorization header to an <img> tag), so each real attachment is
 * fetched once via an authenticated blob request and cached locally.
 */
export default function SupportChatWidget({ mode = "floating" }) {
  const [open, setOpen] = useState(mode === "embedded");
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [pendingFile, setPendingFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [attachmentBlobs, setAttachmentBlobs] = useState({});
  const scrollRef = useRef(null);
  const fileInputRef = useRef(null);

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

  // Fetch each real (server-side) attachment exactly once as an
  // authenticated blob, since attachment_url requires a Bearer token an
  // <img src> can't send on its own.
  useEffect(() => {
    messages.forEach((m) => {
      const isLocal = String(m.id).startsWith("local-");
      if (m.attachment_url && !isLocal && !attachmentBlobs[m.id]) {
        api
          .get(m.attachment_url, { responseType: "blob" })
          .then((res) => {
            const url = URL.createObjectURL(res.data);
            setAttachmentBlobs((prev) => ({ ...prev, [m.id]: url }));
          })
          .catch(() => {
            /* attachment fetch failure shouldn't block the rest of the thread */
          });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) setPendingFile(file);
    e.target.value = ""; // lets the same file be picked again later if removed
  };

  const send = async () => {
    const text = draft.trim();
    if (!text && !pendingFile) return;

    const fileToSend = pendingFile;
    setDraft("");
    setPendingFile(null);

    const optimistic = {
      id: `local-${Date.now()}`,
      message: text,
      attachment_url: fileToSend ? URL.createObjectURL(fileToSend) : null,
      is_from_platform_owner: false,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);

    try {
      if (fileToSend) {
        const formData = new FormData();
        formData.append("message", text);
        formData.append("attachment", fileToSend);
        const res = await api.post("/api/support/send/", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        setMessages((prev) => prev.map((m) => (m.id === optimistic.id ? res.data : m)));
      } else {
        await api.post("/api/support/send/", { message: text });
      }
    } catch {
      // leave the optimistic message; a real app would flag it as failed to send
    }
  };

  const panel = (
    <div
      className={
        mode === "embedded"
          ? "flex flex-col h-full bg-white"
          : "flex flex-col w-[360px] h-[480px] card-raised overflow-hidden animate-fade-up"
      }
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-paper-200 bg-paper-50">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-live opacity-60" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-live" />
          </span>
          <h3 className="text-sm font-display font-semibold text-ink-900">Support</h3>
        </div>
        {mode === "floating" && (
          <button
            onClick={() => setOpen(false)}
            className="text-ink-400 hover:text-ink-900 transition"
            aria-label="Close support chat"
          >
            <X size={16} />
          </button>
        )}
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {loading && <p className="text-xs text-ink-400 font-mono">Loading conversation…</p>}
        {!loading && messages.length === 0 && (
          <p className="text-xs text-ink-500">
            Send us a message — a real human on the platform team will reply here. Sending a
            top-up proof? Attach the screenshot with the paperclip below.
          </p>
        )}
        {messages.map((m) => {
          const isLocal = String(m.id).startsWith("local-");
          const imgSrc = isLocal ? m.attachment_url : attachmentBlobs[m.id];
          return (
            <div
              key={m.id}
              className={`max-w-[85%] rounded-xl px-3 py-2 text-sm leading-relaxed ${
                m.is_from_platform_owner
                  ? "bg-paper-100 text-ink-800 self-start mr-auto"
                  : "bg-signal text-white ml-auto"
              }`}
            >
              {m.message && <p>{m.message}</p>}
              {imgSrc && (
                <img
                  src={imgSrc}
                  alt="Attached proof"
                  className="rounded-lg max-w-full mt-2 max-h-48 object-cover"
                />
              )}
            </div>
          );
        })}
      </div>

      <div className="border-t border-paper-200 bg-paper-50">
        {pendingFile && (
          <div className="flex items-center gap-2 px-3 pt-2.5 text-xs text-ink-600">
            <Paperclip size={12} className="shrink-0" />
            <span className="truncate flex-1">{pendingFile.name}</span>
            <button
              onClick={() => setPendingFile(null)}
              className="text-ink-400 hover:text-alert shrink-0"
              aria-label="Remove attachment"
            >
              <X size={13} />
            </button>
          </div>
        )}
        <div className="flex items-center gap-2 px-3 py-3">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.pdf"
            className="hidden"
            onChange={handleFileChange}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="text-ink-400 hover:text-ink-900 transition p-1.5"
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