// Tiny module-level flag so PortalLayout's idle timer (which lives outside the
// Telnyx provider) can tell whether a call is in progress.
let active = false;
export const setCallActive = (v) => { active = Boolean(v); };
export const isCallActive = () => active;