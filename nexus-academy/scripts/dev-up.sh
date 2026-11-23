#!/usr/bin/env bash
# Levanta el entorno local completo: Docker, Supabase y el servidor de Next.js.
# Uso: bash scripts/dev-up.sh   (idempotente; seguro de repetir)
set -euo pipefail
cd "$(dirname "$0")/.."

start_docker() {
  (nohup dockerd > /tmp/dockerd.log 2>&1 &)
  for _ in $(seq 1 40); do docker info >/dev/null 2>&1 && return 0; sleep 1; done
  return 1
}
if ! docker info >/dev/null 2>&1; then
  # Tras un reinicio, containerd a veces no arranca a tiempo: se reintenta limpio.
  start_docker || { pkill -f containerd 2>/dev/null || true; sleep 1; start_docker; } || { echo "No se pudo iniciar Docker (ver /tmp/dockerd.log)" >&2; exit 1; }
fi

# Tras reiniciar el contenedor, el primer arranque puede fallar porque un puerto
# aún no se libera; se reintenta unas veces.
for attempt in 1 2 3; do
  if npx supabase start -x studio,edge-runtime,logflare,vector,realtime,imgproxy,postgres-meta,supavisor >/tmp/supabase-start.log 2>&1; then
    break
  fi
  echo "supabase start falló (intento $attempt); reintentando…" >&2
  sleep 5
done
supabase_ok=0
for _ in $(seq 1 60); do
  code=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:54321/rest/v1/ -H "apikey: x" || true)
  if [[ "$code" == "200" || "$code" == "401" ]]; then supabase_ok=1; break; fi
  sleep 3
done
if [[ "$supabase_ok" != "1" ]]; then
  echo "Supabase no responde (ver /tmp/supabase-start.log)" >&2
  exit 1
fi

if [[ ! -f .env.local ]]; then
  eval "$(npx supabase status -o env 2>/dev/null | grep -E '^(API_URL|ANON_KEY|SERVICE_ROLE_KEY)=')"
  cat > .env.local <<ENV
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=$API_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=$ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY
CRON_SECRET=$(openssl rand -hex 24)
UNSUBSCRIBE_SECRET=$(openssl rand -hex 24)
ENV
fi

if [[ "${START_NEXT:-1}" == "1" ]] && ! curl -s -o /dev/null http://localhost:3000/ 2>/dev/null; then
  (nohup npx next dev -p 3000 > /tmp/next-dev.log 2>&1 &)
  for _ in $(seq 1 60); do curl -s -o /dev/null http://localhost:3000/ && break; sleep 2; done
fi
echo "Entorno listo: Supabase http://127.0.0.1:54321 · Next http://localhost:3000 · Correo de pruebas http://127.0.0.1:54324"
