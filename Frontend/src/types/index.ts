// ─── Roles ────────────────────────────────────────────────────────────────────
// Frontend stores UPPERCASE; backend sends lowercase ("admin","manager","employee")
export type UserRole = 'ADMIN' | 'MANAGER' | 'EMPLOYEE'

// ─── Expense ──────────────────────────────────────────────────────────────────
// Approval engine statuses: "pending" | "approved" | "rejected" | "cancelled"
export type ExpenseStatus = 'PENDING' | 'IN_REVIEW' | 'APPROVED' | 'REJECTED' | 'CANCELLED'

export type ExpenseCategory =
  | 'TRAVEL'
  | 'FOOD'
  | 'ACCOMMODATION'
  | 'OFFICE_SUPPLIES'
  | 'ENTERTAINMENT'
  | 'MISCELLANEOUS'

export interface ApprovalComment {
  approverId: string
  approverName: string
  comment: string | null
  action: 'APPROVED' | 'REJECTED'
  step: number
  timestamp: string
}

export interface ApprovalAuditEntry {
  timestamp: string
  actor_id: string
  action: string
  comment: string | null
  sequence: number | null
}

export interface Expense {
  id: string
  employeeId: string
  employeeName: string
  vendor: string               // Merchant / vendor name from approval engine
  amount: number
  currency: string
  amountInCompanyCurrency: number
  companyCurrency: string
  category: ExpenseCategory
  description: string          // Built from vendor + category
  date: string
  status: ExpenseStatus
  receiptUrl?: string
  currentApproverStep: number
  totalApproverSteps: number
  approvalRuleId?: string
  comments: ApprovalComment[]
  auditLog?: ApprovalAuditEntry[]
  createdAt: string
}

// ── Payload for submitting a new expense to the approval engine ───────────────
export interface SubmitExpensePayload {
  vendor: string               // Merchant / business name — maps to "vendor" on API
  amount: number
  currency: string
  category: string             // API accepts plain string e.g. "Travel", "Food"
  ruleId: string               // Approval rule UUID — required by engine
  receiptFile?: File           // Handled separately by OCR before submit
}

// ─── Users ────────────────────────────────────────────────────────────────────
export interface User {
  id: string
  name: string
  email: string
  role: UserRole
  managerId?: string
  managerName?: string
  isManagerApprover?: boolean  // is_manager_approver on backend
  companyId: string
  createdAt: string
}

export interface CreateUserPayload {
  name: string
  email: string
  password: string
  role: UserRole
  managerId?: string
  isManagerApprover?: boolean
}

// ─── Company ──────────────────────────────────────────────────────────────────
export interface Company {
  id: string
  name: string
  country: string
  currencyCode: string
  currencySymbol?: string
}

// ─── Approval Rules ───────────────────────────────────────────────────────────
export type ApprovalConditionType =
  | 'SEQUENTIAL'
  | 'PERCENTAGE'
  | 'SPECIFIC_APPROVER'
  | 'HYBRID'

export interface ApprovalStep {
  stepNumber: number
  userId: string
  userName: string
  userRole: string
  isKeyApprover?: boolean
}

export interface ApprovalRule {
  id: string
  companyId: string
  name: string
  isManagerApprover: boolean
  approvers: ApprovalStep[]
  approvalSequence: boolean
  conditionType: ApprovalConditionType
  percentageThreshold?: number
  specificApproverId?: string
  specificApproverName?: string
  createdAt: string
}

export interface CreateApprovalRulePayload {
  name: string
  conditionType: ApprovalConditionType
  percentageThreshold?: number
  approvers: { userId: string; sequence: number; isKeyApprover?: boolean }[]
}

// ─── OCR Result — from POST /process-receipt ─────────────────────────────────
export interface OcrResult {
  amount: {
    original: number | null
    currency: string
    converted: number | null
    base_currency: string
    exchange_rate: number | null
  }
  date: string | null
  vendor: string | null
  category: string | null
  payment_method: string | null
  description: string | null
  confidence: { amount: number; date: number }
  warnings: string[]
}

// ─── Country / Currency ───────────────────────────────────────────────────────
export interface CurrencyOption {
  country: string
  currencyCode: string
  currencyName: string
  symbol: string
}

// ─── API Response shapes ──────────────────────────────────────────────────────
export interface ApiResponse<T> {
  data: T
  message?: string
  success: boolean
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
}
