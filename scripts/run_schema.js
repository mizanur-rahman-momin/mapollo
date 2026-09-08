const fs = require('fs')
const { Client } = require('pg')

const REF = 'uqrddozljtxgiywqwqbr'
const PASSWORD = process.env.DBPW
const sql = fs.readFileSync('/app/supabase_schema.sql', 'utf8')

const candidates = [
  { name: 'direct', host: `db.${REF}.supabase.co`, port: 5432, user: 'postgres' },
  { name: 'pooler-us-east-1', host: 'aws-0-us-east-1.pooler.supabase.com', port: 5432, user: `postgres.${REF}` },
  { name: 'pooler-us-west-1', host: 'aws-0-us-west-1.pooler.supabase.com', port: 5432, user: `postgres.${REF}` },
  { name: 'pooler-eu-central-1', host: 'aws-0-eu-central-1.pooler.supabase.com', port: 5432, user: `postgres.${REF}` },
  { name: 'pooler-ap-southeast-1', host: 'aws-0-ap-southeast-1.pooler.supabase.com', port: 5432, user: `postgres.${REF}` },
  { name: 'pooler-ap-south-1', host: 'aws-0-ap-south-1.pooler.supabase.com', port: 5432, user: `postgres.${REF}` },
]

async function tryOne(c) {
  const client = new Client({
    host: c.host, port: c.port, user: c.user, password: PASSWORD,
    database: 'postgres', ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  })
  await client.connect()
  await client.query(sql)
  const r = await client.query("select count(*) from public.contacts")
  await client.end()
  return r.rows[0].count
}

;(async () => {
  for (const c of candidates) {
    try {
      process.stdout.write(`Trying ${c.name} (${c.host})... `)
      const count = await tryOne(c)
      console.log(`SUCCESS. contacts table ready. row count=${count}`)
      process.exit(0)
    } catch (e) {
      console.log(`failed: ${e.message}`)
    }
  }
  console.error('ALL CONNECTION ATTEMPTS FAILED')
  process.exit(1)
})()
