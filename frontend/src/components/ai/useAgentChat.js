/** useAgentChat — state percakapan Asisten AI: muat sesi, kirim pesan (+lampiran), polling run, keputusan aksi.
 *
 * Backend: /api/ai/agent (routers/ai_agent.py). Agen berjalan di latar; UI mem-polling GET /runs/{id} untuk
 * langkah ("Membaca data: …") lalu memuat ulang sesi saat selesai. Setelah semua usulan dalam satu batch
 * diputuskan, backend otomatis melanjutkan agen (followup run) dan hook ini mem-polling run lanjutan itu.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import api, { unwrap, unwrapError } from "@/lib/api";

const POLL_MS = 1200;
const NO_SCOPE = { scope: false };

export async function uploadAttachment(file) {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("category", "ai_chat");
  fd.append("source_type", "ai_session");
  const res = await api.post("/uploads", fd, { headers: { "Content-Type": "multipart/form-data" }, timeout: 120000 });
  return unwrap(res);
}

export async function downloadAgentFile(file) {
  const res = await api.get(`/ai/agent/files/${file.file_id || file.id}`, { responseType: "blob", scope: false, timeout: 120000 });
  const url = URL.createObjectURL(res.data);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.filename || "hasil";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export function useAgentChat(initialSessionId = null) {
  const [sessionId, setSessionId] = useState(initialSessionId);
  const [session, setSession] = useState(null);
  const [runId, setRunId] = useState(null);
  const [steps, setSteps] = useState([]);
  const [pending, setPending] = useState(null); // pesan user yang sedang diproses (optimistik)
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const timer = useRef(null);
  const alive = useRef(true);

  useEffect(() => () => { alive.current = false; clearTimeout(timer.current); }, []);

  const loadSession = useCallback(async (id) => {
    if (!id) { setSession(null); return null; }
    const res = await api.get(`/ai/agent/sessions/${id}`, NO_SCOPE);
    const s = unwrap(res);
    if (alive.current) setSession(s);
    return s;
  }, []);

  const poll = useCallback((rid, sid) => {
    clearTimeout(timer.current);
    const started = Date.now();
    let failures = 0;
    // 1,2 dtk di 20 dtk pertama, lalu 2,5 dtk (agen panjang: riset/laporan) — hemat request
    const delay = () => (Date.now() - started < 20000 ? POLL_MS : 2500);
    const tick = async () => {
      try {
        const r = unwrap(await api.get(`/ai/agent/runs/${rid}`, NO_SCOPE));
        if (!alive.current) return;
        failures = 0;
        setSteps((r.events || []).filter((e) => e.type === "step").map((e) => e.label));
        if (r.status === "running") { timer.current = setTimeout(tick, delay()); return; }
        await loadSession(sid);
        if (!alive.current) return;
        setRunId(null); setSteps([]); setPending(null);
      } catch (e) {
        if (!alive.current) return;
        const st = e?.response?.status;
        // galat sementara (rate limit, jaringan, 5xx) → coba lagi; agen tetap berjalan di server
        if ((!st || st === 429 || st >= 500) && failures < 8) {
          failures += 1;
          timer.current = setTimeout(tick, 3000 * failures);
          return;
        }
        setError(unwrapError(e)); setRunId(null); setPending(null);
      }
    };
    setRunId(rid);
    timer.current = setTimeout(tick, POLL_MS);
  }, [loadSession]);

  // Buka sesi (dari daftar / localStorage) → lanjutkan polling bila masih berjalan
  const open = useCallback(async (id) => {
    clearTimeout(timer.current);
    setSessionId(id); setRunId(null); setSteps([]); setPending(null); setError("");
    if (!id) { setSession(null); return; }
    setLoading(true);
    try {
      const s = await loadSession(id);
      if (s?.running_run_id) poll(s.running_run_id, id);
    } catch (e) {
      setError(unwrapError(e)); setSession(null); setSessionId(null);
    } finally {
      if (alive.current) setLoading(false);
    }
  }, [loadSession, poll]);

  useEffect(() => { if (initialSessionId) open(initialSessionId); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // fresh: true → selalu percakapan baru (mis. tombol "Tanya AI" dari halaman lain)
  const send = useCallback(async ({ message, files = [], attachmentIds = [], context, scope, fresh = false }) => {
    setError("");
    setPending({ text: message, files: files.map((f) => f.name) });
    try {
      const attachments = [...attachmentIds];
      for (const f of files) attachments.push((await uploadAttachment(f)).id);
      const sid = fresh ? null : sessionId;
      const res = unwrap(await api.post("/ai/agent/chat", { message, session_id: sid, attachments, context, scope }, { timeout: 60000 }));
      if (res.session_id !== sessionId) setSessionId(res.session_id);
      poll(res.run_id, res.session_id);
      await loadSession(res.session_id);
      setPending(null); // pesan user sudah ada di riwayat sesi
      return res.session_id;
    } catch (e) {
      setError(unwrapError(e)); setPending(null);
      return null;
    }
  }, [sessionId, loadSession, poll]);

  const decide = useCallback(async (actionId, decision, { body, reason } = {}) => {
    setError("");
    try {
      const url = `/ai/agent/actions/${actionId}/${decision === "approve" ? "approve" : "reject"}`;
      const payload = decision === "approve" ? (body !== undefined ? { body } : {}) : { reason: reason || "" };
      const res = unwrap(await api.post(url, payload, { timeout: 200000 }));
      const sid = res.action?.session_id || sessionId;
      await loadSession(sid);
      if (res.followup?.run_id) poll(res.followup.run_id, sid);
      return res.action;
    } catch (e) {
      setError(unwrapError(e));
      await loadSession(sessionId).catch(() => {});
      return null;
    }
  }, [sessionId, loadSession, poll]);

  const decideBatch = useCallback(async (ids, decision) => {
    setError("");
    try {
      const res = unwrap(await api.post("/ai/agent/actions/batch", { ids, decision }, { timeout: 300000 }));
      await loadSession(sessionId);
      if (res.followup?.run_id) poll(res.followup.run_id, sessionId);
    } catch (e) {
      setError(unwrapError(e));
      await loadSession(sessionId).catch(() => {});
    }
  }, [sessionId, loadSession, poll]);

  return { sessionId, session, busy: !!runId || !!pending, steps, pending, error, setError, loading, open, send, decide, decideBatch };
}
