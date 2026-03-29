import axios from 'axios'

// ─── Main backend (Auth / Users / Rules / Currency) ───────────────────────────
export const api = axios.create({
  baseURL: 'https://reimbursmentodoo-production.up.railway.app',
  headers: { 'Content-Type': 'application/json' },
})

// ─── Approval engine (Expenses / Queue / Approve / Reject) ───────────────────
export const approvalApi = axios.create({
  baseURL: 'https://approval-main-production.up.railway.app',
  headers: { 'Content-Type': 'application/json' },
})

// ─── OCR engine (Receipt scanning) ───────────────────────────────────────────
export const ocrApi = axios.create({
  baseURL: 'https://receipt-processor-production-fd7e.up.railway.app',
  // Content-Type is set per-request (multipart/form-data) — don't set here
})

// ── Auto-attach Bearer token on main backend requests ────────────────────────
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// ── Auto-attach Bearer token on approval engine requests ─────────────────────
approvalApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// ── Normalize error responses to a readable string ────────────────────────────
export function extractError(err: any): string {
  const data = err?.response?.data
  if (!data) return err?.message ?? 'An unexpected error occurred.'
  // FastAPI 422 format
  if (Array.isArray(data.detail)) {
    return data.detail.map((d: any) => d.msg).join(' | ')
  }
  if (typeof data.detail === 'string') return data.detail
  if (typeof data.error === 'string') return data.error
  if (typeof data.error === 'object') {
    return Object.values(data.error).flat().join(' | ')
  }
  if (typeof data.message === 'string') return data.message
  return 'An unexpected error occurred.'
}
