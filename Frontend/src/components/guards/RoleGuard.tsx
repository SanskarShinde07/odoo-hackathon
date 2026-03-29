import { Navigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuthContext } from '../../context/AuthContext'
import type { UserRole } from '../../types'
import { getDefaultRoute } from '../../utils/formatter'
import { LoadingSpinner } from '../common/LoadingSpinner'

interface RoleGuardProps {
  allowedRoles: UserRole[]
  children: ReactNode
}

export function RoleGuard({ allowedRoles, children }: RoleGuardProps) {
  const { user, isAuthenticated, isLoading } = useAuthContext()

  if (isLoading) return <LoadingSpinner fullPage />

  if (!isAuthenticated) return <Navigate to="/login" replace />

  if (user && !allowedRoles.includes(user.role)) {
    return <Navigate to={getDefaultRoute(user.role)} replace />
  }

  return <>{children}</>
}