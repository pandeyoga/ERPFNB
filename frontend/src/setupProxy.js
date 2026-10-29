/**
 * Proxy dev server (hanya `yarn start`) — untuk menjalankan ERP di komputer lokal.
 *
 * Dengan REACT_APP_BACKEND_URL kosong, frontend memanggil /api relatif ke localhost:3000;
 * proxy ini meneruskannya ke backend (default http://localhost:8001). Browser hanya melihat
 * satu origin, sehingga cookie login dan cek CSRF same-origin backend tetap lolos:
 * xfwd mengirim X-Forwarded-Host = localhost:3000, yang dibandingkan dengan header Origin.
 *
 * Di deployment, /api dirutekan ingress langsung ke backend — file ini tidak dipakai.
 */
const { createProxyMiddleware } = require("http-proxy-middleware");

const target = process.env.LOCAL_BACKEND_URL || "http://localhost:8001";

module.exports = function setupProxy(app) {
  app.use(createProxyMiddleware(["/api", "/uploads"], { target, xfwd: true, ws: true, logLevel: "warn" }));
};
