"""/api/ai/knowledge — memori Asisten AI, basis pengetahuan (SOP/kontrak/kebijakan) & catatan riset.

Baca: semua pemakai Asisten AI. Memori perusahaan & dokumen: ai.knowledge.manage. Memori pribadi: pemiliknya.
Agen memakai alat khusus (remember/forget/search_knowledge/save_research_note) — prefix ini tidak masuk katalog aksi.
"""
from fastapi import APIRouter, Body, Depends, Query

from core.exceptions import ok_envelope
from core.security import require_perm
from services.ai import knowledge as kb

router = APIRouter(prefix="/api/ai/knowledge", tags=["ai-knowledge"])
_USE = require_perm("ai.agent.use")


@router.get("/memories", summary="Memori yang berlaku untuk saya (perusahaan + pribadi)")
async def memories(user: dict = Depends(_USE)):
    return ok_envelope({"rows": await kb.list_memories(user), "boleh_kelola_perusahaan": kb.can_manage(user)})


@router.post("/memories", summary="Tambah memori")
async def add_memory(payload: dict = Body(...), user: dict = Depends(_USE)):
    """{content, kind: preferensi|aturan|target|koreksi|fakta, scope: pribadi|perusahaan}"""
    return ok_envelope(await kb.save_memory(user, content=str(payload.get("content") or ""), kind=str(payload.get("kind") or "fakta"),
                                            scope=str(payload.get("scope") or "pribadi")))


@router.patch("/memories/{memory_id}", summary="Ubah memori")
async def edit_memory(memory_id: str, payload: dict = Body(...), user: dict = Depends(_USE)):
    return ok_envelope(await kb.save_memory(user, memory_id=memory_id, content=str(payload.get("content") or ""),
                                            kind=str(payload.get("kind") or "fakta"), scope=str(payload.get("scope") or "pribadi")))


@router.delete("/memories/{memory_id}", summary="Hapus memori")
async def remove_memory(memory_id: str, user: dict = Depends(_USE)):
    await kb.delete_memory(user, memory_id)
    return ok_envelope({"deleted": True})


@router.get("/docs", summary="Dokumen basis pengetahuan")
async def docs(user: dict = Depends(_USE)):
    return ok_envelope({"rows": await kb.list_documents(), "boleh_kelola": kb.can_manage(user)})


@router.post("/docs", summary="Tambah dokumen (SOP, kontrak, kebijakan) dari lampiran")
async def add_doc(payload: dict = Body(...), user: dict = Depends(require_perm("ai.knowledge.manage"))):
    """{attachment_id, title?, category?: SOP|kontrak|kebijakan|resep|lainnya}"""
    return ok_envelope(await kb.add_document(user, attachment_id=str(payload.get("attachment_id") or ""),
                                             title=payload.get("title"), category=str(payload.get("category") or "lainnya")))


@router.get("/docs/{doc_id}", summary="Isi dokumen per bagian")
async def get_doc(doc_id: str, user: dict = Depends(_USE)):
    return ok_envelope(await kb.get_document(doc_id))


@router.delete("/docs/{doc_id}", summary="Hapus dokumen")
async def delete_doc(doc_id: str, user: dict = Depends(require_perm("ai.knowledge.manage"))):
    await kb.delete_document(user, doc_id)
    return ok_envelope({"deleted": True})


@router.get("/research", summary="Catatan riset (sumber luar)")
async def research(user: dict = Depends(_USE)):
    return ok_envelope(await kb.list_research())


@router.delete("/research/{note_id}", summary="Hapus catatan riset")
async def delete_research(note_id: str, user: dict = Depends(_USE)):
    await kb.delete_research(user, note_id)
    return ok_envelope({"deleted": True})


@router.get("/search", summary="Cari di basis pengetahuan & catatan riset")
async def search(q: str = Query(..., min_length=2), user: dict = Depends(_USE)):
    return ok_envelope(await kb.search(q))
