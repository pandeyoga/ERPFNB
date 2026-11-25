"""Memori & basis pengetahuan Asisten AI: lingkup memori (pribadi/perusahaan + izin), delta memori per sesi, ekstraksi
PDF/DOCX/TXT, potongan per bagian, pencarian BM25 dengan kutipan, catatan riset, alat agen. Tanpa jaringan."""
import asyncio
import io
import zipfile

import mongomock_motor
import pytest

from core import db as core_db

ADMIN = {"id": "u-admin", "permissions": ["*"]}
STAFF = {"id": "u-staff", "permissions": ["ai.agent.use"]}

SOP = """# SOP Opening Toko

1. Persiapan
Manajer shift datang 60 menit sebelum buka. Cek suhu chiller maksimal 4 derajat dan freezer minus 18 derajat.

2. Kas awal
Modal kas awal Rp 500.000 dihitung dua orang dan dicatat di Daily Close.

# SOP Closing

1. Setoran
Setoran tunai disetor ke bank paling lambat H+1 pukul 12.00 dengan slip setoran difoto."""


def _docx(paras):
    body = "".join(f'<w:p><w:pPr><w:pStyle w:val="{st}"/></w:pPr><w:r><w:t>{t}</w:t></w:r></w:p>' if st else
                   f"<w:p><w:r><w:t>{t}</w:t></w:r></w:p>" for st, t in paras)
    xml = f'<?xml version="1.0"?><w:document xmlns:w="x"><w:body>{body}</w:body></w:document>'
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as z:
        z.writestr("word/document.xml", xml)
    return buf.getvalue()


def _pdf(text):
    from reportlab.lib.pagesizes import A4
    from reportlab.pdfgen import canvas
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    for i, line in enumerate(text.split("\n")):
        c.drawString(40, 800 - i * 14, line)
    c.save()
    return buf.getvalue()


@pytest.fixture()
def db(monkeypatch):
    mdb = mongomock_motor.AsyncMongoMockClient()["kb_test"]
    monkeypatch.setattr(core_db, "_db", mdb)
    files = {"a-sop": ("sop.txt", "text/plain", SOP.encode()),
             "a-docx": ("kontrak.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                        _docx([("Heading1", "Kontrak Supplier Sayur"), (None, "Pembayaran tempo 14 hari setelah invoice."),
                               (None, "Retur barang busuk maksimal 1 x 24 jam &amp; diganti.")])),
             "a-pdf": ("kebijakan.pdf", "application/pdf", _pdf("Kebijakan Diskon\nDiskon karyawan 20 persen maksimal 2 kali sebulan."))}
    from services import upload_service

    async def meta(att_id, user=None):
        n, ct, _ = files[att_id]
        return {"id": att_id, "filename": n, "content_type": ct}

    async def data(att_id, user=None):
        return files[att_id][2]
    monkeypatch.setattr(upload_service, "get_attachment", meta)
    monkeypatch.setattr(upload_service, "get_attachment_bytes", data)
    return mdb


def test_memory_scopes_and_session_delta(db):
    from services.ai import knowledge as kb
    from services.ai.agent import runtime

    async def go():
        await kb.save_memory(ADMIN, content="Target food cost 32%", kind="target", scope="perusahaan")
        with pytest.raises(Exception):
            await kb.save_memory(STAFF, content="Semua toko tutup jam 22", scope="perusahaan")
        mine = await kb.save_memory(STAFF, content="Saya suka laporan dalam juta", kind="preferensi")
        again = await kb.save_memory(STAFF, content="Saya suka laporan dalam juta", kind="preferensi")
        assert again["id"] == mine["id"]                                   # tidak dobel
        assert {m["content"] for m in await kb.list_memories(STAFF)} == {"Target food cost 32%", "Saya suka laporan dalam juta"}
        assert {m["content"] for m in await kb.list_memories(ADMIN)} == {"Target food cost 32%"}    # pribadi orang lain tak terlihat
        with pytest.raises(Exception):
            await kb.delete_memory(ADMIN, mine["id"])                        # bukan pemilik
        await db.ai_sessions.insert_one({"id": "s1", "user_id": "u-staff"})
        first = await runtime._memory_delta(await db.ai_sessions.find_one({"id": "s1"}))
        assert "Target food cost 32%" in first and "juta" in first
        assert await runtime._memory_delta(await db.ai_sessions.find_one({"id": "s1"})) == ""   # tidak diulang
        await kb.save_memory(STAFF, content="Brand pilot: The Lounge", kind="fakta")
        delta = await runtime._memory_delta(await db.ai_sessions.find_one({"id": "s1"}))
        assert "The Lounge" in delta and "food cost" not in delta and delta.startswith("[Memori baru")
    asyncio.run(go())


def test_documents_search_with_citations_and_research(db):
    from services.ai import knowledge as kb

    async def go():
        with pytest.raises(Exception):
            await kb.add_document(STAFF, attachment_id="a-sop")               # butuh ai.knowledge.manage
        d1 = await kb.add_document(ADMIN, attachment_id="a-sop", category="SOP")
        d2 = await kb.add_document(ADMIN, attachment_id="a-docx", title="Kontrak CV Sayur", category="kontrak")
        d3 = await kb.add_document(ADMIN, attachment_id="a-pdf", category="kebijakan")
        assert d1["chunks"] >= 1 and d2["chunks"] >= 1 and d3["chunks"] >= 1
        r = await kb.search("berapa modal kas awal saat opening")
        top = r["hasil"][0]
        assert top["dokumen"] == "sop" and "500.000" in top["kutipan"]
        r = await kb.search("tempo pembayaran supplier sayur")
        assert r["hasil"][0]["dokumen"] == "Kontrak CV Sayur" and "14 hari" in r["hasil"][0]["kutipan"]
        assert "Kontrak Supplier Sayur" in r["hasil"][0]["bagian"]
        r = await kb.search("diskon karyawan")
        assert r["hasil"][0]["kategori"] == "kebijakan" and "hal. 1" in r["hasil"][0]["bagian"]
        await kb.save_research(STAFF, topic="Harga cabai rawit Jakarta Nov 2026", summary="Rata-rata Rp 62.000/kg (PIHPS)",
                               sources=[{"title": "PIHPS BI", "url": "https://www.bi.go.id/hargapangan", "tanggal": "2026-11-24"}])
        r = await kb.search("harga cabai rawit")
        assert r["hasil"][0]["jenis"] == "catatan_riset" and r["hasil"][0]["sumber"][0]["title"] == "PIHPS BI"
        await kb.delete_document(ADMIN, d1["id"])
        assert all(h.get("dokumen") != "sop" for h in (await kb.search("modal kas awal"))["hasil"])
    asyncio.run(go())


def test_agent_knowledge_tools(db):
    from services.ai.agent import tools

    async def go():
        ctx = tools.ToolContext(user=STAFF, session={"id": "s9"}, run_id="r1", scope={})
        out, err = await tools.run_tool("remember", {"content": "Laporan mingguan dikirim Senin", "kind": "preferensi",
                                                     "scope": "perusahaan"}, ctx)
        assert not err and '"pribadi"' in out                                 # staf → otomatis pribadi
        mem = await db.ai_memories.find_one({})
        out, err = await tools.run_tool("forget", {"memory_id": mem["id"][:8]}, ctx)
        assert not err and (await db.ai_memories.find_one({}))["deleted_at"]
        out, err = await tools.run_tool("save_research_note", {"topic": "UMK Jakarta 2027", "summary": "UMK naik 6%",
                                                               "sources": [{"title": "Pergub", "url": "https://x"}]}, ctx)
        assert not err
        out, err = await tools.run_tool("search_knowledge", {"query": "UMK Jakarta"}, ctx)
        assert not err and "UMK naik 6%" in out
    asyncio.run(go())
