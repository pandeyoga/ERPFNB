"""System settings catalog — known settings metadata."""
KNOWN_SETTINGS: dict[str, dict] = {
    # Telegram
    "TELEGRAM_BOT_TOKEN": {"label": "Telegram Bot Token", "description": "Token dari @BotFather.", "is_secret": True, "category": "telegram", "placeholder": "123456:ABC-DEF1234..."},
    "TELEGRAM_WEBHOOK_URL": {"label": "Telegram Webhook URL", "description": "URL public untuk push update.", "is_secret": False, "category": "telegram", "placeholder": "https://your-app.example.com/api/telegram/webhook"},
    # Email
    "RESEND_API_KEY": {"label": "Resend API Key", "description": "API key Resend.", "is_secret": True, "category": "email", "placeholder": "re_XXXXXXXXXXXX"},
    "EMAIL_FROM": {"label": "Email From Address", "description": "Alamat pengirim default.", "is_secret": False, "category": "email", "placeholder": "no-reply@yourdomain.com"},
    "EMAIL_FROM_NAME": {"label": "Email Sender Display Name", "description": "Nama pengirim email.", "is_secret": False, "category": "email", "placeholder": "FnB Group"},
    "EMAIL_REPLY_TO": {"label": "Email Reply-To", "description": "Optional Reply-To header.", "is_secret": False, "category": "email", "placeholder": "support@yourdomain.com"},
    # AI
    "ANTHROPIC_API_KEY": {"label": "Anthropic API Key (Claude)", "description": "Kunci API Claude untuk semua fitur AI & agen. Dari console.anthropic.com.", "is_secret": True, "category": "ai", "placeholder": "sk-ant-XXXXXXXXXXXX"},
    "AI_MODEL": {"label": "Model Claude", "description": "Model untuk semua fitur AI. Default claude-opus-5-5.", "is_secret": False, "category": "ai", "placeholder": "claude-opus-5-5"},
    # Penyimpanan file (upload, foto struk, lampiran, gambar CMS)
    "STORAGE_BACKEND": {"label": "Penyimpanan File", "description": "local (disk server; default) | s3 (S3-compatible: AWS S3, Cloudflare R2, MinIO, dll.).", "is_secret": False, "category": "storage", "placeholder": "local"},
    "UPLOAD_DIR": {"label": "Folder Upload (local)", "description": "Folder di server untuk STORAGE_BACKEND=local. Pastikan volume persisten.", "is_secret": False, "category": "storage", "placeholder": "/app/backend/uploads"},
    "S3_BUCKET": {"label": "S3 Bucket", "description": "Nama bucket untuk STORAGE_BACKEND=s3.", "is_secret": False, "category": "storage", "placeholder": "erp-uploads"},
    "S3_ENDPOINT_URL": {"label": "S3 Endpoint URL", "description": "Kosongkan untuk AWS; isi untuk R2/MinIO (mis. https://<akun>.r2.cloudflarestorage.com).", "is_secret": False, "category": "storage", "placeholder": "https://..."},
    "S3_REGION": {"label": "S3 Region", "description": "Region bucket (R2: auto).", "is_secret": False, "category": "storage", "placeholder": "ap-southeast-1"},
    "S3_ACCESS_KEY_ID": {"label": "S3 Access Key ID", "description": "Access key untuk bucket.", "is_secret": True, "category": "storage", "placeholder": "AKIA..."},
    "S3_SECRET_ACCESS_KEY": {"label": "S3 Secret Access Key", "description": "Secret key untuk bucket.", "is_secret": True, "category": "storage", "placeholder": "..."},
    # WhatsApp
    "WHATSAPP_PROVIDER": {"label": "WhatsApp Provider", "description": "evolution (bot Asisten AI dua arah) | fonnte | twilio | meta | disabled.", "is_secret": False, "category": "whatsapp", "placeholder": "evolution"},
    "EVOLUTION_API_URL": {"label": "Evolution API URL", "description": "URL server Evolution API (self-hosted), mis. https://wa.perusahaan.com.", "is_secret": False, "category": "whatsapp", "placeholder": "https://wa.example.com"},
    "EVOLUTION_API_KEY": {"label": "Evolution API Key", "description": "apikey global/instance Evolution API.", "is_secret": True, "category": "whatsapp", "placeholder": "B6D711FCDE4D4FD5936544120E713976"},
    "EVOLUTION_INSTANCE": {"label": "Evolution Instance", "description": "Nama instance (nomor khusus bot).", "is_secret": False, "category": "whatsapp", "placeholder": "erp-bot"},
    "WHATSAPP_BOT_NUMBER": {"label": "Nomor Bot WhatsApp", "description": "Nomor bot yang ditampilkan ke pengguna saat menghubungkan WA.", "is_secret": False, "category": "whatsapp", "placeholder": "628123456789"},
    "WHATSAPP_WEBHOOK_SECRET": {"label": "Rahasia Webhook WhatsApp", "description": "Token di URL webhook Evolution: https://<app>/api/wa/webhook?token=<rahasia>.", "is_secret": True, "category": "whatsapp", "placeholder": "acak-panjang-32-karakter"},
    "FONNTE_API_TOKEN": {"label": "Fonnte API Token", "description": "Token dari fonnte.com.", "is_secret": True, "category": "whatsapp", "placeholder": "abcd1234efgh5678"},
    "TWILIO_ACCOUNT_SID": {"label": "Twilio Account SID", "description": "Account SID dari Twilio.", "is_secret": True, "category": "whatsapp", "placeholder": "ACxxxxxxxx..."},
    "TWILIO_AUTH_TOKEN": {"label": "Twilio Auth Token", "description": "Auth Token dari Twilio.", "is_secret": True, "category": "whatsapp", "placeholder": "your_auth_token_here"},
    "TWILIO_WHATSAPP_FROM": {"label": "Twilio WhatsApp From Number", "description": "Nomor WhatsApp Twilio.", "is_secret": False, "category": "whatsapp", "placeholder": "whatsapp:+14155238886"},
    "META_WHATSAPP_TOKEN": {"label": "Meta WhatsApp Cloud API Token", "description": "Permanent token dari Meta.", "is_secret": True, "category": "whatsapp", "placeholder": "EAAGxxxxxxxxxxxxxxx"},
    "META_PHONE_NUMBER_ID": {"label": "Meta WhatsApp Phone Number ID", "description": "Phone Number ID dari WhatsApp Cloud API.", "is_secret": False, "category": "whatsapp", "placeholder": "1234567890123456"},
    "STT_API_URL": {"label": "Speech-to-text URL (voice note WA)", "description": "Endpoint kompatibel OpenAI /v1/audio/transcriptions (mis. faster-whisper-server self-host). Kosong = voice note tidak didukung.", "is_secret": False, "category": "whatsapp", "placeholder": "https://stt.perusahaan.com/v1/audio/transcriptions"},
    "STT_API_KEY": {"label": "Speech-to-text API Key", "description": "Opsional — Bearer token server STT.", "is_secret": True, "category": "whatsapp", "placeholder": ""},
    "STT_MODEL": {"label": "Speech-to-text Model", "description": "Nama model di server STT (default whisper-1).", "is_secret": False, "category": "whatsapp", "placeholder": "Systran/faster-whisper-small"},
    # Kotak masuk email Asisten AI (invoice/price list/ekspor dari supplier & platform)
    "INBOX_IMAP_HOST": {"label": "IMAP Host (kotak masuk AI)", "description": "Server IMAP email khusus dokumen, mis. imap.gmail.com. Kosong = nonaktif.", "is_secret": False, "category": "ai", "placeholder": "imap.gmail.com"},
    "INBOX_IMAP_USER": {"label": "IMAP User", "description": "Alamat email kotak masuk khusus (mis. dokumen@perusahaan.com).", "is_secret": False, "category": "ai", "placeholder": "dokumen@perusahaan.com"},
    "INBOX_IMAP_PASSWORD": {"label": "IMAP Password", "description": "App password email (jangan password utama).", "is_secret": True, "category": "ai", "placeholder": ""},
    "INBOX_IMAP_FOLDER": {"label": "IMAP Folder", "description": "Folder yang dibaca (default INBOX).", "is_secret": False, "category": "ai", "placeholder": "INBOX"},
    "INBOX_OWNER_EMAIL": {"label": "Pemilik kotak masuk", "description": "Email akun ERP yang menerima & memproses dokumen dari kotak masuk (izinnya dipakai AI).", "is_secret": False, "category": "ai", "placeholder": "finance@perusahaan.com"},
    # Digest
    "DIGEST_DEFAULT_TIME": {"label": "Default Digest Time (WIB)", "description": "Jam pengiriman digest harian default. Format HH:MM (24h).", "is_secret": False, "category": "digest", "placeholder": "06:00"},
    # Tax
    "TAX_PPN_ENABLED": {"label": "PPN Aktif", "description": "Toggle PPN.", "is_secret": False, "category": "tax", "placeholder": "true", "value_type": "bool"},
    "TAX_PPN_RATE": {"label": "Tarif PPN", "description": "Tarif PPN dalam desimal. Default 0.12.", "is_secret": False, "category": "tax", "placeholder": "0.12", "value_type": "number"},
    "TAX_PPH21_ENABLED": {"label": "PPh 21 Aktif", "description": "Toggle PPh Pasal 21.", "is_secret": False, "category": "tax", "placeholder": "false", "value_type": "bool"},
    "TAX_PPH21_METHOD": {"label": "Metode PPh 21", "description": "gross atau gross_up.", "is_secret": False, "category": "tax", "placeholder": "gross", "value_type": "select"},
    "TAX_PPH23_ENABLED": {"label": "PPh 23 Aktif", "description": "Toggle PPh Pasal 23.", "is_secret": False, "category": "tax", "placeholder": "false", "value_type": "bool"},
    "TAX_PPH23_RATE": {"label": "Tarif PPh 23 Default", "description": "Tarif default PPh 23. Default 0.02.", "is_secret": False, "category": "tax", "placeholder": "0.02", "value_type": "number"},
    "TAX_PPH42_ENABLED": {"label": "PPh 4(2) Aktif", "description": "Toggle PPh Pasal 4 ayat 2.", "is_secret": False, "category": "tax", "placeholder": "false", "value_type": "bool"},
    "TAX_PPH42_RATE": {"label": "Tarif PPh 4(2) Default", "description": "Tarif default PPh 4(2). Default 0.10.", "is_secret": False, "category": "tax", "placeholder": "0.10", "value_type": "number"},
    "COMPANY_NPWP": {"label": "NPWP Perusahaan", "description": "Nomor Pokok Wajib Pajak perusahaan.", "is_secret": False, "category": "tax", "placeholder": "000000000000000"},
    "COMPANY_PKP_NAME": {"label": "Nama PKP", "description": "Nama perusahaan sesuai SPPKP.", "is_secret": False, "category": "tax", "placeholder": "PT. FnB Group"},
    "COMPANY_PKP_ADDRESS": {"label": "Alamat PKP", "description": "Alamat lengkap perusahaan PKP.", "is_secret": False, "category": "tax", "placeholder": "Jl. Sudirman No. 123, Jakarta Pusat"},
    # Branding
    "APP_NAME": {"label": "Application Name", "description": "Nama aplikasi di header & email.", "is_secret": False, "category": "branding", "placeholder": "FnB Group"},
    "APP_LOGO_URL": {"label": "Application Logo URL", "description": "URL logo perusahaan.", "is_secret": False, "category": "branding", "placeholder": "https://yourdomain.com/logo.png"},
    "APP_PRIMARY_COLOR": {"label": "Primary Brand Color", "description": "Hex color code.", "is_secret": False, "category": "branding", "placeholder": "#6366F1"},
    # Voucher
    "voucher.rules.allow_multiple_per_sale": {"label": "Izinkan Multiple Voucher Per Sales", "description": "Satu daily sales bisa pakai lebih dari 1 voucher.", "is_secret": False, "category": "voucher", "placeholder": "false", "value_type": "bool"},
    "voucher.rules.require_customer_phone": {"label": "Wajib Customer Phone untuk Voucher", "description": "Voucher hanya bisa dipakai customer terdaftar.", "is_secret": False, "category": "voucher", "placeholder": "false", "value_type": "bool"},
    "voucher.rules.max_discount_amount": {"label": "Maksimal Diskon Voucher (Rp)", "description": "Cap maksimal diskon.", "is_secret": False, "category": "voucher", "placeholder": "", "value_type": "number"},
    "voucher.ui.accepted_formats_hint": {"label": "Helper Text Format Voucher", "description": "Text hint di UI.", "is_secret": False, "category": "voucher", "placeholder": "Masukkan kode voucher"},
}
