import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

/**
 * PasswordInput — password field with a show/hide eye toggle.
 * Pass the same className you'd give a plain <input> ("mkt-input" on the
 * dark login page, "input-field" inside the app portal) — it's applied to
 * the input itself, with room reserved on the right for the toggle button
 * regardless of which style is used.
 */
export default function PasswordInput({ className = "input-field", wrapperClassName = "", ...props }) {
  const [visible, setVisible] = useState(false);

  return (
    <div className={`relative ${wrapperClassName}`}>
      <input {...props} type={visible ? "text" : "password"} className={`${className} !pr-10`} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-current opacity-50 hover:opacity-100 transition"
        aria-label={visible ? "Hide password" : "Show password"}
        tabIndex={-1}
      >
        {visible ? <EyeOff size={15} /> : <Eye size={15} />}
      </button>
    </div>
  );
}