// Saves every table to JSON files on your computer.
// Run from the Backend folder:  node scripts/backup.js
// Needs SUPABASE_URL and SUPABASE_SECRET_KEY set in your terminal for this session only.
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) {
  console.error('Set SUPABASE_URL and SUPABASE_SECRET_KEY in this terminal first.');
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

const TABLES = [
  'users', 'clients', 'briefs', 'properties', 'property_media', 'property_activity',
  'clusters', 'cluster_suburbs', 'messages', 'chat_reads'
];
const ORDER = { chat_reads: ['last_read_at', 'user_id', 'property_id'] };
const PAGE = 1000;

async function dump(table) {
  const rows = [];
  for (let from = 0; ; from += PAGE) {
    let query = supabase.from(table).select('*');
    for (const column of ORDER[table] || ['created_at', 'id']) query = query.order(column);
    const { data, error } = await query.range(from, from + PAGE - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...data);
    if (data.length < PAGE) break;
  }
  return rows;
}

(async () => {
  const stamp = new Date().toISOString().slice(0, 10);
  const dir = path.join(__dirname, '..', '..', 'backups', `backup-${stamp}`);
  fs.mkdirSync(dir, { recursive: true });

  for (const table of TABLES) {
    const rows = await dump(table);
    fs.writeFileSync(path.join(dir, `${table}.json`), JSON.stringify(rows, null, 2));
    console.log(`${table}: ${rows.length} rows`);
  }
  console.log(`\nSaved to ${dir}`);
  console.log('Photos, videos and chat files in Storage are NOT included in this backup.');
})().catch((e) => {
  console.error('Backup failed:', e.message);
  process.exit(1);
});