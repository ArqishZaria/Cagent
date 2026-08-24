import { useState } from "react";
import { CheckCircle2, Mail } from "lucide-react";
import PublicNav from "../../components/marketing/PublicNav";
import PublicFooter from "../../components/marketing/PublicFooter";

/**
 * ContactPage
 *
 * NOTE: this form currently only shows a success state in the browser — it
 * does not yet send anywhere. There's no "contact us" API endpoint in the
 * backend yet. When you're ready to make this real, the cleanest option is
 * a small POST /api/contact/ view (AllowAny, just validates + emails your
 * team via the same EMAIL_BACKEND already configured for invoices), then
 * swap the setTimeout below for a real `await api.post("/api/contact/", form)`.
 */
export default function ContactPage() {
  const [form, setForm] = useState({ name: "", email: "", company: "", message: "" });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const submit = (e) => {
    e.preventDefault();
    setSubmitting(true);
    setTimeout(() => {
      setSubmitting(false);
      setSubmitted(true);
    }, 700);
  };

  return (
    <div className="min-h-screen bg-paper-50">
      <PublicNav />

      <section className="max-w-3xl mx-auto px-6 pt-24 pb-24">
        <span className="label-eyebrow inline-block mb-5">Contact</span>
        <h1 className="font-display text-4xl font-semibold mb-4 text-ink-900">Let's set up your team.</h1>
        <p className="text-ink-600 mb-10 max-w-lg">
          Tell us a bit about your team and we'll reach out to get your numbers, agents, and
          CRM set up.
        </p>

        {submitted ? (
          <div className="card p-8 flex items-start gap-4 bg-live/5 !border-live/30">
            <CheckCircle2 size={22} className="text-live shrink-0 mt-0.5" />
            <div>
              <p className="font-display font-semibold text-lg mb-1 text-ink-900">Message sent.</p>
              <p className="text-sm text-ink-600">
                We'll get back to you within one business day at {form.email}.
              </p>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="card p-7 grid sm:grid-cols-2 gap-4">
            <input
              className="input-field sm:col-span-1"
              placeholder="Your name"
              required
              value={form.name}
              onChange={update("name")}
            />
            <input
              className="input-field sm:col-span-1"
              type="email"
              placeholder="Work email"
              required
              value={form.email}
              onChange={update("email")}
            />
            <input
              className="input-field sm:col-span-2"
              placeholder="Company name"
              value={form.company}
              onChange={update("company")}
            />
            <textarea
              className="input-field sm:col-span-2 h-32 resize-none"
              placeholder="What does your team need?"
              value={form.message}
              onChange={update("message")}
            />
            <button type="submit" disabled={submitting} className="btn-primary sm:col-span-2 justify-center !py-3">
              <Mail size={16} />
              {submitting ? "Sending…" : "Send message"}
            </button>
          </form>
        )}
      </section>

      <PublicFooter />
    </div>
  );
}
