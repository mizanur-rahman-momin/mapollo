const fs = require('fs')
const { Client } = require('pg')

const REF = 'uqrddozljtxgiywqwqbr'
const PASSWORD = process.env.DBPW
const sql = fs.readFileSync('/app/supabase_schema.sql', 'utf8')

const regions = [
  'us-east-1','us-east-2','us-west-1','us-west-2','ca-central-1','sa-east-1',
  'eu-west-1','eu-west-2','eu-west-3','eu-central-1','eu-central-2','eu-north-1',
  'ap-south-1','ap-southeast-1','ap-southeast-2','ap-northeast-1','ap-northeast-2',
]
const prefixes = ['aws-0','aws-1']

async function tryHost(host, port) {
  const client = new Client({
    host, port, user: `postgres.${REF}`, password: PASSWORD,
    database: 'postgres', ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 7000,
  })
  await client.connect()
  await client.query(sql)
  const r = await client.query('select count(*) from public.contacts')
  await client.end()
  return r.rows[0].count
}

;(async () => {
  for (const pre of prefixes) {
    for (const region of regions) {
      const host = `${pre}-${region}.pooler.supabase.com`
      try {
        const count = await tryHost(host, 5432)
        console.log(`SUCCESS host=${host} port=5432 count=${count}`)
        process.exit(0)
      } catch (e) {
        const msg = String(e.message)
        // Only log meaningful (right-region) errors, skip DNS/tenant-not-found noise
        if (!/ENOTFOUND|not found|getaddrinfo|Tenant or user not found/i.test(msg)) {
          console.log(`NOTE host=${host}: ${msg}`)
        }
      }
    }
  }
  console.error('NO REGION MATCHED')
  process.exit(1)
})()
