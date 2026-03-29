import { createContext, useContext, useState, useEffect } from 'react'
import type { ReactNode } from 'react'
import type { User } from '../types'
import { api } from '../utils/api'

interface AuthContextType {
  user: User | null
  token: string | null
  company: { id: string; name: string; country: string; currencyCode: string } | null
  setUser: (user: User | null) => void
  setToken: (token: string | null) => void
  setCompany: (company: AuthContextType['company']) => void
  logout: () => void
  isAuthenticated: boolean
  isLoading: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [company, setCompany] = useState<AuthContextType['company']>(null)
  const [isLoading, setIsLoading] = useState(true)

  // On mount: rehydrate from localStorage then validate with /api/auth/me
  useEffect(() => {
    const storedToken = localStorage.getItem('token')
    const storedUser = localStorage.getItem('user')
    const storedCompany = localStorage.getItem('company')

    if (storedToken) {
      setToken(storedToken)
      if (storedUser) setUser(JSON.parse(storedUser))
      if (storedCompany) setCompany(JSON.parse(storedCompany))

      // Validate token is still alive
      api
        .get('/api/auth/me')
        .then((res) => {
          const u = res.data.user
          // /api/auth/me returns snake_case — map to our camelCase User type
          const normalized: User = {
            id: u.id,
            name: u.name,
            email: u.email,
            role: (u.role as string).toUpperCase() as User['role'],
            managerId: u.manager_id ?? undefined,
            companyId: u.company_id,
            isManagerApprover: u.is_manager_approver,
            createdAt: u.created_at,
          }
          handleSetUser(normalized)
        })
        .catch(() => {
          handleSetUser(null)
          handleSetToken(null)
          handleSetCompany(null)
        })
        .finally(() => setIsLoading(false))
    } else {
      setIsLoading(false)
    }
  }, [])

  const handleSetToken = (t: string | null) => {
    setToken(t)
    if (t) localStorage.setItem('token', t)
    else localStorage.removeItem('token')
  }

  const handleSetUser = (u: User | null) => {
    setUser(u)
    if (u) localStorage.setItem('user', JSON.stringify(u))
    else localStorage.removeItem('user')
  }

  const handleSetCompany = (c: AuthContextType['company']) => {
    setCompany(c)
    if (c) localStorage.setItem('company', JSON.stringify(c))
    else localStorage.removeItem('company')
  }

  const logout = () => {
    handleSetUser(null)
    handleSetToken(null)
    handleSetCompany(null)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        company,
        setUser: handleSetUser,
        setToken: handleSetToken,
        setCompany: handleSetCompany,
        logout,
        isAuthenticated: !!token && !!user,
        isLoading,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuthContext() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuthContext must be used inside AuthProvider')
  return ctx
}
