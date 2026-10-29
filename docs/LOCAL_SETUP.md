# Menjalankan FnB Group ERP di komputer lokal

Hasil akhirnya: frontend di **http://localhost:3000**, backend di **http://localhost:8001**, MongoDB di
`localhost:27017`, berisi data demo.

> Kenapa ada proxy? Backend menolak aksi simpan (POST/PATCH/DELETE) yang datang dari origin lain
> (cek CSRF same-origin). Karena itu frontend dipanggil lewat `localhost:3000`, dan
> `frontend/src/setupProxy.js` meneruskan `/api` dan `/uploads` ke backend. Jangan isi
> `REACT_APP_BACKEND_URL` dengan `http://localhost:8001`: login memang berhasil, tetapi setiap
> simpan akan gagal 403 `CSRF_ORIGIN_MISMATCH`.

## 1. Prasyarat

| Kebutuhan | Versi | Catatan |
|---|---|---|
| Git | apa saja | |
| Python | **3.11 – 3.13** | numpy 2.4 / pandas 3.0 butuh minimal 3.11 |
| Node.js | 18 atau 20 LTS | |
| Yarn | 1.22 | `corepack enable` atau `npm i -g yarn` |
| MongoDB | 6 atau 7 | paling mudah lewat Docker |

Windows: jalankan semua perintah di **WSL2** (Ubuntu) atau Git Bash. Script seed memakai bash.

## 2. Ambil kode

```bash
git clone https://github.com/pandeyoga/ERPFNB.git
cd ERPFNB
git checkout claude/bold-newton-uplp38
```

## 3. MongoDB

```bash
docker run -d --name fnb-mongo -p 27017:27017 mongo:7
```

Bila tidak memakai Docker, install MongoDB Community dan pastikan berjalan di port 27017.

## 4. Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate            # Windows PowerShell: .venv\Scripts\Activate.ps1
pip install --upgrade pip

# emergentintegrations & litellm hanya untuk fitur AI dan berasal dari index privat —
# lewati saat install lokal (aplikasi tetap jalan; AI menjawab "Layanan AI tidak aktif").
grep -v -e '^emergentintegrations' -e '^litellm' requirements.txt | pip install -r /dev/stdin

cp env.local.example .env
```

Buka `backend/.env` dan ganti `JWT_SECRET` dengan string acak:

```bash
python3 -c "import secrets; print(secrets.token_urlsafe(48))"
```

## 5. Isi data demo (sekali saja)

Dari **root repo**, dengan virtualenv backend masih aktif:

```bash
cd ..                                # kembali ke root repo
bash scripts/seed_reset.sh
```

Script meminta konfirmasi — tekan **Enter** untuk lanjut. Prosesnya beberapa menit.
**Perhatian:** script ini menghapus lalu mengisi ulang data di database `DB_NAME`
(default `fnb_erp_local`). Jangan arahkan ke database yang berisi data asli.

## 6. Jalankan backend

```bash
cd backend
source .venv/bin/activate
uvicorn server:app --reload --port 8001
```

Cek: http://localhost:8001/api/health harus menjawab `"success": true`.

## 7. Jalankan frontend (terminal baru)

```bash
cd frontend
cp env.local.example .env            # REACT_APP_BACKEND_URL sengaja kosong
yarn install
yarn start
```

Browser terbuka di http://localhost:3000. Login ERP: http://localhost:3000/login

Bila `yarn start` kehabisan memori: `NODE_OPTIONS=--max-old-space-size=4096 yarn start`.

## 8. Akun demo

Semua akun memakai password **`Demo@2026`**.

| Email | Peran |
|---|---|
| admin@fnbgroup.id | Super Admin (semua modul) |
| owner@fnbgroup.id | Owner (Owner Cockpit, Executive) |
| executive@fnbgroup.id | Executive / Owner |
| finance@fnbgroup.id | Finance |
| procurement@fnbgroup.id | Procurement |

Akun peran lain (HR, outlet, inventory) bisa dilihat di Admin › Users & Roles.

## 9. Masalah yang sering muncul

| Gejala | Penyebab & solusi |
|---|---|
| Simpan data gagal **403 `CSRF_ORIGIN_MISMATCH`** | `REACT_APP_BACKEND_URL` di `frontend/.env` tidak kosong. Kosongkan, lalu hentikan dan jalankan ulang `yarn start`. |
| Setelah login kembali ke halaman login | `COOKIE_SECURE` belum `false` di `backend/.env` (cookie Secure tidak dikirim lewat http). Ubah lalu restart backend. |
| Backend gagal start: `KeyError: 'JWT_SECRET'` | `backend/.env` belum dibuat atau `JWT_SECRET` kosong. |
| Backend gagal start: `ServerSelectionTimeoutError` | MongoDB belum berjalan atau `MONGO_URL` salah. |
| `yarn install` gagal di `@emergentbase/visual-edits` | Paket editor visual Emergent. Hapus baris itu dari `devDependencies` di `frontend/package.json`; aplikasi tetap jalan tanpa paket ini. |
| Port 3000 / 8001 dipakai aplikasi lain | Frontend: `PORT=3001 yarn start`. Backend di port lain: jalankan uvicorn dengan `--port 8002` dan isi `LOCAL_BACKEND_URL=http://localhost:8002` di `frontend/.env`. |
| Fitur AI menjawab "Layanan AI tidak aktif" | Normal di lokal tanpa `EMERGENT_LLM_KEY` (lihat langkah 4). |
