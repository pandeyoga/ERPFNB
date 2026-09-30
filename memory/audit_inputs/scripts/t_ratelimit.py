import os, sys
sys.path.insert(0, os.environ.get('ERP_BACKEND', os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'backend')))
from fastapi import FastAPI
from fastapi.testclient import TestClient
from core.middleware import RateLimitMiddleware
from core.rate_limiter import RateLimiter
lim = RateLimiter(); lim.configure("login", limit=3, window_sec=60)
app = FastAPI(); app.add_middleware(RateLimitMiddleware, limiter=lim)
@app.post("/api/auth/login")
async def login(): return {"ok": True}
c = TestClient(app)
normal = [c.post("/api/auth/login", headers={"x-forwarded-for":"10.0.0.9"}).status_code for _ in range(6)]
spoof_rot = [c.post("/api/auth/login", headers={"x-forwarded-for":f"10.1.0.{i}"}).status_code for i in range(6)]
spoof_lo = [c.post("/api/auth/login", headers={"x-forwarded-for":"127.0.0.1"}).status_code for _ in range(6)]
print("same IP (limit 3):", normal); print("rotating X-Forwarded-For:", spoof_rot); print("X-Forwarded-For: 127.0.0.1:", spoof_lo)
