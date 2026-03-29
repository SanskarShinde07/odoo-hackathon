import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthContext } from '../context/AuthContext'
import { getDefaultRoute } from '../utils/formatter'
import { RoleGuard } from '../components/guards/RoleGuard'
import { LoadingSpinner } from '../components/common/LoadingSpinner'

import AuthLayout from '../layouts/AuthLayout'
import DashboardLayout from '../layouts/DashboardLayout'

import LoginPage from '../pages/auth/LoginPage'
import SignupPage from '../pages/auth/SignupPage'
import SubmitExpensePage from '../pages/employee/SubmitExpensePage'
import ExpenseHistoryPage from '../pages/employee/ExpenseHistoryPage'
import ApprovalsPage from '../pages/manager/ApprovalsPage'
import ExpenseDetailPage from '../pages/manager/ExpenseDetailPage'
import UsersPage from '../pages/admin/UsersPage'
import ApprovalRulesPage from '../pages/admin/ApprovalRulesPage'

export function AppRoutes() {
  const { isAuthenticated, user, isLoading } = useAuthContext()

  if (isLoading) return <LoadingSpinner fullPage />

  return (
    <Routes>
      {/* ── Auth routes ──────────────────────────────────────────────────── */}
      <Route element={<AuthLayout />}>
        <Route path="/login"  element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
      </Route>

      {/* ── Protected routes ─────────────────────────────────────────────── */}
      <Route element={<DashboardLayout />}>
        {/* Employee */}
        <Route
          path="/employee/submit"
          element={
            <RoleGuard allowedRoles={['EMPLOYEE', 'ADMIN']}>
              <SubmitExpensePage />
            </RoleGuard>
          }
        />
        <Route
          path="/employee/history"
          element={
            <RoleGuard allowedRoles={['EMPLOYEE', 'ADMIN']}>
              <ExpenseHistoryPage />
            </RoleGuard>
          }
        />

        {/* Manager */}
        <Route
          path="/manager/approvals"
          element={
            <RoleGuard allowedRoles={['MANAGER', 'ADMIN']}>
              <ApprovalsPage />
            </RoleGuard>
          }
        />
        <Route
          path="/manager/approvals/:id"
          element={
            <RoleGuard allowedRoles={['MANAGER', 'ADMIN']}>
              <ExpenseDetailPage />
            </RoleGuard>
          }
        />

        {/* Admin */}
        <Route
          path="/admin/users"
          element={
            <RoleGuard allowedRoles={['ADMIN']}>
              <UsersPage />
            </RoleGuard>
          }
        />
        <Route
          path="/admin/rules"
          element={
            <RoleGuard allowedRoles={['ADMIN']}>
              <ApprovalRulesPage />
            </RoleGuard>
          }
        />
      </Route>

      {/* ── Default redirect ─────────────────────────────────────────────── */}
      <Route
        path="/"
        element={
          isAuthenticated && user
            ? <Navigate to={getDefaultRoute(user.role)} replace />
            : <Navigate to="/login" replace />
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}