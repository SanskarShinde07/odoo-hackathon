import { useState, useCallback } from 'react'
import type { Expense, SubmitExpensePayload, ExpenseStatus, ExpenseCategory } from '../types'
import { approvalApi, extractError } from '../utils/api'
import { useAuthContext } from '../context/AuthContext'

interface UseExpensesReturn {
  expenses: Expense[]
  loading: boolean
  error: string | null
  submitting: boolean
  fetchMyExpenses: () => Promise<void>
  submitExpense: (payload: SubmitExpensePayload) => Promise<string>  // returns new expense_id
}

// ── Map approval engine status (lowercase) → frontend ExpenseStatus ───────────
function mapStatus(s: string): ExpenseStatus {
  const map: Record<string, ExpenseStatus> = {
    pending: 'PENDING',
    approved: 'APPROVED',
    rejected: 'REJECTED',
    cancelled: 'CANCELLED',
  }
  return map[s?.toLowerCase()] ?? 'PENDING'
}

// ── Map a queue item from GET /api/queue/:approverId → Expense ────────────────
function mapQueueItem(item: any): Expense {
  return {
    id: item.expense_id,
    employeeId: item.submitted_by,
    employeeName: item.submitted_by,   // Queue doesn't return name; resolved later if needed
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

export function useExpenses(): UseExpensesReturn {
  const { user } = useAuthContext()
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // ── GET /api/queue/:userId (approval engine) ──────────────────────────────
  // The approval engine exposes queue items per approver. For an employee
  // viewing their own submissions we use the same queue endpoint with their ID.
  // This shows expenses where they are in the approver sequence.
  // Note: a future "submitted by me" endpoint may replace this.
  const fetchMyExpenses = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    setError(null)
    try {
      const res = await approvalApi.get(`/api/queue/${user.id}`)
      const items = res.data.expenses ?? []
      setExpenses(items.map(mapQueueItem))
    } catch (err: any) {
      setError(extractError(err))
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  // ── POST /api/expenses/submit (approval engine) ───────────────────────────
  // Body: { submitted_by, vendor, amount, currency, category, rule_id }
  // Returns: { expense_id, message, rule_type, approvers }
  const submitExpense = async (payload: SubmitExpensePayload): Promise<string> => {
    setSubmitting(true)
    setError(null)
    try {
      const res = await approvalApi.post('/api/expenses/submit', {
        submitted_by: user?.id,
        vendor: payload.vendor,
        amount: payload.amount,
        currency: payload.currency,
        // API expects plain string category e.g. "Travel" — convert from UPPERCASE enum
        category: payload.category.charAt(0).toUpperCase() + payload.category.slice(1).toLowerCase(),
        rule_id: payload.ruleId,
      })
      await fetchMyExpenses()
      return res.data.expense_id
    } catch (err: any) {
      const msg = extractError(err)
      setError(msg)
      throw new Error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  return { expenses, loading, error, submitting, fetchMyExpenses, submitExpense }
}
