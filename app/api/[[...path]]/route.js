import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

// Allowed contact columns (excluding id/owner_id/contact_date/custom_fields/created_at)
const COLS = [
  'first_name','last_name','title','email','person_linkedin_url','contact_location',
  'company','company_linkedin_url','employees','industry','company_address','company_street',
  'company_city','company_state','company_country','company_phone','website','open_jobs',
  'date_raw','list_name'
]

function cors(res) {
  res.headers.set('Access-Control-Allow-Origin', process.env.CORS_ORIGINS || '*')
  res.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.headers.set('Access-Control-Allow-Credentials', 'true')
  return res
}

function json(data, status = 200) {
  return cors(NextResponse.json(data, { status }))
}

export async function OPTIONS() {
  return cors(new NextResponse(null, { status: 200 }))
}

function anonClient() {
  return createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
}

function adminClient() {
  return createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
}

function userClient(token) {
  return createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

function getToken(request) {
  const h = request.headers.get('authorization') || ''
  return h.startsWith('Bearer ') ? h.slice(7) : null
}

async function requireUser(request) {
  const token = getToken(request)
  if (!token) return { error: json({ error: 'Unauthorized' }, 401) }
  const sb = userClient(token)
  const { data, error } = await sb.auth.getUser()
  if (error || !data?.user) return { error: json({ error: 'Unauthorized' }, 401) }
  return { user: data.user, sb }
}

// Parse DDMMYYYY (or with separators) -> 'YYYY-MM-DD' or null
function parseDate(raw) {
  if (!raw) return null
  const digits = String(raw).replace(/[^0-9]/g, '')
  if (digits.length !== 8) return null
  const dd = digits.slice(0, 2)
  const mm = digits.slice(2, 4)
  const yyyy = digits.slice(4, 8)
  const d = parseInt(dd, 10), m = parseInt(mm, 10)
  if (d < 1 || d > 31 || m < 1 || m > 12) return null
  return `${yyyy}-${mm}-${dd}`
}

function sanitizeRow(row, ownerId) {
  const out = { owner_id: ownerId }
  for (const c of COLS) {
    if (row[c] !== undefined && row[c] !== null && String(row[c]).trim() !== '') {
      out[c] = String(row[c])
    }
  }
  out.contact_date = parseDate(out.date_raw)
  out.lists = out.list_name ? [out.list_name] : []
  const cf = row.custom_fields
  out.custom_fields = cf && typeof cf === 'object' && !Array.isArray(cf) ? cf : {}
  return out
}

function applyFilters(query, sp) {
  const search = sp.get('search')
  const title = sp.get('title')
  const location = sp.get('location')
  const country = sp.get('country')
  const industry = sp.get('industry')
  const listName = sp.get('list_name')
  const company = sp.get('company')
  const fromDate = parseDate(sp.get('fromDate'))
  const toDate = parseDate(sp.get('toDate'))

  if (search) {
    const s = search.replace(/[,%]/g, ' ')
    query = query.or(
      `first_name.ilike.%${s}%,last_name.ilike.%${s}%,email.ilike.%${s}%,company.ilike.%${s}%,title.ilike.%${s}%`
    )
  }
  if (title) query = query.ilike('title', `%${title}%`)
  if (location) query = query.ilike('contact_location', `%${location}%`)
  if (company) query = query.ilike('company', `%${company}%`)
  if (country) query = query.eq('company_country', country)
  if (industry) query = query.eq('industry', industry)
  if (listName) query = query.contains('lists', [listName])
  if (fromDate) query = query.gte('contact_date', fromDate)
  if (toDate) query = query.lte('contact_date', toDate)
  return query
}

async function handleRoute(request, { params }) {
  const { path = [] } = await params
  const route = `/${(path || []).join('/')}`
  const method = request.method

  try {
    if (!SUPABASE_URL || !ANON_KEY) {
      return json({ error: 'Supabase env not configured' }, 500)
    }

    // ---------- AUTH ----------
    if (route === '/auth/signup' && method === 'POST') {
      const { email, password } = await request.json()
      if (!email || !password) return json({ error: 'email and password required' }, 400)
      // Create an auto-confirmed user via the admin API so login works immediately.
      const admin = adminClient()
      const { error: cErr } = await admin.auth.admin.createUser({ email, password, email_confirm: true })
      if (cErr && !/already|registered|exists/i.test(cErr.message)) {
        return json({ error: cErr.message }, 400)
      }
      const sb = anonClient()
      const { data, error } = await sb.auth.signInWithPassword({ email, password })
      if (error) {
        if (cErr) return json({ error: 'An account with this email already exists. Please sign in.' }, 400)
        return json({ error: error.message }, 400)
      }
      return json({ session: data.session, user: data.user })
    }

    if (route === '/auth/login' && method === 'POST') {
      const { email, password } = await request.json()
      if (!email || !password) return json({ error: 'email and password required' }, 400)
      const sb = anonClient()
      const { data, error } = await sb.auth.signInWithPassword({ email, password })
      if (error) return json({ error: error.message }, 400)
      return json({ session: data.session, user: data.user })
    }

    if (route === '/auth/refresh' && method === 'POST') {
      const { refresh_token } = await request.json()
      if (!refresh_token) return json({ error: 'refresh_token required' }, 400)
      const sb = anonClient()
      const { data, error } = await sb.auth.refreshSession({ refresh_token })
      if (error) return json({ error: error.message }, 400)
      return json({ session: data.session, user: data.user })
    }

    // ---------- HEALTH ----------
    if (route === '/health' && method === 'GET') {
      const sb = anonClient()
      const { error } = await sb.from('contacts').select('id', { head: true, count: 'exact' }).limit(1)
      return json({ ok: !error, table: error ? 'missing_or_error' : 'ok', detail: error?.message || null })
    }

    // ---------- CONTACTS ----------
    if (route === '/contacts/facets' && method === 'GET') {
      const auth = await requireUser(request)
      if (auth.error) return auth.error
      const { data, error } = await auth.sb
        .from('contacts')
        .select('company_country, industry, list_name, lists')
        .limit(10000)
      if (error) return json({ error: error.message }, 400)
      const uniq = (key) => Array.from(new Set((data || []).map(r => r[key]).filter(v => v && String(v).trim() !== ''))).sort()
      const listSet = new Set()
      ;(data || []).forEach((r) => {
        if (r.list_name && String(r.list_name).trim() !== '') listSet.add(r.list_name)
        if (Array.isArray(r.lists)) r.lists.forEach((l) => { if (l && String(l).trim() !== '') listSet.add(l) })
      })
      return json({
        countries: uniq('company_country'),
        industries: uniq('industry'),
        lists: Array.from(listSet).sort(),
      })
    }

    if (route === '/contacts/ids' && method === 'GET') {
      const auth = await requireUser(request)
      if (auth.error) return auth.error
      const sp = new URL(request.url).searchParams
      const all = []
      const batch = 1000
      let from = 0
      const MAX = 50000
      while (from < MAX) {
        let q = auth.sb.from('contacts').select('id')
          .order('created_at', { ascending: false }).order('id', { ascending: false })
        q = applyFilters(q, sp)
        const { data, error } = await q.range(from, from + batch - 1)
        if (error) return json({ error: error.message }, 400)
        all.push(...(data || []).map((r) => r.id))
        if (!data || data.length < batch) break
        from += batch
      }
      return json({ ids: all, count: all.length })
    }

    if (route === '/contacts/assign-list' && method === 'POST') {
      const auth = await requireUser(request)
      if (auth.error) return auth.error
      const body = await request.json()
      const ids = Array.isArray(body?.ids) ? body.ids : []
      const listName = String(body?.list_name || '').trim()
      if (!ids.length) return json({ error: 'ids required' }, 400)
      if (!listName) return json({ error: 'list_name required' }, 400)
      const { data, error } = await auth.sb.rpc('add_to_list', { p_ids: ids, p_list: listName })
      if (error) return json({ error: error.message }, 400)
      return json({ updated: data ?? ids.length, list_name: listName })
    }

    if (route === '/contacts/export' && method === 'GET') {
      const auth = await requireUser(request)
      if (auth.error) return auth.error
      const sp = new URL(request.url).searchParams
      const all = []
      const batch = 1000
      let from = 0
      const MAX = 50000
      while (from < MAX) {
        let q = auth.sb.from('contacts').select('*')
          .order('created_at', { ascending: false }).order('id', { ascending: false })
        q = applyFilters(q, sp)
        const { data, error } = await q.range(from, from + batch - 1)
        if (error) return json({ error: error.message }, 400)
        all.push(...(data || []))
        if (!data || data.length < batch) break
        from += batch
      }
      return json({ data: all, count: all.length })
    }

    if (route === '/contacts' && method === 'GET') {
      const auth = await requireUser(request)
      if (auth.error) return auth.error
      const sp = new URL(request.url).searchParams
      const pageSize = Math.min(Math.max(parseInt(sp.get('pageSize') || '50', 10), 1), 100)
      const page = Math.max(parseInt(sp.get('page') || '1', 10), 1)
      const fromIdx = (page - 1) * pageSize
      const toIdx = fromIdx + pageSize - 1
      let q = auth.sb.from('contacts').select('*', { count: 'exact' })
        .order('created_at', { ascending: false }).order('id', { ascending: false })
      q = applyFilters(q, sp)
      const { data, count, error } = await q.range(fromIdx, toIdx)
      if (error) return json({ error: error.message }, 400)
      return json({ data: data || [], count: count || 0, page, pageSize })
    }

    if (route === '/contacts' && method === 'POST') {
      const auth = await requireUser(request)
      if (auth.error) return auth.error
      const body = await request.json()
      const row = sanitizeRow(body || {}, auth.user.id)
      const { data, error } = await auth.sb.from('contacts').insert(row).select().single()
      if (error) return json({ error: error.message }, 400)
      return json({ data })
    }

    if (route === '/contacts/bulk' && method === 'POST') {
      const auth = await requireUser(request)
      if (auth.error) return auth.error
      const body = await request.json()
      const rows = Array.isArray(body?.rows) ? body.rows : []
      if (rows.length === 0) return json({ error: 'No rows provided' }, 400)
      const prepared = rows.map(r => sanitizeRow(r, auth.user.id))
      let inserted = 0
      for (let i = 0; i < prepared.length; i += 500) {
        const slice = prepared.slice(i, i + 500)
        const { error } = await auth.sb.from('contacts').insert(slice)
        if (error) return json({ error: error.message, insertedBefore: inserted }, 400)
        inserted += slice.length
      }
      return json({ inserted })
    }

    if (route.startsWith('/contacts/') && method === 'DELETE') {
      const auth = await requireUser(request)
      if (auth.error) return auth.error
      const id = path[1]
      if (!id) return json({ error: 'id required' }, 400)
      const { error } = await auth.sb.from('contacts').delete().eq('id', id)
      if (error) return json({ error: error.message }, 400)
      return json({ ok: true })
    }

    if (route === '/contacts' && method === 'DELETE') {
      const auth = await requireUser(request)
      if (auth.error) return auth.error
      const body = await request.json().catch(() => ({}))
      const ids = Array.isArray(body?.ids) ? body.ids : []
      if (ids.length === 0) return json({ error: 'ids required' }, 400)
      const { error } = await auth.sb.from('contacts').delete().in('id', ids)
      if (error) return json({ error: error.message }, 400)
      return json({ ok: true, deleted: ids.length })
    }

    return json({ error: `Route ${route} not found` }, 404)
  } catch (err) {
    console.error('API Error:', err)
    return json({ error: 'Internal server error', detail: String(err?.message || err) }, 500)
  }
}

export const GET = handleRoute
export const POST = handleRoute
export const PUT = handleRoute
export const DELETE = handleRoute
export const PATCH = handleRoute
