import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthContext } from '../context/AuthContext'
import type { User } from '../types'
import { api, extractError } from '../utils/api'

// ─── Payloads ─────────────────────────────────────────────────────────────────
interface LoginPayload {
  email: string
  password: string
}

interface SignupPayload {
  companyName: string   // API field: companyName (not "company")
  country: string       // Full country name e.g. "India" — API resolves currency automatically
  name: string
  email: string
  password: string
}

interface UseAuthReturn {
  loading: boolean
  error: string | null
  login: (payload: LoginPayload) => Promise<void>
  signup: (payload: SignupPayload) => Promise<void>
  logout: () => void
}

// ─── Route helper ─────────────────────────────────────────────────────────────
function getDefaultRoute(role: string): string {
  switch (role) {
    case 'ADMIN':    return '/admin/users'
    case 'MANAGER':  return '/manager/approvals'
    default:         return '/employee/submit'
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useAuth(): UseAuthReturn {
  const { setUser, setToken, setCompany, logout: ctxLogout } = useAuthContext()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  // ── Login ─────────────────────────────────────────────────────────────────
  // POST /api/auth/login
  // Response: { token, user: { role (lowercase) }, company: { currency_code } }
  const login = async (payload: LoginPayload) => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.post('/api/auth/login', payload)
      const { token, user, company } = res.data

      // Backend role is lowercase ("admin") — normalize to uppercase for frontend types
      const normalizedUser: User = {
        id: user.id,
        name: user.name,
        email: user.email,
        role: (user.role as string).toUpperCase() as User['role'],
        managerId: user.managerId ?? undefined,
        isManagerApprover: user.isManagerApprover,
        companyId: user.companyId,
        createdAt: user.createdAt ?? new Date().toISOString(),
      }

      // /login returns company.currency_code (snake_case) — normalize
      const normalizedCompany = {
        id: company.id,
        name: company.name,
        country: company.country,
        currencyCode: company.currency_code ?? company.currencyCode,
      }

      setToken(token)
      setUser(normalizedUser)
      setCompany(normalizedCompany)
      navigate(getDefaultRoute(normalizedUser.role))
    } catch (err: any) {
      setError(extractError(err))
    } finally {
      setLoading(false)
    }
  }

  // ── Signup ────────────────────────────────────────────────────────────────
  // POST /api/auth/signup
  // Creates Company + Admin user atomically — no auth required
  // Response: { token, user, company: { currencyCode } }
  const signup = async (payload: SignupPayload) => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.post('/api/auth/signup', {
        companyName: payload.companyName,
        country: payload.country,
        name: payload.name,
        email: payload.email,
        password: payload.password,
      })

      const { token, user, company } = res.data

      const normalizedUser: User = {
        id: user.id,
        name: user.name,
        email: user.email,
        role: (user.role as string).toUpperCase() as User['role'],
        companyId: user.companyId,
        createdAt: user.createdAt ?? new Date().toISOString(),
      }

      const normalizedCompany = {
        id: company.id,
        name: company.name,
        country: company.country,
        currencyCode: company.currencyCode ?? company.currency_code,
      }

      setToken(token)
      setUser(normalizedUser)
      setCompany(normalizedCompany)
      navigate('/admin/users')
    } catch (err: any) {
      setError(extractError(err))
    } finally {
      setLoading(false)
    }
  }

  // ── Logout ────────────────────────────────────────────────────────────────
  const logout = () => {
    ctxLogout()
    navigate('/login')
  }

  return { loading, error, login, signup, logout }
}
