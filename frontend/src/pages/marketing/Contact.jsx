import { useState } from "react";
import { CheckCircle2, Mail } from "lucide-react";
import PublicNav from "../../components/marketing/PublicNav";
import PublicFooter from "../../components/marketing/PublicFooter";
import Reveal from "../../components/marketing/Reveal";

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
    <div className="mkt-page min-h-screen">
      <PublicNav />

      <section className="max-w-2xl mx-auto px-6 pt-24 pb-24">
        <Reveal>
          <h1 className="font-display font-extrabold text-4xl mb-4">Let's set up your team.</h1>
          <p className="text-mkt-muted mb-10 max-w-lg">
            Tell us a bit about your team and we'll reach out to get your numbers, agents, and
            CRM set up.
          </p>
        </Reveal>

        {submitted ? (
          <Reveal>
            <div className="mkt-card !border-mkt-green/40 !bg-mkt-green/[0.06] flex items-start gap-4">
              <CheckCircle2 size={22} className="text-mkt-green shrink-0 mt-0.5" />
              <div>
                <p className="font-display font-semibold text-lg mb-1">Message sent.</p>
                <p className="text-sm text-mkt-muted">
                  We'll get back to you within one business day at {form.email}.
                </p>
              </div>
            </div>
          </Reveal>
        ) : (
          <Reveal delay={100}>
            <form onSubmit={submit} className="mkt-card grid sm:grid-cols-2 gap-4 hover:!translate-y-0">
              <input className="mkt-input sm:col-span-1" placeholder="Your name" required value={form.name} onChange={update("name")} />
              <input className="mkt-input sm:col-span-1" type="email" placeholder="Work email" required value={form.email} onChange={update("email")} />
              <input className="mkt-input sm:col-span-2" placeholder="Company name" value={form.company} onChange={update("company")} />
              <textarea className="mkt-input sm:col-span-2 h-32 resize-none" placeholder="What does your team need?" value={form.message} onChange={update("message")} />
              <button type="submit" disabled={submitting} className="mkt-btn-primary sm:col-span-2 justify-center !py-3">
                <Mail size={16} />
                {submitting ? "Sending…" : "Send message"}
              </button>
            </form>
          </Reveal>
        )}
      </section>

      <PublicFooter />
    </div>
  );
}