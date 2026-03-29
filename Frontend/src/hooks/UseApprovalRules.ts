import { useState, useCallback } from 'react'
import type { ApprovalRule, ApprovalConditionType } from '../types'
import { api, extractError } from '../utils/api'

interface CreateApprovalRulePayload {
  name: string
  conditionType: ApprovalConditionType   // Frontend UPPERCASE → send lowercase on wire
  percentageThreshold?: number           // Required for PERCENTAGE and HYBRID
  approvers: { userId: string; sequence: number; isKeyApprover?: boolean }[]
}

interface UseApprovalRulesReturn {
  rules: ApprovalRule[]
  loading: boolean
  actionLoading: boolean
  error: string | null
  fetchRules: () => Promise<void>
  createRule: (payload: CreateApprovalRulePayload) => Promise<void>
  updateRule: (id: string, payload: Partial<CreateApprovalRulePayload>) => Promise<void>
  deleteRule: (id: string) => Promise<void>
}

// ── Map raw backend rule (snake_case) to frontend ApprovalRule ────────────────
function mapRule(r: any): ApprovalRule {
  return {
    id: r.id,
    companyId: r.company_id ?? r.companyId,
    name: r.name,
    isManagerApprover: false,     // Not in backend rule object; isManagerApprover lives on User
    conditionType: (r.rule_type as string).toUpperCase() as ApprovalConditionType,
    approvalSequence: r.rule_type === 'sequential',
    percentageThreshold: r.percentage_threshold ?? undefined,
    approvers: (r.approvers ?? []).map((a: any) => ({
      stepNumber: a.sequence,
      userId: a.users?.id ?? a.userId,
      userName: a.users?.name ?? '',
      userRole: (a.users?.role ?? '').toUpperCase(),
      isKeyApprover: a.is_key_approver ?? false,
    })),
    createdAt: r.created_at ?? r.createdAt,
  }
}

export function useApprovalRules(): UseApprovalRulesReturn {
  const [rules, setRules] = useState<ApprovalRule[]>([])
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ── GET /api/rules — all rules for caller's company ───────────────────────
  const fetchRules = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.get('/api/rules')
      setRules((res.data.rules as any[]).map(mapRule))
    } catch (err: any) {
      setError(extractError(err))
    } finally {
      setLoading(false)
    }
  }, [])

  // ── POST /api/rules (Admin only) ──────────────────────────────────────────
  // Then POST /api/rules/:id/approvers for each approver (backend stores separately)
  // Note: request body uses camelCase "ruleType" but stored/returned as snake "rule_type"
  const createRule = async (payload: CreateApprovalRulePayload) => {
    setActionLoading(true)
    setError(null)
    try {
      const ruleRes = await api.post('/api/rules', {
        name: payload.name,
        ruleType: payload.conditionType.toLowerCase(),      // "sequential" | "percentage" | etc.
        percentageThreshold: payload.percentageThreshold ?? null,
      })

      const newRuleId = ruleRes.data.rule?.id ?? ruleRes.data.id

      // Add each approver sequentially
      for (const approver of payload.approvers) {
        await api.post(`/api/rules/${newRuleId}/approvers`, {
          userId: approver.userId,
          sequence: approver.sequence,
          isKeyApprover: approver.isKeyApprover ?? false,
        })
      }

      await fetchRules()
    } catch (err: any) {
      setError(extractError(err))
      throw err
    } finally {
      setActionLoading(false)
    }
  }

  // ── PUT /api/rules/:id (Admin only) ──────────────────────────────────────
  // Only updates rule metadata — approvers must be managed via separate endpoints
  const updateRule = async (id: string, payload: Partial<CreateApprovalRulePayload>) => {
    setActionLoading(true)
    setError(null)
    try {
      await api.put(`/api/rules/${id}`, {
        ...(payload.name && { name: payload.name }),
        ...(payload.conditionType && { ruleType: payload.conditionType.toLowerCase() }),
        ...(payload.percentageThreshold !== undefined && {
          percentageThreshold: payload.percentageThreshold,
        }),
      })
      await fetchRules()
    } catch (err: any) {
      setError(extractError(err))
      throw err
    } finally {
      setActionLoading(false)
    }
  }

  // ── DELETE /api/rules/:id (Admin only) ────────────────────────────────────
  // Cascades and removes all associated rule_approvers rows automatically
  const deleteRule = async (id: string) => {
    setActionLoading(true)
    setError(null)
    try {
      await api.delete(`/api/rules/${id}`)
      setRules((prev) => prev.filter((r) => r.id !== id))
    } catch (err: any) {
      setError(extractError(err))
      throw err
    } finally {
      setActionLoading(false)
    }
  }

  return {
    rules,
    loading,
    actionLoading,
    error,
    fetchRules,
    createRule,
    updateRule,
    deleteRule,
  }
}
