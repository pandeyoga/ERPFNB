# Deploy FnB Group ERP ke server sendiri

Aplikasi tidak lagi bergantung pada platform Emergent. Deploy standar memakai **Docker Compose** di satu server
Linux (VPS) dengan tiga container:

```
browser ──HTTPS──▶ web (Caddy)
                     ├─ /            → build React (statis)
                     ├─ /api/*       ─┐
                     └─ /uploads/*   ─┴─▶ backend (FastAPI :8001) ──▶ mongo (MongoDB 7)
```

**Kenapa frontend dan `/api` harus satu domain?** Backend menolak aksi simpan (POST/PATCH/DELETE) dari origin
lain (cek CSRF same-origin → `403 CSRF_ORIGIN_MISMATCH`) dan cookie login bersifat `Secure`/`SameSite`.
Karena itu frontend dibangun dengan `REACT_APP_BACKEND_URL` kosong dan Caddy meneruskan `/api` ke backend di
domain yang sama. Caddy juga mengambil sertifikat HTTPS (Let's Encrypt) secara otomatis.

Berkas yang terlibat: `docker-compose.yml`, `deploy/backend.Dockerfile`, `deploy/web.Dockerfile`,
`deploy/Caddyfile`, `deploy/env.production.example`.

## 1. Prasyarat

| Kebutuhan | Catatan |
|---|---|
| Server Linux | Minimal 2 vCPU, **4 GB RAM** (build frontend butuh ±3 GB), disk 20 GB+ |
| Docker Engine + plugin Compose | `docker compose version` harus jalan |
| Domain | A record (mis. `erp.contoh.com`) mengarah ke IP server |
| Port 80 dan 443 terbuka | Dipakai Caddy untuk HTTPS otomatis |

## 2. Deploy pertama

```bash
git clone https://github.com/pandeyoga/ERPFNB.git
cd ERPFNB
cp deploy/env.production.example .env
```

Isi `.env` — minimal empat nilai ini:

| Variabel | Isi |
|---|---|
| `SITE_ADDRESS` | Domain, mis. `erp.contoh.com` |
| `CORS_ORIGINS` | `https://erp.contoh.com` |
| `JWT_SECRET` | `python3 -c "import secrets; print(secrets.token_urlsafe(48))"` |
| `SECRETS_ENCRYPTION_KEY` | `python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"` atau `openssl rand -base64 32 \| tr '+/' '-_'` |

`SECRETS_ENCRYPTION_KEY` mengenkripsi API key yang disimpan lewat Admin → Integrations. **Simpan salinannya di
tempat aman** — bila hilang atau berganti, key integrasi harus diisi ulang (aplikasi tetap jalan).

Lalu jalankan:

```bash
docker compose up -d --build
docker compose ps          # tunggu backend "healthy"
```

Buka `https://erp.contoh.com`. Sertifikat HTTPS dibuat otomatis pada akses pertama (butuh DNS sudah mengarah
ke server dan port 80/443 terbuka).

## 3. Isi data

Database baru masih kosong. Pilih salah satu:

### A. Pindahkan database lama (bila sudah ada data asli)

Dari database lama, buat arsip:

```bash
mongodump --uri "mongodb://<host-lama>:27017/<db-lama>" --archive=erp.archive.gz --gzip
```

Pulihkan ke server baru (ganti `<db-lama>` dengan nama database lama; `fnb_erp` = `DB_NAME` di `.env`):

```bash
docker compose exec -T mongo mongorestore --archive --gzip --nsFrom '<db-lama>.*' --nsTo 'fnb_erp.*' < erp.archive.gz
docker compose restart backend
```

API key integrasi di database lama terenkripsi dengan kunci server lama. Di deployment Emergent kunci itu ada di
berkas `/app/.app_secret`; bila masih bisa diakses, isi nilainya sebagai `SECRETS_ENCRYPTION_KEY`. Bila tidak,
isi ulang key di Admin → Integrations.

Upload lama (foto, struk, PDF) ikut dipindah dengan menyalin isi folder upload lama ke volume `uploads`:

```bash
docker compose cp ./uploads-lama/. backend:/data/uploads/
docker compose exec -u root backend chown -R erp:erp /data/uploads
```

### B. Data demo (uji coba)

```bash
docker compose exec backend bash -c "cd /srv/erp && bash scripts/seed_reset.sh"
```

Tekan Enter untuk konfirmasi. **Script ini menghapus data di database `DB_NAME`** — jangan jalankan pada data
asli. Akun demo memakai password publik `Demo@2026` (daftar di `docs/LOCAL_SETUP.md` §8); **ganti semua password**
(Admin › Users & Roles) sebelum aplikasi dipakai sungguhan.

## 4. Update aplikasi

```bash
git pull
docker compose up -d --build
```

Data aman di volume Docker (`mongo_data`, `uploads`, `secrets`, `caddy_data`). Jangan jalankan
`docker compose down -v` — opsi `-v` menghapus volume beserta datanya.

## 5. Backup

Simpan rutin (mis. lewat cron harian) ke luar server:

```bash
# database
docker compose exec -T mongo mongodump --archive --gzip --db fnb_erp > backup-db-$(date +%F).archive.gz
# file upload
docker compose exec -T backend tar czf - -C /data uploads > backup-uploads-$(date +%F).tar.gz
```

Simpan juga berkas `.env` (berisi `JWT_SECRET` dan `SECRETS_ENCRYPTION_KEY`) di tempat aman.

## 6. Variasi

- **Uji di komputer sendiri tanpa domain:** di `.env` isi `SITE_ADDRESS=:80`, `HTTP_PORT=8080`,
  `CORS_ORIGINS=http://localhost:8080`, lalu buka `http://localhost:8080`.
- **HTTPS ditangani pihak lain** (Cloudflare proxy, load balancer, nginx di host): `SITE_ADDRESS=:80`, arahkan
  proxy tersebut ke port `HTTP_PORT`, dan tambah `TRUSTED_PROXY_HOPS` sebanyak proxy tambahan di depan Caddy
  (Cloudflare → `TRUSTED_PROXY_HOPS=2`) agar rate limit membaca IP pengguna yang benar. Proxy di depan wajib
  meneruskan header `Host` asli.
- **Tanpa Docker:** prinsipnya sama — sajikan hasil `yarn build` (dengan `REACT_APP_BACKEND_URL` kosong) dan
  teruskan `/api` + `/uploads` ke `uvicorn server:app --port 8001` di domain yang sama (lihat `deploy/Caddyfile`).
  Jalankan backend **satu proses** (tanpa `--workers`), karena scheduler berjalan di proses backend.

## 7. Masalah yang sering muncul

| Gejala | Penyebab & solusi |
|---|---|
| `docker compose up` berhenti: "Isi JWT_SECRET di .env" | Variabel wajib belum diisi di `.env`. |
| Simpan data gagal **403 `CSRF_ORIGIN_MISMATCH`** | Frontend dibuka dari domain lain dari API, atau proxy di depan tidak meneruskan header `Host`. |
| Setelah login kembali ke halaman login | Diakses lewat `http://` (bukan HTTPS) sementara `COOKIE_SECURE=true`. Pakai domain + HTTPS; hanya untuk uji via `http://<IP>` set `COOKIE_SECURE=false`. |
| Situs tidak bisa dibuka, log Caddy menyebut ACME/sertifikat | DNS belum mengarah ke server atau port 80/443 tertutup firewall. Cek `docker compose logs web`. |
| Backend tidak "healthy" | `docker compose logs backend` — biasanya `.env` salah atau MongoDB belum siap. |
| API key integrasi tiba-tiba kosong | `SECRETS_ENCRYPTION_KEY` berubah. Kembalikan nilai lama, atau isi ulang key di Admin → Integrations. |
| Fitur AI menjawab "AI tidak aktif" | Isi `ANTHROPIC_API_KEY` di `.env` atau Admin → Integrations → AI (Claude). |
