/**
 * DuotonePhoto — wraps a stock photo in the black/green duotone treatment
 * (see .mkt-photo-wrap in index.css). `seed` picks a stable placeholder
 * photo; swap the src for real customer/office photography before launch —
 * this is a structurally-correct placeholder, not final art.
 */
export default function DuotonePhoto({ seed, w = 800, h = 600, alt = "", className = "" }) {
  return (
    <div className={`mkt-photo-wrap ${className}`} style={{ aspectRatio: `${w}/${h}` }}>
      <img src={`https://picsum.photos/seed/${seed}/${w}/${h}`} alt={alt} loading="lazy" />
    </div>
  );
}