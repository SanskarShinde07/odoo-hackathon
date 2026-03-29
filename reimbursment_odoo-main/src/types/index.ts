// ─── Enums ───────────────────────────────────────────────────────────────────

export type UserRole = "admin" | "manager" | "employee";
export type RuleType =
  | "sequential"
  | "percentage"
  | "specific_approver"
  | "hybrid";

// ─── Database Row Types ───────────────────────────────────────────────────────

export interface Company {
  id: string;
  name: string;
  country: string;
  currency_code: string;
  created_at: string;
}

export interface User {
  id: string;
  company_id: string;
  name: string;
  email: string;
  password_hash: string;
  role: UserRole;
  manager_id: string | null;
  is_manager_approver: boolean;
  created_at: string;
}

export interface Rule {
  id: string;
  company_id: string;
  name: string;
  rule_type: RuleType;
  percentage_threshold: number | null;
  created_at: string;
}

export interface RuleApprover {
  id: string;
  rule_id: string;
  user_id: string;
  sequence: number;
  is_key_approver: boolean;
}

// ─── JWT Payload ─────────────────────────────────────────────────────────────

export interface JwtPayload {
  userId: string;
  companyId: string;
  role: UserRole;
  email: string;
}

// ─── Express Request Extension ───────────────────────────────────────────────

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}
