# Frontend React (build statis) + Caddy. Dibangun dari root repo: `docker compose build web`.
FROM node:20-alpine AS build
WORKDIR /src
COPY frontend/package.json ./
RUN yarn install --non-interactive --network-timeout 600000
COPY frontend/ ./
# Kosong = same-origin: browser memanggil /api di domain yang sama, Caddy meneruskannya ke backend.
# (Backend menolak simpan data dari origin lain — CSRF_ORIGIN_MISMATCH.)
ENV REACT_APP_BACKEND_URL="" \
    GENERATE_SOURCEMAP=false \
    NODE_OPTIONS=--max-old-space-size=4096
RUN yarn build

FROM caddy:2.8-alpine
COPY deploy/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /src/build /srv/www
