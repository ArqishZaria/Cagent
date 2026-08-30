import { useMemo, useState } from "react";
import { ChevronDown, HelpCircle, LifeBuoy, Search } from "lucide-react";
import { useCurrentUser } from "../lib/currentUser";
import SupportChatWidget from "../components/SupportChatWidget";

const FAQS = [
  {
    category: "Getting started",
    items: [
      { q: "What is cagent?", a: "cagent puts your phone system, CRM, and AI lead generation in one place. Calls and texts log automatically to each lead's profile, and the Prospector finds new leads for you." },
      { q: "How do I get a phone number?", a: "An Admin buys a number under Settings → Phone numbers, searching by area code. Once purchased it can be assigned to any teammate." },
      { q: "Why does the portal sign me out?", a: "For security, you're automatically signed out after 5 minutes of no activity anywhere in the portal." },
    ],
  },
  {
    category: "Leads & Prospector",
    items: [
      { q: "How does the Prospector find leads?", a: "Type in who you're looking for (industry, city, role). cagent checks your own list, then the shared verified pool, then searches the live web — filling up to 25 leads per search, in that order." },
      { q: "What does a search cost?", a: "A flat fee per search, charged only if it actually returns at least one lead — see Usage for the exact rate." },
      { q: "How do I bulk upload leads?", a: "On the Leads tab, use Bulk upload leads and pick a .csv or .xlsx file (download the template first). Rows need at least an email or phone number." },
      { q: "Why did some uploaded rows get rejected?", a: "A row is rejected if it has no email/phone and no verifiable web presence — the reasons are shown after the upload finishes." },
      { q: "What makes a lead appear in the CRM & dialer tab?", a: "Clicking Contact on a lead in the Leads List — or logging a call/text for it directly — is what moves it into the CRM/Dialer tab." },
    ],
  },
  {
    category: "Calling & the dialer",
    items: [
      { q: "Why can't I make a call?", a: "Calling needs an active wallet balance and a phone number connected. Check the banner at the top of the portal, or visit Billing to top up." },
      { q: "What happens if a second call comes in while I'm on one?", a: "It's offered as a waiting call — accepting it ends your current call first; declining it only rejects the new one." },
      { q: "Why was an inbound call marked as missed?", a: "Inbound calls are auto-declined if the wallet balance can't cover at least one minute — it's logged as a missed call in Call logs, not silently dropped." },
    ],
  },
  {
    category: "SMS & compliance",
    items: [
      { q: "What happens when a lead texts STOP?", a: "They're automatically marked as opted out — enforced across every number and every teammate, and shared platform-wide so no one accidentally re-contacts them." },
      { q: "How is an SMS billed?", a: "Per 160-character segment — longer messages spanning two segments are billed at 2× the per-segment rate." },
    ],
  },
  {
    category: "Billing & wallet",
    items: [
      { q: "How do I top up my wallet?", a: "Go to Billing → Upload finance for transfer instructions, then send your payment proof through the chat (Admins only) so it can be credited." },
      { q: "What happens at $0 balance?", a: "Calling, texting, and lead searches pause until you top up — nothing else in the portal is affected." },
      { q: "Where can I see what I've spent?", a: "The Usage tab breaks spend down by type (calls, SMS, searches, number rental) alongside your current rates." },
    ],
  },
  {
    category: "Team & numbers",
    items: [
      { q: "How do I add a teammate?", a: "Admins can add agent accounts under Settings → Add an agent. New accounts always get Agent access." },
      { q: "How do I assign a number to someone?", a: "In Settings → Assign numbers, pick a teammate from the dropdown next to any owned number." },
      { q: "Can an Agent see every lead?", a: "No — Agents only see leads, calls, and texts assigned to them. Admins see everything for the company." },
    ],
  },
  {
    category: "Account & security",
    items: [
      { q: "How do I change my password?", a: "Go to your Profile tab and use the Change password section." },
      { q: "How do I update my name or email?", a: "Your Profile tab lets you edit your name and email at any time." },
    ],
  },
];

export default function SupportPage() {
  const { isAdmin, loading } = useCurrentUser();
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return FAQS;
    return FAQS
      .map((section) => ({
        ...section,
        items: section.items.filter(
          (item) => item.q.toLowerCase().includes(q) || item.a.toLowerCase().includes(q)
        ),
      }))
      .filter((section) => section.items.length > 0);
  }, [query]);

  return (
    <div className="min-h-screen">
      <div className="border-b border-paper-200 bg-white">
        <div className="max-w-5xl mx-auto px-6 py-8 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-signal/8 border border-signal/25 text-signal">
            <LifeBuoy size={22} />
          </div>
          <div>
            <span className="label-eyebrow">Help & support</span>
            <h1 className="text-2xl font-display font-semibold text-ink-900">Customer support</h1>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8 grid lg:grid-cols-[1fr_360px] gap-6 items-start">
        <div>
          <div className="relative mb-6">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" />
            <input
              className="input-field !pl-10"
              placeholder="Search FAQs…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          {filtered.length === 0 ? (
            <p className="text-sm text-ink-400 text-center py-12">No FAQs match "{query}".</p>
          ) : (
            <div className="space-y-8">
              {filtered.map((section) => (
                <div key={section.category}>
                  <h2 className="font-display font-semibold text-sm text-ink-900 mb-3">{section.category}</h2>
                  <div className="space-y-2">
                    {section.items.map((item) => (
                      <FaqItem key={item.q} {...item} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="lg:sticky lg:top-6">
          {!loading && isAdmin && (
            <div className="card !p-0 overflow-hidden h-[560px]">
              <SupportChatWidget mode="embedded" />
            </div>
          )}
          {!loading && !isAdmin && (
            <div className="card p-5 text-sm text-ink-600 leading-relaxed">
              <div className="flex items-center gap-2 mb-2">
                <HelpCircle size={16} className="text-signal" />
                <span className="font-display font-semibold text-ink-900">Need more help?</span>
              </div>
              Direct support chat with the cagent team is available to your company's Admin.
              Ask them to reach out on your behalf, or check the FAQs on the left.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FaqItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="card !p-0 overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3.5 text-left"
      >
        <span className="text-sm font-medium text-ink-900">{q}</span>
        <ChevronDown size={15} className={`text-ink-400 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="px-4 pb-4 text-sm text-ink-600 leading-relaxed">{a}</div>}
    </div>
  );
}