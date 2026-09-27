/**
 * PageHeader — the one consistent way every portal page introduces itself:
 * an eyebrow line, a title, and an optional right-aligned action/stat slot.
 * Replaces the old per-page "big colored icon in a tinted box" header now
 * that PortalLayout's TopBar already carries the page name — this is for
 * the one line of context under it, not a second, competing headline.
 */
export default function PageHeader({ eyebrow, title, meta, action }) {
  return (
    <div className="border-b border-paper-200 bg-white">
      <div className="max-w-6xl mx-auto px-6 py-6 flex items-center justify-between gap-4 flex-wrap">
        <div>
          {eyebrow && <p className="label-eyebrow mb-1">{eyebrow}</p>}
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-display font-semibold text-ink-900">{title}</h1>
            {meta}
          </div>
        </div>
        {action}
      </div>
    </div>
  );
}