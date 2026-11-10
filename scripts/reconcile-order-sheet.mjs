#!/usr/bin/env node
// Compara referencias de vitalia_orders con la planilla y avisa las que faltan.
// Solo lee. No escribe pedidos, no manda WhatsApp y no usa una base remota.
// Sin GOOGLE_ORDERS_SHEET_ID y una cuenta de servicio, no compara y sale 0.
//
//   node scripts/reconcile-order-sheet.mjs
//   VITALIA_ISOLATED_DATABASE_URL=postgres://127.0.0.1/vitalia_code_test node scripts/reconcile-order-sheet.mjs

import {spawn} from 'node:child_process';
import {assertIsolatedDatabase, logMissingSheetRefs, missingOrderRefs, readSheetCells, sheetReadConfigured} from '../lib/orders.js';

const databaseUrl = process.env.VITALIA_ISOLATED_DATABASE_URL || '';
try {
  assertIsolatedDatabase(databaseUrl);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

if (!sheetReadConfigured()) {
  console.log('Planilla no configurada: no se compara y no se escribe nada.');
  process.exit(0);
}

function refsFromDatabase() {
  const command = databaseUrl
    ? ['psql', [databaseUrl, '-v', 'ON_ERROR_STOP=1', '-q', '-t', '-A', '-c', 'select ref from public.vitalia_orders order by id']]
    : ['sudo', ['-u', 'postgres', 'psql', '-d', 'vitalia_code_test', '-v', 'ON_ERROR_STOP=1', '-q', '-t', '-A', '-c', 'select ref from public.vitalia_orders order by id']];
  return new Promise((resolve, reject) => {
    const child = spawn(command[0], command[1], {stdio: ['ignore', 'pipe', 'pipe']});
    let out = '', err = '';
    child.stdout.on('data', chunk => { out += chunk; });
    child.stderr.on('data', chunk => { err += chunk; });
    child.on('close', code => code ? reject(new Error(err || out)) : resolve(out.trim().split('\n').filter(Boolean)));
  });
}

const refs = await refsFromDatabase();
const cells = await readSheetCells();
const missing = missingOrderRefs(refs, cells);
if (!missing.length) {
  console.log(`Planilla al día: ${refs.length} pedidos.`);
  process.exit(0);
}
logMissingSheetRefs(missing);
process.exit(1);
