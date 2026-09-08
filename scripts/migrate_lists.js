const fs = require('fs')
const { Client } = require('pg')

const REF = 'uqrddozljtxgiywqwqbr'
const PASSWORD = process.env.DBPW
const sql = fs.readFileSync('/app/supabase_lists_migration.sql', 'utf8')
const host = 'aws-0-ap-northeast-1.pooler.supabase.com'

;(async () => {
  const client = new Client({
    host, port: 5432, user: `postgres.${REF}`, password: PASSWORD,
    database: 'postgres', ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000,
  })
  await client.connect()
  await client.query(sql)
  const c = await client.query("select column_name from information_schema.columns where table_schema='public' and table_name='contacts' and column_name='lists'")
  const f = await client.query("select proname from pg_proc where proname='add_to_list'")
  console.log('lists column:', c.rowCount ? 'OK' : 'MISSING')
  console.log('add_to_list fn:', f.rowCount ? 'OK' : 'MISSING')
  await client.end()
  process.exit(0)
})().catch((e) => { console.error('MIGRATION FAILED:', e.message); process.exit(1) })
