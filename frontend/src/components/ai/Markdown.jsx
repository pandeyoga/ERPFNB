/** Markdown — renderer ringan & aman untuk jawaban Asisten AI (tanpa innerHTML).
 *
 * Mendukung: judul (#–###), paragraf, **tebal**, *miring*, `kode`, blok ```kode```, daftar (- / 1.), tabel GFM,
 * garis (---), dan tautan [teks](url). Tautan internal ("/…") dibuka dengan router (onNavigate); tautan http(s)
 * dibuka di tab baru; skema lain diabaikan (teks biasa).
 */
import { Fragment } from "react";
import { cn } from "@/lib/utils";
import DataTable from "@/components/shared/DataTable";

const INLINE = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)\s]+\)|\*[^*\s][^*]*\*)/g;

function inline(text, onNavigate, keyPrefix = "i") {
  const parts = String(text).split(INLINE);
  return parts.map((p, i) => {
    const key = `${keyPrefix}-${i}`;
    if (!p) return null;
    if (p.startsWith("**") && p.endsWith("**")) return <strong key={key}>{inline(p.slice(2, -2), onNavigate, key)}</strong>;
    if (p.startsWith("`") && p.endsWith("`")) {
      return <code key={key} className="px-1 py-0.5 rounded bg-muted text-xs font-mono">{p.slice(1, -1)}</code>;
    }
    const m = p.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/);
    if (m) {
      const [, label, href] = m;
      if (href.startsWith("/") && !href.startsWith("//")) {
        return (
          <a key={key} href={href} className="text-primary underline underline-offset-2"
            onClick={(e) => { if (onNavigate) { e.preventDefault(); onNavigate(href); } }}>{label}</a>
        );
      }
      if (/^https?:\/\//i.test(href)) {
        return <a key={key} href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2">{label}</a>;
      }
      return <Fragment key={key}>{label}</Fragment>;
    }
    if (p.length > 2 && p.startsWith("*") && p.endsWith("*")) return <em key={key}>{p.slice(1, -1)}</em>;
    return <Fragment key={key}>{p}</Fragment>;
  });
}

const cells = (line) => line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
const isSep = (line) => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(line);
const NUM = /^-?[\d.,]+%?$|^Rp\s?[\d.,]+/;

/** Tabel GFM dari jawaban AI → DataTable (sort kolom, angka rata kanan, kartu di layar sempit). */
function Table({ head, rows, onNavigate }) {
  const numericCol = head.map((_, ci) => rows.length > 0 && rows.every((r) => !r[ci] || NUM.test(r[ci])));
  const toNum = (v) => Number(String(v || "").replace(/^Rp\s?/, "").replace(/\./g, "").replace(",", ".").replace("%", "")) || 0;
  const columns = head.map((h, ci) => ({
    key: `c${ci}`,
    label: h.replace(/\*\*/g, ""),
    numeric: numericCol[ci],
    primary: ci === 0,
    sortable: true,
    sortAccessor: numericCol[ci] ? (r) => toNum(r[`c${ci}`]) : undefined,
    render: (r) => inline(r[`c${ci}`] ?? "", onNavigate, `c${r.id}-${ci}`),
  }));
  const data = rows.map((r, ri) => Object.fromEntries([["id", ri], ...head.map((_, ci) => [`c${ci}`, r[ci] ?? ""])]));
  return (
    <div className="my-2 text-xs">
      <DataTable columns={columns} rows={data} loading={false} empty={null} stickyHeader={false} rowTestIdPrefix="ai-md-row" />
    </div>
  );
}

export default function Markdown({ text, onNavigate, className }) {
  const lines = String(text || "").replace(/\r\n/g, "\n").split("\n");
  const out = [];
  let i = 0;
  let para = [];
  const flush = () => {
    if (para.length) {
      out.push(<p key={`p${out.length}`} className="leading-relaxed">{inline(para.join(" "), onNavigate, `p${out.length}`)}</p>);
      para = [];
    }
  };
  while (i < lines.length) {
    const line = lines[i];
    if (/^```/.test(line)) {
      flush();
      const buf = [];
      i += 1;
      while (i < lines.length && !/^```/.test(lines[i])) { buf.push(lines[i]); i += 1; }
      i += 1;
      out.push(<pre key={`c${out.length}`} className="my-2 p-2 rounded-md bg-muted text-xs font-mono overflow-x-auto whitespace-pre">{buf.join("\n")}</pre>);
      continue;
    }
    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) {
      flush();
      const level = h[1].length;
      out.push(
        <p key={`h${out.length}`} className={cn("font-semibold mt-2", level <= 2 ? "text-sm" : "text-[13px]")}>
          {inline(h[2], onNavigate, `h${out.length}`)}
        </p>,
      );
      i += 1;
      continue;
    }
    if (/^\s*(-{3,}|\*{3,})\s*$/.test(line)) { flush(); out.push(<hr key={`r${out.length}`} className="my-2 border-border" />); i += 1; continue; }
    if (line.includes("|") && i + 1 < lines.length && isSep(lines[i + 1])) {
      flush();
      const head = cells(line);
      const rows = [];
      i += 2;
      while (i < lines.length && lines[i].includes("|") && lines[i].trim()) { rows.push(cells(lines[i])); i += 1; }
      out.push(<Table key={`t${out.length}`} head={head} rows={rows} onNavigate={onNavigate} />);
      continue;
    }
    const li = line.match(/^\s*([-*•]|\d+[.)])\s+(.*)$/);
    if (li) {
      flush();
      const ordered = /\d/.test(li[1]);
      const items = [];
      while (i < lines.length) {
        const m = lines[i].match(/^\s*([-*•]|\d+[.)])\s+(.*)$/);
        if (!m) break;
        items.push(m[2]);
        i += 1;
      }
      const Tag = ordered ? "ol" : "ul";
      out.push(
        <Tag key={`l${out.length}`} className={cn("pl-5 space-y-0.5", ordered ? "list-decimal" : "list-disc")}>
          {items.map((t, j) => <li key={j}>{inline(t, onNavigate, `l${out.length}-${j}`)}</li>)}
        </Tag>,
      );
      continue;
    }
    if (!line.trim()) { flush(); i += 1; continue; }
    para.push(line.trim());
    i += 1;
  }
  flush();
  return <div className={cn("space-y-1.5 text-sm break-words", className)}>{out}</div>;
}
