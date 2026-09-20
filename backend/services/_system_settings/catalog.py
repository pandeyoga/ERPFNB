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
    "EMERGENT_LLM_KEY": {"label": "Emergent Universal LLM Key", "description": "Universal key dari Emergent.", "is_secret": True, "category": "ai", "placeholder": "sk-emergent-XXXXXXXXXXXX"},
    "OPENAI_API_KEY": {"label": "OpenAI API Key (Direct)", "description": "Override OpenAI.", "is_secret": True, "category": "ai", "placeholder": "sk-XXXXXXXXXXXXXXXXXXXX"},
    "ANTHROPIC_API_KEY": {"label": "Anthropic API Key (Direct)", "description": "Override Anthropic.", "is_secret": True, "category": "ai", "placeholder": "sk-ant-XXXXXXXXXXXX"},
    "GEMINI_API_KEY": {"label": "Google Gemini API Key (Direct)", "description": "Override Gemini.", "is_secret": True, "category": "ai", "placeholder": "AIzaSyXXXXXXXXXXXX"},
    "LLM_PROVIDER_PRIMARY": {"label": "Primary LLM Provider", "description": "Provider utama: emergent | openai | anthropic | gemini.", "is_secret": False, "category": "ai", "placeholder": "emergent"},
    "LLM_MODEL_TEXT": {"label": "Default Text Model", "description": "Model default untuk text generation.", "is_secret": False, "category": "ai", "placeholder": "gemini-2.5-flash"},
    "LLM_MODEL_OCR": {"label": "OCR Model", "description": "Model untuk OCR.", "is_secret": False, "category": "ai", "placeholder": "gemini-2.5-flash"},
    # WhatsApp
    "WHATSAPP_PROVIDER": {"label": "WhatsApp Provider", "description": "fonnte | twilio | meta | disabled.", "is_secret": False, "category": "whatsapp", "placeholder": "fonnte"},
    "FONNTE_API_TOKEN": {"label": "Fonnte API Token", "description": "Token dari fonnte.com.", "is_secret": True, "category": "whatsapp", "placeholder": "abcd1234efgh5678"},
    "TWILIO_ACCOUNT_SID": {"label": "Twilio Account SID", "description": "Account SID dari Twilio.", "is_secret": True, "category": "whatsapp", "placeholder": "ACxxxxxxxx..."},
    "TWILIO_AUTH_TOKEN": {"label": "Twilio Auth Token", "description": "Auth Token dari Twilio.", "is_secret": True, "category": "whatsapp", "placeholder": "your_auth_token_here"},
    "TWILIO_WHATSAPP_FROM": {"label": "Twilio WhatsApp From Number", "description": "Nomor WhatsApp Twilio.", "is_secret": False, "category": "whatsapp", "placeholder": "whatsapp:+14155238886"},
    "META_WHATSAPP_TOKEN": {"label": "Meta WhatsApp Cloud API Token", "description": "Permanent token dari Meta.", "is_secret": True, "category": "whatsapp", "placeholder": "EAAGxxxxxxxxxxxxxxx"},
    "META_PHONE_NUMBER_ID": {"label": "Meta WhatsApp Phone Number ID", "description": "Phone Number ID dari WhatsApp Cloud API.", "is_secret": False, "category": "whatsapp", "placeholder": "1234567890123456"},
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
