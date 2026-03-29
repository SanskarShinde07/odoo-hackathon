import { useState, useCallback } from 'react'
import type { Expense, ExpenseStatus, ExpenseCategory, ApprovalComment } from '../types'
import { approvalApi, extractError } from '../utils/api'
import { useAuthContext } from '../context/AuthContext'

interface ApprovePayload {
  expenseId: string
  approverId: string   // Acting approver's user ID — required by approval engine
  comment?: string
}

interface RejectPayload {
  expenseId: string
  approverId: string   // Required
  comment: string      // Required for rejection
}

interface UseApprovalsReturn {
  pendingApprovals: Expense[]
  selectedExpense: Expense | null
  loading: boolean
  actionLoading: boolean
  error: string | null
  fetchPendingApprovals: () => Promise<void>
  fetchExpenseById: (id: string) => Promise<void>
  approveExpense: (payload: ApprovePayload) => Promise<void>
  rejectExpense: (payload: RejectPayload) => Promise<void>
}

// ── Map approval engine status → frontend ExpenseStatus ──────────────────────
function mapStatus(s: string): ExpenseStatus {
  const map: Record<string, ExpenseStatus> = {
    pending: 'PENDING',
    approved: 'APPROVED',
    rejected: 'REJECTED',
    cancelled: 'CANCELLED',
  }
  return map[s?.toLowerCase()] ?? 'PENDING'
}

// ── Map GET /api/queue/:approverId expense item → frontend Expense ─────────────
function mapQueueItem(item: any): Expense {
  return {
    id: item.expense_id,
    employeeId: item.submitted_by,
    employeeName: item.submitted_by,   // ID only from queue; name not returned
    vendor: item.vendor ?? '',
    amount: item.amount,
    currency: item.currency,
    amountInCompanyCurrency: item.amount,
    companyCurrency: item.currency,
    category: (item.category?.toUpperCase() as ExpenseCategory) ?? 'MISCELLANEOUS',
    description: item.vendor ?? item.category ?? '',
    date: item.submitted_at?.split('T')[0] ?? '',
    status: 'PENDING',
    currentApproverStep: 1,
    totalApproverSteps: 1,
    approvalRuleId: item.rule_id,
    comments: [],
    createdAt: item.submitted_at ?? new Date().toISOString(),
  }
}

// ── Map GET /api/expenses/:id/status → frontend Expense ──────────────────────
function mapExpenseStatus(e: any): Expense {
  const comments: ApprovalComment[] = (e.actions ?? []).map((a: any, i: number) => ({
    approverId: a.approver_id,
    approverName: a.approver_id,    // Status endpoint returns ID only, not name
    comment: a.comment ?? null,
    action: a.action?.toUpperCase() as 'APPROVED' | 'REJECTED',
    step: i + 1,
    timestamp: a.acted_at,
  }))

  return {
    id: e.expense_id,
    employeeId: e.submitted_by,
    employeeName: e.submitted_by,
    vendor: e.vendor ?? '',
    amount: e.amount,
    currency: e.currency,
    amountInCompanyCurrency: e.amount,
    companyCurrency: e.currency,
    category: (e.category?.toUpperCase() as ExpenseCategory) ?? 'MISCELLANEOUS',
    description: e.vendor ?? e.category ?? '',
    date: e.submitted_at?.split('T')[0] ?? '',
    status: mapStatus(e.overall_status),
    currentApproverStep: (e.approver_sequence ?? []).length,
    totalApproverSteps: (e.approver_sequence ?? []).length,
    approvalRuleId: e.rule_id,
    comments,
    auditLog: e.audit_log ?? [],
    createdAt: e.submitted_at ?? new Date().toISOString(),
  }
}

export function useApprovals(): UseApprovalsReturn {
  const { user } = useAuthContext()
  const [pendingApprovals, setPendingApprovals] = useState<Expense[]>([])
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null)
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ── GET /api/queue/:approverId (approval engine) ──────────────────────────
  // Returns expenses currently waiting on this approver's action.
  // Sequential: only shows when it's this approver's turn.
  // Percentage/specific/hybrid: shows to all assigned approvers simultaneously.
  const fetchPendingApprovals = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    setError(null)
    try {
      const res = await approvalApi.get(`/api/queue/${user.id}`)
      const items: any[] = res.data.expenses ?? []
      setPendingApprovals(items.map(mapQueueItem))
    } catch (err: any) {
      setError(extractError(err))
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  // ── GET /api/expenses/:id/status (approval engine) ────────────────────────
  // Returns full expense detail: approver sequence, all actions, audit log.
  const fetchExpenseById = useCallback(async (id: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await approvalApi.get(`/api/expenses/${id}/status`)
      setSelectedExpense(mapExpenseStatus(res.data))
    } catch (err: any) {
      setError(extractError(err))
      setSelectedExpense(null)
    } finally {
      setLoading(false)
    }
  }, [])

  // ── POST /api/expenses/:id/approve (approval engine) ─────────────────────
  // Body: { approver_id, comment? }
  // Behaviour depends on rule type (sequential advances chain, percentage re-evaluates, etc.)
  const approveExpense = async ({ expenseId, approverId, comment }: ApprovePayload) => {
    setActionLoading(true)
    setError(null)
    try {
      await approvalApi.post(`/api/expenses/${expenseId}/approve`, {
        approver_id: approverId,
        comment: comment ?? '',
      })
      setPendingApprovals((prev) => prev.filter((e) => e.id !== expenseId))
    } catch (err: any) {
      const msg = extractError(err)
      setError(msg)
      throw new Error(msg)
    } finally {
      setActionLoading(false)
    }
  }

  // ── POST /api/expenses/:id/reject (approval engine) ───────────────────────
  // Body: { approver_id, comment } — comment is REQUIRED for rejection
  const rejectExpense = async ({ expenseId, approverId, comment }: RejectPayload) => {
    setActionLoading(true)
    setError(null)
    try {
      await approvalApi.post(`/api/expenses/${expenseId}/reject`, {
        approver_id: approverId,
        comment,    // Required — API returns 400 if missing
      })
      setPendingApprovals((prev) => prev.filter((e) => e.id !== expenseId))
    } catch (err: any) {
      const msg = extractError(err)
      setError(msg)
      throw new Error(msg)
    } finally {
      setActionLoading(false)
    }
  }

  return {
    pendingApprovals,
    selectedExpense,
    loading,
    actionLoading,
    error,
    fetchPendingApprovals,
    fetchExpenseById,
    approveExpense,
    rejectExpense,
  }
}
