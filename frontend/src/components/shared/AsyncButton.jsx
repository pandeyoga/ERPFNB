/**
 * AsyncButton — anti double-submit primitive.
 *
 * Wraps shadcn <Button>. When `onClick` returns a promise, the button disables
 * itself and shows a spinner until the promise settles, and a re-entrancy lock
 * ignores extra clicks fired while in-flight. Use for ALL irreversible / write
 * actions (post journal, confirm/post payment run, send/receive transfer,
 * approve, pay, settle) to prevent duplicate documents from rapid double-clicks.
 *
 * Drop-in: replace <Button onClick={fn}> with <AsyncButton onClick={fn}>.
 */
import { useState, useRef, forwardRef } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const AsyncButton = forwardRef(function AsyncButton(
  { onClick, children, disabled, busyText, spinner = true, className = "", ...props },
  ref,
) {
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);

  const handleClick = async (e) => {
    if (lock.current || busy || !onClick) return;     // ignore re-entrant clicks
    lock.current = true;
    setBusy(true);
    try {
      await onClick(e);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };

  return (
    <Button
      ref={ref}
      onClick={handleClick}
      disabled={disabled || busy}
      aria-busy={busy}
      className={["inline-flex items-center gap-1.5", className].filter(Boolean).join(" ")}
      {...props}
    >
      {busy && spinner && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
      {busy && busyText ? busyText : children}
    </Button>
  );
});

export default AsyncButton;
