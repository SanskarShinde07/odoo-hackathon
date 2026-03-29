from pydantic import BaseModel, Field, field_validator, model_validator
from typing import List, Optional
from enum import Enum
from datetime import datetime
import uuid


# ─────────────────────────────────────────────
# ENUMS
# ─────────────────────────────────────────────

class RuleType(str, Enum):
    SEQUENTIAL        = "sequential"
    PERCENTAGE        = "percentage"
    SPECIFIC_APPROVER = "specific_approver"
    HYBRID            = "hybrid"


class UserRole(str, Enum):
    EMPLOYEE = "employee"
    MANAGER  = "manager"
    FINANCE  = "finance"
    DIRECTOR = "director"
    ADMIN    = "admin"      # CFO / admin-level users carry is_key_approver on the rule


class ApprovalStatus(str, Enum):
    PENDING   = "pending"
    APPROVED  = "approved"
    REJECTED  = "rejected"
    CANCELLED = "cancelled"


# ─────────────────────────────────────────────
# USER
# ─────────────────────────────────────────────

class User(BaseModel):
    id:            str
    name:          str
    email:         str
    role:          UserRole
    company_id:    str
    is_manager:    bool = False     # IS_MANAGER_APPROVER flag on the employee profile


# ─────────────────────────────────────────────
# RULE APPROVER  (rule_approvers table row)
# Each approver entry belongs to one rule.
# is_key_approver = True → this person is the "CFO / power approver" for this rule.
# ─────────────────────────────────────────────

class RuleApprover(BaseModel):
    id:               str = Field(default_factory=lambda: str(uuid.uuid4()))
    rule_id:          str
    user_id:          str
    sequence:         int           # >= 1, unique per rule
    is_key_approver:  bool = False
    # Expanded user object (populated on GET, not stored)
    users:            Optional[dict] = None


# ─────────────────────────────────────────────
# RULE  (rules table row)
# rule_type is rule-level (not per-step)
# ─────────────────────────────────────────────

class Rule(BaseModel):
    id:                   str = Field(default_factory=lambda: str(uuid.uuid4()))
    company_id:           str
    name:                 str
    rule_type:            RuleType
    percentage_threshold: Optional[int] = None    # 1–100, required for percentage & hybrid
    created_at:           datetime = Field(default_factory=datetime.utcnow)


# ─────────────────────────────────────────────
# EXPENSE / WORKFLOW STATE
# ─────────────────────────────────────────────

class ApproverAction(BaseModel):
    approver_id:     str
    action:          ApprovalStatus
    comment:         Optional[str] = None
    acted_at:        datetime = Field(default_factory=datetime.utcnow)


class AuditEntry(BaseModel):
    timestamp:    datetime = Field(default_factory=datetime.utcnow)
    actor_id:     str
    action:       str
    comment:      Optional[str] = None
    sequence:     Optional[int] = None


class ExpenseRecord(BaseModel):
    expense_id:       str = Field(default_factory=lambda: str(uuid.uuid4()))
    company_id:       str
    submitted_by:     str
    vendor:           str
    amount:           float
    currency:         str
    category:         str
    rule_id:          str
    overall_status:   ApprovalStatus = ApprovalStatus.PENDING
    # Snapshot of ordered approvers at submission time (sequence-sorted)
    approver_sequence: List[RuleApprover] = []
    # Index into approver_sequence for sequential rules (0-based)
    current_sequence_index: int = 0
    # Per-approver actions recorded here
    actions:          List[ApproverAction] = []
    audit_log:        List[AuditEntry] = []
    created_at:       datetime = Field(default_factory=datetime.utcnow)
    resolved_at:      Optional[datetime] = None
    resolution_note:  Optional[str] = None


# ─────────────────────────────────────────────
# REQUEST BODIES  (camelCase input → snake_case stored)
# ─────────────────────────────────────────────

class RuleCreateRequest(BaseModel):
    """POST /api/rules — camelCase input as per API doc"""
    name:                 str = Field(..., min_length=2)
    ruleType:             RuleType
    percentageThreshold:  Optional[int] = Field(None, ge=1, le=100)
    is_manager_approver:  bool = False   # global flag for the policy

    @model_validator(mode="after")
    def validate_threshold(self):
        if self.ruleType in (RuleType.PERCENTAGE, RuleType.HYBRID):
            if self.percentageThreshold is None:
                raise ValueError(
                    f"percentageThreshold is required when ruleType is '{self.ruleType}'"
                )
        return self


class RuleUpdateRequest(BaseModel):
    """PUT /api/rules/:id — all fields optional"""
    name:                Optional[str] = Field(None, min_length=2)
    ruleType:            Optional[RuleType] = None
    percentageThreshold: Optional[int] = Field(None, ge=1, le=100)


class AddApproverRequest(BaseModel):
    """POST /api/rules/:id/approvers"""
    userId:          str
    sequence:        int = Field(..., ge=1)
    isKeyApprover:   bool = False


class UpdateApproverRequest(BaseModel):
    """PUT /api/rules/:id/approvers/:approverId"""
    sequence:       Optional[int] = Field(None, ge=1)
    isKeyApprover:  Optional[bool] = None


class ExpenseSubmitRequest(BaseModel):
    submitted_by: str
    vendor:       str
    amount:       float
    currency:     str
    category:     str
    rule_id:      str


class ActionRequest(BaseModel):
    approver_id: str
    comment:     Optional[str] = None
