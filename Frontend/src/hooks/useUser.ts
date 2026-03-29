import { useState, useCallback } from 'react'
import type { User, UserRole } from '../types'
import { api, extractError } from '../utils/api'

interface CreateUserPayload {
  name: string
  email: string
  password: string
  role: UserRole          // Frontend keeps UPPERCASE — we lowercase before sending
  managerId?: string
  isManagerApprover?: boolean
}

interface UseUsersReturn {
  users: User[]
  loading: boolean
  actionLoading: boolean
  error: string | null
  fetchUsers: () => Promise<void>
  createUser: (payload: CreateUserPayload) => Promise<void>
  updateUserRole: (userId: string, role: UserRole) => Promise<void>
  assignManager: (employeeId: string, managerId: string) => Promise<void>
  deleteUser: (userId: string) => Promise<void>
}

// ── Map a raw backend user row (snake_case) to our User type ──────────────────
function mapUser(u: any): User {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: (u.role as string).toUpperCase() as UserRole,
    managerId: u.manager_id ?? u.managerId ?? undefined,
    isManagerApprover: u.is_manager_approver ?? u.isManagerApprover,
    companyId: u.company_id ?? u.companyId,
    createdAt: u.created_at ?? u.createdAt,
  }
}

export function useUsers(): UseUsersReturn {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ── GET /api/users ─────────────────────────────────────────────────────────
  // Scoped by caller role: admin→all, manager→self+reports, employee→self only
  const fetchUsers = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.get('/api/users')
      setUsers((res.data.users as any[]).map(mapUser))
    } catch (err: any) {
      setError(extractError(err))
    } finally {
      setLoading(false)
    }
  }, [])

  // ── POST /api/users (Admin only) ───────────────────────────────────────────
  // Cannot create another admin. Roles must be lowercase on the wire.
  const createUser = async (payload: CreateUserPayload) => {
    setActionLoading(true)
    setError(null)
    try {
      await api.post('/api/users', {
        name: payload.name,
        email: payload.email,
        password: payload.password,
        role: payload.role.toLowerCase(),               // "manager" | "employee"
        managerId: payload.managerId ?? null,
        isManagerApprover: payload.isManagerApprover ?? false,
      })
      await fetchUsers()
    } catch (err: any) {
      setError(extractError(err))
      throw err
    } finally {
      setActionLoading(false)
    }
  }

  // ── PUT /api/users/:id — update role ──────────────────────────────────────
  // Admin cannot change their own role (backend returns 400)
  const updateUserRole = async (userId: string, role: UserRole) => {
    setActionLoading(true)
    setError(null)
    try {
      await api.put(`/api/users/${userId}`, { role: role.toLowerCase() })
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role } : u)))
    } catch (err: any) {
      setError(extractError(err))
      throw err
    } finally {
      setActionLoading(false)
    }
  }

  // ── PUT /api/users/:id — reassign manager ─────────────────────────────────
  const assignManager = async (employeeId: string, managerId: string) => {
    setActionLoading(true)
    setError(null)
    try {
      await api.put(`/api/users/${employeeId}`, { managerId })
      const manager = users.find((u) => u.id === managerId)
      setUsers((prev) =>
        prev.map((u) =>
          u.id === employeeId
            ? { ...u, managerId, managerName: manager?.name }
            : u
        )
      )
    } catch (err: any) {
      setError(extractError(err))
      throw err
    } finally {
      setActionLoading(false)
    }
  }

  // ── DELETE /api/users/:id (Admin only) ────────────────────────────────────
  // Cannot delete your own account (backend returns 400)
  const deleteUser = async (userId: string) => {
    setActionLoading(true)
    setError(null)
    try {
      await api.delete(`/api/users/${userId}`)
      setUsers((prev) => prev.filter((u) => u.id !== userId))
    } catch (err: any) {
      setError(extractError(err))
      throw err
    } finally {
      setActionLoading(false)
    }
  }

  return {
    users,
    loading,
    actionLoading,
    error,
    fetchUsers,
    createUser,
    updateUserRole,
    assignManager,
    deleteUser,
  }
}
