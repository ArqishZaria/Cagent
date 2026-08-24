const COMPANIES = [
  "Northside HVAC",
  "Acura Roofing & Solar",
  "Delgado Legal Group",
  "Harborline Freight",
  "Maple & Co. Realty",
  "Ridgeline Landscaping",
  "Cobalt Home Services",
  "Fenwick Insurance Partners",
];

/**
 * TrustStrip — a slow marquee of the kind of small/mid-size service
 * businesses that actually run on a product like this. Names are
 * illustrative, not real companies or trademarks.
 */
export default function TrustStrip() {
  const loop = [...COMPANIES, ...COMPANIES];
  return (
    <div className="border-y border-paper-200 bg-white overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 py-6">
        <p className="label-eyebrow text-center mb-5">Trusted by teams who live on the phone</p>
        <div className="relative overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]">
          <div className="flex w-max gap-14 animate-marquee">
            {loop.map((name, i) => (
              <span
                key={`${name}-${i}`}
                className="font-mono text-sm uppercase tracking-wide text-ink-300 whitespace-nowrap"
              >
                {name}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
