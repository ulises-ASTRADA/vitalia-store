#!/usr/bin/env bash
# Cupón contra Postgres y PostgREST locales. No llama a Supabase, preview ni producción.
# Verificado con Node 24.22.2, PostgreSQL 16.15 y PostgREST 12.2.12.
# Los mocks y jsdom son otras suites: `npm test` incluye tests/code-retry.test.mjs;
# `npm run test:ui` corre tests/ui.test.jsx. Este script corre solo tests/code-order-db.test.mjs.
set -euo pipefail
cd "$(dirname "$0")/.."
if [[ -d "${HOME}/.nvm/versions/node" ]]; then
  node24="$(find "${HOME}/.nvm/versions/node" -maxdepth 1 -type d -name 'v24.*' | sort | tail -1 || true)"
  if [[ -n "${node24}" ]]; then export PATH="${node24}/bin:${PATH}"; fi
fi
echo "node $(node -v)"
node -e "if (Number(process.versions.node.split('.')[0]) !== 24) { console.error('Hace falta Node 24.x'); process.exit(1); }"
psql --version
if ! sudo -u postgres psql -tAc "select 1 from pg_database where datname = 'vitalia_code_test'" | grep -q 1; then
  sudo -u postgres createdb vitalia_code_test
fi
bin="${POSTGREST_BIN:-/tmp/postgrest/postgrest}"
if [[ ! -x "${bin}" ]]; then
  mkdir -p /tmp/postgrest
  archive="$(mktemp)"
  curl -fsSL -o "${archive}" https://github.com/PostgREST/postgrest/releases/download/v12.2.12/postgrest-v12.2.12-linux-static-x86-64.tar.xz
  tar -C /tmp/postgrest -xJf "${archive}"
  rm -f "${archive}"
  bin=/tmp/postgrest/postgrest
fi
"${bin}" --version
export POSTGREST_BIN="${bin}"
node --test tests/code-order-db.test.mjs
node scripts/reconcile-order-sheet.mjs
