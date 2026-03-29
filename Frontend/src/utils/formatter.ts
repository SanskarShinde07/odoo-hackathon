import type{ ExpenseCategory, ExpenseStatus, UserRole } from '../types'

// ─── Currency ─────────────────────────────────────────────────────────────────
export function formatAmount(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

// ─── Date ─────────────────────────────────────────────────────────────────────
export function formatDate(dateStr: string): string {
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(dateStr))
}

export function formatDateTime(dateStr: string): string {
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(dateStr))
}

// ─── Labels ───────────────────────────────────────────────────────────────────
export function getStatusLabel(status: ExpenseStatus): string {
  const map: Record<ExpenseStatus, string> = {
    PENDING: 'Pending',
    IN_REVIEW: 'In Review',
    APPROVED: 'Approved',
    REJECTED: 'Rejected',
    CANCELLED: 'Cancelled',
  }
  return map[status] ?? status
}

export function getCategoryLabel(category: ExpenseCategory): string {
  const map: Record<ExpenseCategory, string> = {
    TRAVEL: 'Travel',
    FOOD: 'Food & Dining',
    ACCOMMODATION: 'Accommodation',
    OFFICE_SUPPLIES: 'Office Supplies',
    ENTERTAINMENT: 'Entertainment',
    MISCELLANEOUS: 'Miscellaneous',
  }
  return map[category] ?? category
}

export function getRoleLabel(role: UserRole): string {
  const map: Record<UserRole, string> = {
    ADMIN: 'Admin',
    MANAGER: 'Manager',
    EMPLOYEE: 'Employee',
  }
  return map[role] ?? role
}

// ─── Status color for MUI Chip ────────────────────────────────────────────────
export function getStatusColor(
  status: ExpenseStatus
): 'success' | 'warning' | 'error' | 'info' | 'default' {
  const map: Record<ExpenseStatus, 'success' | 'warning' | 'error' | 'info' | 'default'> = {
    APPROVED: 'success',
    IN_REVIEW: 'info',
    PENDING: 'warning',
    REJECTED: 'error',
    CANCELLED: 'default',
  }
  return map[status] ?? 'default'
}

// ─── Role color ────────────────────────────────────────────────────────────────
export function getRoleColor(
  role: UserRole
): 'primary' | 'secondary' | 'default' {
  const map: Record<UserRole, 'primary' | 'secondary' | 'default'> = {
    ADMIN: 'primary',
    MANAGER: 'secondary',
    EMPLOYEE: 'default',
  }
  return map[role] ?? 'default'
}

// ─── Default redirect by role ─────────────────────────────────────────────────
export function getDefaultRoute(role: UserRole): string {
  switch (role) {
    case 'EMPLOYEE': return '/employee/submit'
    case 'MANAGER':  return '/manager/approvals'
    case 'ADMIN':    return '/admin/users'
  }
}