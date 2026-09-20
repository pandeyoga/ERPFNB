/** Phase 11E — Voice input button using Web Speech API.
 * Falls back gracefully if not supported.
 */
import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function VoiceInputButton({ onTranscript, lang = "id-ID", disabled = false, className }) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef(null);

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SR) setSupported(true);
    return () => {
      try { recognitionRef.current?.stop?.(); } catch {}
    };
  }, []);

  function start() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    try {
      const r = new SR();
      r.lang = lang;
      r.continuous = false;
      r.interimResults = false;
      r.maxAlternatives = 1;
      r.onstart = () => setListening(true);
      r.onresult = (event) => {
        const transcript = event.results?.[0]?.[0]?.transcript || "";
        if (transcript) {
          onTranscript?.(transcript);
        }
      };
      r.onerror = (e) => {
        const msg = e?.error || "voice_error";
        if (msg === "not-allowed" || msg === "service-not-allowed") {
          toast.error("Akses mikrofon ditolak. Aktifkan permission di browser.");
        } else if (msg !== "no-speech" && msg !== "aborted") {
          toast.error(`Voice input gagal: ${msg}`);
        }
        setListening(false);
      };
      r.onend = () => setListening(false);
      recognitionRef.current = r;
      r.start();
    } catch (e) {
      toast.error("Voice input tidak tersedia");
      setListening(false);
    }
  }

  function stop() {
    try { recognitionRef.current?.stop?.(); } catch {}
    setListening(false);
  }

  if (!supported) return null;

  return (
    <Button
      type="button"
      variant={listening ? "default" : "outline"}
      size="icon"
      disabled={disabled}
      onClick={listening ? stop : start}
      className={cn(
        "rounded-full h-10 w-10",
        listening && "bg-rose-500 text-white hover:bg-rose-600 ring-4 ring-rose-200 dark:ring-rose-950 animate-pulse",
        className,
      )}
      title={listening ? "Stop listening" : "Voice input (id-ID)"}
      data-testid="voice-input-btn"
    >
      {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
    </Button>
  );
}
