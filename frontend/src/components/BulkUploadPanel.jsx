import { useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Download, Loader2, Upload } from "lucide-react";
import api from "../lib/api";

const POLL_INTERVAL_MS = 1500;
const TEMPLATE_HEADERS = [
  "first_name", "last_name", "job_title", "company",
  "phone_number", "email", "website", "address", "city", "state",
];

function downloadTemplate() {
  const csv = TEMPLATE_HEADERS.join(",") + "\n";
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "leads-template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * BulkUploadPanel — upload a CSV/XLSX of leads. Every row goes through the
 * same dedup rule as the web scraper (same email or phone = same lead,
 * gets merged rather than duplicated), and rows missing contact info but
 * given a website get a quick scraper-verification pass before being
 * counted as unusable.
 */
export default function BulkUploadPanel({ onComplete }) {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [task, setTask] = useState(null);
  const [error, setError] = useState("");
  const pollRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => () => clearInterval(pollRef.current), []);

  const isProcessing = task?.status === "PENDING";

  const submit = async (e) => {
    e.preventDefault();
    if (!file) return;
    setError("");
    setTask(null);
    setUploading(true);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await api.post("/api/scraper/upload/", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setTask({ id: res.data.id, status: res.data.status });
      beginPolling(res.data.id);
    } catch (err) {
      setError(err.response?.data?.detail || "Couldn't upload that file. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const beginPolling = (taskId) => {
    clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const res = await api.get(`/api/scraper/upload-tasks/${taskId}/`);
        setTask(res.data);
        if (res.data.status === "COMPLETED") {
          clearInterval(pollRef.current);
          onComplete?.();
        } else if (res.data.status === "FAILED") {
          clearInterval(pollRef.current);
          setError("Couldn't process that file — check it matches the template format.");
        }
      } catch {
        /* transient poll failure — try again next tick */
      }
    }, POLL_INTERVAL_MS);
  };

  const reset = () => {
    setFile(null);
    setTask(null);
    setError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="card p-5 mb-8">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Upload size={16} className="text-signal-bright" />
          <h2 className="font-display font-semibold text-sm">Bulk upload leads</h2>
        </div>
        <button
          type="button"
          onClick={downloadTemplate}
          className="flex items-center gap-1.5 text-xs text-signal-bright hover:underline"
        >
          <Download size={13} /> Download template
        </button>
      </div>

      {task?.status === "COMPLETED" ? (
        <div className="flex items-start gap-3 rounded-xl border border-live/30 bg-live/10 px-4 py-3">
          <CheckCircle2 size={18} className="text-live shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="text-ink-50 font-medium">
              Processed {task.total_rows} row{task.total_rows === 1 ? "" : "s"}
            </p>
            <p className="text-ink-200 text-xs mt-1">
              {task.created_count} new leads added · {task.updated_count} existing leads updated
              {task.error_count > 0 && ` · ${task.error_count} rows skipped (no email or phone)`}
            </p>
            <button onClick={reset} className="text-xs text-signal-bright hover:underline mt-2">
              Upload another file
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            disabled={uploading || isProcessing}
            className="text-xs text-ink-200 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-ink-600 file:text-ink-100 file:text-xs hover:file:bg-ink-500/70"
          />
          <button
            type="submit"
            disabled={!file || uploading || isProcessing}
            className="btn-primary !py-2 !px-4 text-xs shrink-0"
          >
            {uploading || isProcessing ? (
              <>
                <Loader2 size={13} className="animate-spin" />
                {isProcessing ? "Processing…" : "Uploading…"}
              </>
            ) : (
              "Upload"
            )}
          </button>
        </form>
      )}

      {error && (
        <div className="flex items-start gap-2 mt-3 text-xs text-alert">
          <AlertTriangle size={13} className="mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      <p className="text-[11px] text-ink-300 mt-3">
        Expected columns: first_name, last_name, job_title, company, phone_number, email,
        website, address, city, state. Every row needs at least an email or phone number.
      </p>
    </div>
  );
}