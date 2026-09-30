# Auth testing (FE-06 cookie session)
- Staff login: POST /api/auth/login {email,password} → sets httpOnly cookies `aurora_at` (path /) and `aurora_rt` (path /api/auth); body still has tokens for API clients.
- Web app never stores tokens in localStorage; axios uses withCredentials. 401 → POST /api/auth/refresh (cookie) → retry.
- Cookie-authenticated POST/PUT/PATCH/DELETE with a foreign Origin → 403 CSRF_ORIGIN_MISMATCH. Bearer header clients are unaffected.
- POST /api/auth/logout clears cookies and revokes refresh token.
- Loyalty customer: /api/loyalty/login|login-phone|register set `loyalty_at` (path /api/loyalty); /api/loyalty/logout clears it.
- Credentials: /app/memory/test_credentials.md
