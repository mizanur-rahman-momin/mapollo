'use client'

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from '@/components/ui/dropdown-menu'
import {
  Upload, Download, Search, Filter, Trash2, Plus, LogOut, Users, Loader2,
  ChevronLeft, ChevronRight, Linkedin, Globe, FileSpreadsheet, CheckCircle2,
} from 'lucide-react'

// ---------- Field definitions (internal_key, CSV header label) ----------
const FIELDS = [
  ['first_name', 'First Name'],
  ['last_name', 'Last Name'],
  ['title', 'Title'],
  ['email', 'Email'],
  ['person_linkedin_url', 'Person Linkedin Url'],
  ['contact_location', 'Contact Location'],
  ['company', 'Company'],
  ['company_linkedin_url', 'Company Linkedin Url'],
  ['employees', 'Employees'],
  ['industry', 'Industry'],
  ['company_address', 'Company Address'],
  ['company_street', 'Company Street'],
  ['company_city', 'Company City'],
  ['company_state', 'Company State'],
  ['company_country', 'Company Country'],
  ['company_phone', 'Company Phone'],
  ['website', 'Website'],
  ['open_jobs', 'Open Jobs'],
  ['date_raw', 'Date'],
  ['list_name', 'List Name'],
]

const HEADER_LABELS = FIELDS.map((f) => f[1])
const normalize = (s) => String(s || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
const NORM_TO_FIELD = {}
FIELDS.forEach(([key, label]) => { NORM_TO_FIELD[normalize(label)] = key })
// a couple of friendly aliases
NORM_TO_FIELD[normalize('Phone')] = 'company_phone'
NORM_TO_FIELD[normalize('Person Linkedin')] = 'person_linkedin_url'
NORM_TO_FIELD[normalize('Linkedin Url')] = 'person_linkedin_url'
NORM_TO_FIELD[normalize('Country')] = 'company_country'
NORM_TO_FIELD[normalize('City')] = 'company_city'
NORM_TO_FIELD[normalize('State')] = 'company_state'

const SESSION_KEY = 'mapollo_session'

// format a stored contact date to DDMMYYYY for display
function displayDate(r) {
  if (r.date_raw) return r.date_raw
  if (r.contact_date) {
    const [y, m, d] = String(r.contact_date).split('-')
    if (y && m && d) return `${d}${m}${y}`
  }
  return ''
}

function download(filename, content, mime) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

function csvEscape(v) {
  const s = v == null ? '' : String(v)
  if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"'
  return s
}

// Build header + records array (in official order + discovered custom fields)
function rowsToRecords(rows) {
  const customKeys = []
  const seen = new Set()
  rows.forEach((r) => {
    Object.keys(r.custom_fields || {}).forEach((k) => {
      if (!seen.has(k)) { seen.add(k); customKeys.push(k) }
    })
  })
  const headers = [...HEADER_LABELS, ...customKeys]
  const records = rows.map((r) => {
    const rec = []
    FIELDS.forEach(([field]) => {
      rec.push(field === 'date_raw' ? displayDate(r) : (r[field] ?? ''))
    })
    customKeys.forEach((k) => rec.push((r.custom_fields || {})[k] ?? ''))
    return rec
  })
  return { headers, records }
}

export default function App() {
  const [session, setSession] = useState(null)
  const [booting, setBooting] = useState(true)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SESSION_KEY)
      if (raw) setSession(JSON.parse(raw))
    } catch {}
    setBooting(false)
  }, [])

  const saveSession = (s) => {
    setSession(s)
    localStorage.setItem(SESSION_KEY, JSON.stringify(s))
  }
  const logout = () => {
    setSession(null)
    localStorage.removeItem(SESSION_KEY)
  }

  if (booting) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!session) return <AuthScreen onAuthed={saveSession} />
  return <Dashboard session={session} logout={logout} />
}

// ============================ AUTH ============================
function AuthScreen({ onAuthed }) {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    if (!email || !password) return
    setLoading(true)
    try {
      const res = await fetch(`/api/auth/${mode === 'login' ? 'login' : 'signup'}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Something went wrong')
      if (data.needsConfirmation) {
        toast.info(data.message || 'Please confirm your email, then log in.')
        setMode('login')
        return
      }
      if (!data.session) throw new Error('No session returned')
      toast.success(mode === 'login' ? 'Welcome back!' : 'Account created!')
      onAuthed(data.session)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
      {/* Brand panel */}
      <div className="hidden lg:flex flex-col justify-between bg-gradient-to-br from-violet-600 via-indigo-600 to-blue-700 p-12 text-white">
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 backdrop-blur">
            <Users className="h-6 w-6" />
          </div>
          <span className="text-2xl font-bold tracking-tight">mapollo</span>
        </div>
        <div className="space-y-4">
          <h1 className="text-4xl font-bold leading-tight">Your leads, beautifully organized.</h1>
          <p className="text-lg text-white/80 max-w-md">
            Import contacts from CSV or Excel, filter by title, location, country and date,
            then export exactly what you need.
          </p>
          <div className="flex flex-wrap gap-2 pt-2">
            {['CSV & Excel import', 'Smart filters', 'One-click export', 'Custom fields'].map((t) => (
              <span key={t} className="rounded-full bg-white/15 px-3 py-1 text-sm">{t}</span>
            ))}
          </div>
        </div>
        <p className="text-sm text-white/60">A lightweight Apollo alternative.</p>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center p-6">
        <Card className="w-full max-w-md p-8">
          <div className="lg:hidden mb-6 flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-white">
              <Users className="h-5 w-5" />
            </div>
            <span className="text-xl font-bold">mapollo</span>
          </div>
          <h2 className="text-2xl font-bold">{mode === 'login' ? 'Sign in' : 'Create your account'}</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {mode === 'login' ? 'Enter your credentials to access your contacts.' : 'Set an email and password to get started.'}
          </p>
          <form onSubmit={submit} className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="********" required />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {mode === 'login' ? 'Sign in' : 'Sign up'}
            </Button>
          </form>
          <p className="mt-6 text-center text-sm text-muted-foreground">
            {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
            <button className="font-semibold text-indigo-600 hover:underline" onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}>
              {mode === 'login' ? 'Sign up' : 'Sign in'}
            </button>
          </p>
        </Card>
      </div>
    </div>
  )
}

// ============================ DASHBOARD ============================
const EMPTY_FILTERS = { search: '', title: '', location: '', company: '', country: '__all__', industry: '__all__', list_name: '__all__', fromDate: '', toDate: '' }

function Dashboard({ session, logout }) {
  const [contacts, setContacts] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [loading, setLoading] = useState(false)
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [reloadToken, setReloadToken] = useState(0)
  const [facets, setFacets] = useState({ countries: [], industries: [], lists: [] })
  const [importOpen, setImportOpen] = useState(false)
  const [addOpen, setAddOpen] = useState(false)

  const api = useCallback(async (path, opts = {}) => {
    const { method = 'GET', body } = opts
    const res = await fetch(`/api${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    })
    const data = await res.json().catch(() => ({}))
    if (res.status === 401) {
      toast.error('Session expired. Please sign in again.')
      logout()
      throw new Error('Unauthorized')
    }
    if (!res.ok) throw new Error(data.error || 'Request failed')
    return data
  }, [session, logout])

  const buildQuery = useCallback((forPagination) => {
    const p = new URLSearchParams()
    if (filters.search) p.set('search', filters.search)
    if (filters.title) p.set('title', filters.title)
    if (filters.location) p.set('location', filters.location)
    if (filters.company) p.set('company', filters.company)
    if (filters.country !== '__all__') p.set('country', filters.country)
    if (filters.industry !== '__all__') p.set('industry', filters.industry)
    if (filters.list_name !== '__all__') p.set('list_name', filters.list_name)
    if (filters.fromDate) p.set('fromDate', filters.fromDate)
    if (filters.toDate) p.set('toDate', filters.toDate)
    if (forPagination) { p.set('page', String(page)); p.set('pageSize', String(pageSize)) }
    return p.toString()
  }, [filters, page, pageSize])

  const fetchContacts = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api(`/contacts?${buildQuery(true)}`)
      setContacts(data.data || [])
      setTotal(data.count || 0)
    } catch (err) {
      if (err.message !== 'Unauthorized') toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }, [api, buildQuery])

  const fetchFacets = useCallback(async () => {
    try {
      const data = await api('/contacts/facets')
      setFacets({ countries: data.countries || [], industries: data.industries || [], lists: data.lists || [] })
    } catch {}
  }, [api])

  useEffect(() => { fetchContacts() }, [page, pageSize, reloadToken]) // eslint-disable-line
  useEffect(() => { fetchFacets() }, []) // eslint-disable-line

  const applyFilters = () => { setPage(1); setReloadToken((t) => t + 1) }
  const clearFilters = () => { setFilters(EMPTY_FILTERS); setPage(1); setReloadToken((t) => t + 1) }

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const doExport = async (format) => {
    const t = toast.loading('Preparing export...')
    try {
      const data = await api(`/contacts/export?${buildQuery(false)}`)
      const rows = data.data || []
      if (rows.length === 0) { toast.dismiss(t); toast.info('No contacts to export.'); return }
      const { headers, records } = rowsToRecords(rows)
      if (format === 'csv') {
        const lines = [headers.map(csvEscape).join(',')]
        records.forEach((rec) => lines.push(rec.map(csvEscape).join(',')))
        download('mapollo_contacts.csv', lines.join('\n'), 'text/csv;charset=utf-8;')
      } else {
        const aoa = [headers, ...records]
        const ws = XLSX.utils.aoa_to_sheet(aoa)
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, 'Contacts')
        XLSX.writeFile(wb, 'mapollo_contacts.xlsx')
      }
      toast.dismiss(t)
      toast.success(`Exported ${rows.length} contacts`)
    } catch (err) {
      toast.dismiss(t)
      if (err.message !== 'Unauthorized') toast.error(err.message)
    }
  }

  const onImported = (count) => {
    setImportOpen(false)
    toast.success(`Imported ${count} contacts`)
    fetchFacets()
    setPage(1); setReloadToken((t) => t + 1)
  }

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Top bar */}
      <header className="sticky top-0 z-20 border-b bg-background">
        <div className="flex h-14 items-center justify-between px-4 lg:px-6">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white">
              <Users className="h-5 w-5" />
            </div>
            <span className="text-lg font-bold tracking-tight">mapollo</span>
            <Badge variant="secondary" className="ml-1 hidden sm:inline-flex">{total.toLocaleString()} contacts</Badge>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden sm:block text-sm text-muted-foreground max-w-[180px] truncate">{session.user?.email}</span>
            <Button variant="ghost" size="sm" onClick={logout}>
              <LogOut className="h-4 w-4 mr-1" /> Logout
            </Button>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Filters sidebar */}
        <aside className="hidden lg:block w-72 shrink-0 border-r bg-background min-h-[calc(100vh-3.5rem)] p-4">
          <FilterPanel filters={filters} setFilters={setFilters} facets={facets} onApply={applyFilters} onClear={clearFilters} />
        </aside>

        {/* Main */}
        <main className="flex-1 min-w-0 p-4 lg:p-6 space-y-4">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search name, email, company, title..."
                value={filters.search}
                onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
                onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
              />
            </div>
            <Button variant="outline" onClick={applyFilters}><Filter className="h-4 w-4 mr-1" /> Apply</Button>
            <Button onClick={() => setAddOpen(true)} variant="outline"><Plus className="h-4 w-4 mr-1" /> Add</Button>
            <Button onClick={() => setImportOpen(true)}><Upload className="h-4 w-4 mr-1" /> Import</Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline"><Download className="h-4 w-4 mr-1" /> Export</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => doExport('csv')}>Export as CSV</DropdownMenuItem>
                <DropdownMenuItem onClick={() => doExport('xlsx')}>Export as Excel</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Mobile filters */}
          <div className="lg:hidden">
            <Card className="p-4">
              <FilterPanel filters={filters} setFilters={setFilters} facets={facets} onApply={applyFilters} onClear={clearFilters} />
            </Card>
          </div>

          {/* Table */}
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-muted-foreground">
                  <tr className="[&>th]:px-3 [&>th]:py-2.5 [&>th]:text-left [&>th]:font-medium [&>th]:whitespace-nowrap">
                    <th>Name</th>
                    <th>Title</th>
                    <th>Email</th>
                    <th>Company</th>
                    <th>Industry</th>
                    <th>Location</th>
                    <th>Country</th>
                    <th>Phone</th>
                    <th>Employees</th>
                    <th>Open Jobs</th>
                    <th>List</th>
                    <th>Date</th>
                    <th>Links</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={14} className="px-3 py-16 text-center text-muted-foreground">
                      <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                    </td></tr>
                  ) : contacts.length === 0 ? (
                    <tr><td colSpan={14} className="px-3 py-16 text-center">
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <Users className="h-8 w-8 opacity-40" />
                        <p className="font-medium">No contacts found</p>
                        <p className="text-xs">Import a CSV/Excel file or add a contact to get started.</p>
                        <Button size="sm" className="mt-2" onClick={() => setImportOpen(true)}><Upload className="h-4 w-4 mr-1" /> Import contacts</Button>
                      </div>
                    </td></tr>
                  ) : contacts.map((c) => (
                    <tr key={c.id} className="border-t hover:bg-muted/40 [&>td]:px-3 [&>td]:py-2.5 [&>td]:whitespace-nowrap">
                      <td className="font-medium">
                        {[c.first_name, c.last_name].filter(Boolean).join(' ') || '\u2014'}
                      </td>
                      <td className="max-w-[200px] truncate" title={c.title}>{c.title || '\u2014'}</td>
                      <td className="text-indigo-600">{c.email || '\u2014'}</td>
                      <td className="max-w-[180px] truncate" title={c.company}>{c.company || '\u2014'}</td>
                      <td className="max-w-[140px] truncate" title={c.industry}>{c.industry || '\u2014'}</td>
                      <td className="max-w-[160px] truncate" title={c.contact_location}>{c.contact_location || '\u2014'}</td>
                      <td>{c.company_country || '\u2014'}</td>
                      <td>{c.company_phone || '\u2014'}</td>
                      <td>{c.employees || '\u2014'}</td>
                      <td>{c.open_jobs || '\u2014'}</td>
                      <td>{c.list_name ? <Badge variant="secondary">{c.list_name}</Badge> : '\u2014'}</td>
                      <td>{displayDate(c) || '\u2014'}</td>
                      <td>
                        <div className="flex items-center gap-2">
                          {c.person_linkedin_url && <a href={c.person_linkedin_url} target="_blank" rel="noreferrer" className="text-[#0A66C2]"><Linkedin className="h-4 w-4" /></a>}
                          {c.website && <a href={c.website.startsWith('http') ? c.website : `https://${c.website}`} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground"><Globe className="h-4 w-4" /></a>}
                        </div>
                      </td>
                      <td>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-red-600"
                          onClick={async () => {
                            try { await api(`/contacts/${c.id}`, { method: 'DELETE' }); toast.success('Deleted'); setReloadToken((t) => t + 1) }
                            catch (e) { if (e.message !== 'Unauthorized') toast.error(e.message) }
                          }}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Pagination */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Rows per page</span>
              <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setPage(1) }}>
                <SelectTrigger className="h-8 w-[80px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <span className="text-muted-foreground">
                {total === 0 ? '0' : `${(page - 1) * pageSize + 1}-${Math.min(page * pageSize, total)}`} of {total.toLocaleString()}
              </span>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="icon" className="h-8 w-8" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}><ChevronLeft className="h-4 w-4" /></Button>
                <span className="px-2">Page {page} / {totalPages}</span>
                <Button variant="outline" size="icon" className="h-8 w-8" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}><ChevronRight className="h-4 w-4" /></Button>
              </div>
            </div>
          </div>
        </main>
      </div>

      <ImportDialog open={importOpen} onOpenChange={setImportOpen} api={api} onImported={onImported} />
      <AddContactDialog open={addOpen} onOpenChange={setAddOpen} api={api} onAdded={() => { setAddOpen(false); toast.success('Contact added'); setReloadToken((t) => t + 1); fetchFacets() }} />
    </div>
  )
}

// ============================ FILTER PANEL ============================
function FilterPanel({ filters, setFilters, facets, onApply, onClear }) {
  const set = (k, v) => setFilters((f) => ({ ...f, [k]: v }))
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2"><Filter className="h-4 w-4" /> Filters</h3>
        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onClear}>Clear</Button>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Title</Label>
        <Input className="h-9" placeholder="e.g. Founder" value={filters.title} onChange={(e) => set('title', e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Company</Label>
        <Input className="h-9" placeholder="e.g. Acme" value={filters.company} onChange={(e) => set('company', e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Location</Label>
        <Input className="h-9" placeholder="e.g. New York" value={filters.location} onChange={(e) => set('location', e.target.value)} />
      </div>
      <FacetSelect label="Country" value={filters.country} onChange={(v) => set('country', v)} options={facets.countries} />
      <FacetSelect label="Industry" value={filters.industry} onChange={(v) => set('industry', v)} options={facets.industries} />
      <FacetSelect label="List Name" value={filters.list_name} onChange={(v) => set('list_name', v)} options={facets.lists} />
      <Separator />
      <div className="space-y-1.5">
        <Label className="text-xs">Date range (DDMMYYYY)</Label>
        <div className="flex gap-2">
          <Input className="h-9" placeholder="From 01012026" value={filters.fromDate} onChange={(e) => set('fromDate', e.target.value)} maxLength={8} />
          <Input className="h-9" placeholder="To 31122026" value={filters.toDate} onChange={(e) => set('toDate', e.target.value)} maxLength={8} />
        </div>
      </div>
      <Button className="w-full" onClick={onApply}>Apply filters</Button>
    </div>
  )
}

function FacetSelect({ label, value, onChange, options }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-9"><SelectValue placeholder={`All ${label.toLowerCase()}`} /></SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">All {label.toLowerCase()}</SelectItem>
          {options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  )
}

// ============================ IMPORT DIALOG ============================
function ImportDialog({ open, onOpenChange, api, onImported }) {
  const [step, setStep] = useState('upload') // upload | map | importing
  const [fileName, setFileName] = useState('')
  const [headers, setHeaders] = useState([])
  const [rows, setRows] = useState([])
  const [mapping, setMapping] = useState({})
  const [progress, setProgress] = useState(0)
  const fileRef = useRef(null)

  const reset = () => { setStep('upload'); setFileName(''); setHeaders([]); setRows([]); setMapping({}); setProgress(0) }

  useEffect(() => { if (!open) reset() }, [open])

  const downloadSample = () => {
    const sample = [
      ['Jane', 'Doe', 'Founder & CEO', 'jane@acme.com', 'https://linkedin.com/in/janedoe', 'New York, USA', 'Acme Inc', 'https://linkedin.com/company/acme', '50-100', 'Software', '123 Market St', 'Market St', 'New York', 'NY', 'United States', '+1 555 100 2000', 'https://acme.com', '3', '01012026', 'Q1 Prospects'],
      ['John', 'Smith', 'Head of Sales', 'john@globex.com', 'https://linkedin.com/in/johnsmith', 'London, UK', 'Globex', 'https://linkedin.com/company/globex', '200-500', 'Marketing', '9 King Rd', 'King Rd', 'London', 'England', 'United Kingdom', '+44 20 7946 0000', 'https://globex.com', '5', '20122026', 'Q1 Prospects'],
    ]
    const lines = [HEADER_LABELS.map(csvEscape).join(',')]
    sample.forEach((r) => lines.push(r.map(csvEscape).join(',')))
    download('mapollo_sample.csv', lines.join('\n'), 'text/csv;charset=utf-8;')
  }

  const handleFile = (file) => {
    if (!file) return
    setFileName(file.name)
    const finish = (hdrs, data) => {
      const cleanHeaders = hdrs.filter((h) => h != null && String(h).trim() !== '')
      setHeaders(cleanHeaders)
      setRows(data)
      const initial = {}
      cleanHeaders.forEach((h) => {
        const match = NORM_TO_FIELD[normalize(h)]
        initial[h] = match || '__custom__'
      })
      setMapping(initial)
      setStep('map')
    }
    const name = file.name.toLowerCase()
    if (name.endsWith('.csv')) {
      Papa.parse(file, {
        header: true, skipEmptyLines: true,
        complete: (res) => finish(res.meta.fields || [], res.data || []),
        error: () => toast.error('Failed to parse CSV'),
      })
    } else {
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const wb = XLSX.read(e.target.result, { type: 'array' })
          const ws = wb.Sheets[wb.SheetNames[0]]
          const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
          const hdrs = (aoa[0] || []).map((h) => String(h))
          const data = XLSX.utils.sheet_to_json(ws, { defval: '' })
          finish(hdrs, data)
        } catch (err) { toast.error('Failed to parse Excel file') }
      }
      reader.readAsArrayBuffer(file)
    }
  }

  const mappedCount = useMemo(() => Object.values(mapping).filter((v) => v !== '__ignore__').length, [mapping])
  const matchedFieldCount = useMemo(() => new Set(Object.values(mapping).filter((v) => v !== '__ignore__' && v !== '__custom__')).size, [mapping])

  const transformRow = (raw) => {
    const obj = { custom_fields: {} }
    headers.forEach((h) => {
      const field = mapping[h]
      if (!field || field === '__ignore__') return
      const val = raw[h]
      if (field === '__custom__') { if (val !== undefined && String(val).trim() !== '') obj.custom_fields[h] = val }
      else obj[field] = val
    })
    return obj
  }

  const runImport = async () => {
    setStep('importing'); setProgress(0)
    try {
      const mapped = rows.map(transformRow).filter((r) => Object.keys(r).some((k) => k !== 'custom_fields' && r[k]) || Object.keys(r.custom_fields).length)
      const chunk = 1000
      let done = 0
      for (let i = 0; i < mapped.length; i += chunk) {
        const slice = mapped.slice(i, i + chunk)
        await api('/contacts/bulk', { method: 'POST', body: { rows: slice } })
        done += slice.length
        setProgress(Math.round((done / mapped.length) * 100))
      }
      onImported(mapped.length)
    } catch (err) {
      if (err.message !== 'Unauthorized') toast.error(err.message)
      setStep('map')
    }
  }

  const fieldOptions = [
    ...FIELDS.map(([key, label]) => ({ value: key, label })),
    { value: '__custom__', label: 'Add as custom field' },
    { value: '__ignore__', label: 'Ignore this column' },
  ]

  const previewRows = rows.slice(0, 6)
  const previewFields = headers.map((h) => ({ h, field: mapping[h] })).filter((m) => m.field !== '__ignore__')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Upload className="h-5 w-5" /> Import contacts</DialogTitle>
          <DialogDescription>
            {step === 'upload' && 'Upload a CSV or Excel file. Columns are matched automatically; you can adjust the mapping next.'}
            {step === 'map' && `${fileName} - ${rows.length} rows - ${matchedFieldCount} columns matched`}
            {step === 'importing' && 'Importing your contacts...'}
          </DialogDescription>
        </DialogHeader>

        {step === 'upload' && (
          <div className="space-y-4">
            <div
              className="border-2 border-dashed rounded-xl p-10 text-center cursor-pointer hover:bg-muted/40 transition"
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); handleFile(e.dataTransfer.files?.[0]) }}
            >
              <FileSpreadsheet className="mx-auto h-10 w-10 text-muted-foreground" />
              <p className="mt-3 font-medium">Click to upload or drag &amp; drop</p>
              <p className="text-sm text-muted-foreground">CSV, XLSX or XLS</p>
              <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />
            </div>
            <div className="flex items-center justify-between rounded-lg bg-muted/50 p-3">
              <div className="text-sm">
                <p className="font-medium">Need the right format?</p>
                <p className="text-muted-foreground text-xs">Download a sample file with all the correct headers.</p>
              </div>
              <Button variant="outline" size="sm" onClick={downloadSample}><Download className="h-4 w-4 mr-1" /> Sample CSV</Button>
            </div>
          </div>
        )}

        {step === 'map' && (
          <div className="flex-1 overflow-y-auto space-y-6 pr-1">
            <div>
              <h4 className="font-semibold mb-2 text-sm">1 - Match your columns</h4>
              <div className="rounded-lg border divide-y">
                {headers.map((h) => (
                  <div key={h} className="flex items-center gap-3 p-2.5">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{h}</p>
                      <p className="text-xs text-muted-foreground truncate">e.g. {String(rows[0]?.[h] ?? '').slice(0, 40) || '\u2014'}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="w-56 shrink-0">
                      <Select value={mapping[h]} onValueChange={(v) => setMapping((m) => ({ ...m, [h]: v }))}>
                        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {fieldOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h4 className="font-semibold mb-2 text-sm">2 - Preview ({previewRows.length} of {rows.length} rows)</h4>
              <div className="rounded-lg border overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50">
                    <tr className="[&>th]:px-2 [&>th]:py-2 [&>th]:text-left [&>th]:whitespace-nowrap">
                      {previewFields.map((m) => (
                        <th key={m.h}>
                          {m.field === '__custom__'
                            ? <span>{m.h} <Badge variant="outline" className="ml-1">custom</Badge></span>
                            : (FIELDS.find((f) => f[0] === m.field)?.[1] || m.field)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((r, i) => (
                      <tr key={i} className="border-t [&>td]:px-2 [&>td]:py-1.5 [&>td]:whitespace-nowrap">
                        {previewFields.map((m) => <td key={m.h} className="max-w-[160px] truncate">{String(r[m.h] ?? '')}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {step === 'importing' && (
          <div className="py-10 text-center space-y-4">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-indigo-600" />
            <p className="font-medium">Importing... {progress}%</p>
            <div className="mx-auto h-2 w-64 overflow-hidden rounded-full bg-muted">
              <div className="h-full bg-indigo-600 transition-all" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}

        <DialogFooter className="border-t pt-4">
          {step === 'map' && (
            <>
              <Button variant="outline" onClick={() => setStep('upload')}>Back</Button>
              <Button onClick={runImport} disabled={mappedCount === 0}>
                <CheckCircle2 className="h-4 w-4 mr-1" /> Import {rows.length} contacts
              </Button>
            </>
          )}
          {step === 'upload' && <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ============================ ADD CONTACT DIALOG ============================
function AddContactDialog({ open, onOpenChange, api, onAdded }) {
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)
  useEffect(() => { if (!open) setForm({}) }, [open])
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const save = async () => {
    setSaving(true)
    try {
      await api('/contacts', { method: 'POST', body: form })
      onAdded()
    } catch (err) {
      if (err.message !== 'Unauthorized') toast.error(err.message)
    } finally { setSaving(false) }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Plus className="h-5 w-5" /> Add contact</DialogTitle>
          <DialogDescription>Fill in the details. Date should be in DDMMYYYY format.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3 overflow-y-auto pr-1">
          {FIELDS.map(([key, label]) => (
            <div key={key} className="space-y-1.5">
              <Label className="text-xs">{label}</Label>
              <Input className="h-9" value={form[key] || ''} onChange={(e) => set(key, e.target.value)}
                placeholder={key === 'date_raw' ? '01012026' : ''} />
            </div>
          ))}
        </div>
        <DialogFooter className="border-t pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}Save contact</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
