from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from models import (
    Rule, RuleApprover, ExpenseRecord, ApprovalStatus,
    RuleCreateRequest, RuleUpdateRequest,
    AddApproverRequest, UpdateApproverRequest,
    ExpenseSubmitRequest, ActionRequest,
    RuleType
)
from workflow_engine import process_action, get_approver_queue
from store import rules, rule_approvers, expenses, users, manager_map, COMPANY_ID
from datetime import datetime

app = FastAPI(
    title="Approval Engine API",
    description="Expense approval system — aligned to /api/rules schema",
    version="2.0.0"
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # your Vite dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────

def get_rule_or_404(rule_id: str) -> Rule:
    rule = rules.get(rule_id)
    if not rule:
        raise HTTPException(404, f"Rule '{rule_id}' not found.")
    return rule


def get_approvers_for_rule(rule_id: str) -> list[RuleApprover]:
    """Return approvers for a rule sorted by sequence ascending."""
    return sorted(
        [a for a in rule_approvers.values() if a.rule_id == rule_id],
        key=lambda a: a.sequence
    )


def expand_approver(ra: RuleApprover) -> dict:
    """Attach user object to approver entry (as per API doc shape)."""
    user = users.get(ra.user_id)
    return {
        "id":              ra.id,
        "sequence":        ra.sequence,
        "is_key_approver": ra.is_key_approver,
        "users": {
            "id":    user.id,
            "name":  user.name,
            "email": user.email,
            "role":  user.role,
        } if user else None
    }


# ─────────────────────────────────────────────
# RULES  —  /api/rules
# ─────────────────────────────────────────────

@app.get("/api/rules", summary="GET /api/rules — all rules for company")
def list_rules():
    company_rules = [r for r in rules.values() if r.company_id == COMPANY_ID]
    return {"rules": [r.model_dump() for r in company_rules]}


@app.get("/api/rules/{rule_id}", summary="GET /api/rules/:id — single rule with approvers expanded")
def get_rule(rule_id: str):
    rule      = get_rule_or_404(rule_id)
    approvers = get_approvers_for_rule(rule_id)
    return {
        "rule": {
            **rule.model_dump(),
            "approvers": [expand_approver(a) for a in approvers]
        }
    }


@app.post("/api/rules", summary="POST /api/rules — create rule (Admin only)")
def create_rule(req: RuleCreateRequest):
    rule = Rule(
        company_id           = COMPANY_ID,
        name                 = req.name,
        rule_type            = req.ruleType,            # camelCase in → snake_case stored
        percentage_threshold = req.percentageThreshold,
    )
    rules[rule.id] = rule
    return {"rule": rule.model_dump(), "message": "Rule created."}


@app.put("/api/rules/{rule_id}", summary="PUT /api/rules/:id — update rule (Admin only)")
def update_rule(rule_id: str, req: RuleUpdateRequest):
    rule = get_rule_or_404(rule_id)

    if req.name is not None:
        rule.name = req.name
    if req.ruleType is not None:
        rule.rule_type = req.ruleType
    if req.percentageThreshold is not None:
        rule.percentage_threshold = req.percentageThreshold

    # Re-validate threshold requirement after update
    if rule.rule_type in (RuleType.PERCENTAGE, RuleType.HYBRID):
        if rule.percentage_threshold is None:
            raise HTTPException(
                400, f"percentageThreshold is required for rule_type '{rule.rule_type}'"
            )

    return {"rule": rule.model_dump(), "message": "Rule updated."}


@app.delete("/api/rules/{rule_id}", summary="DELETE /api/rules/:id — delete rule + cascade approvers (Admin only)")
def delete_rule(rule_id: str):
    get_rule_or_404(rule_id)

    # Cascade delete rule_approvers
    to_delete = [aid for aid, a in rule_approvers.items() if a.rule_id == rule_id]
    for aid in to_delete:
        del rule_approvers[aid]

    del rules[rule_id]
    return {"message": f"Rule '{rule_id}' and its approvers deleted."}


# ─────────────────────────────────────────────
# RULE APPROVERS  —  /api/rules/:id/approvers
# ─────────────────────────────────────────────

@app.get("/api/rules/{rule_id}/approvers",
         summary="GET /api/rules/:id/approvers — ordered approver list")
def list_approvers(rule_id: str):
    get_rule_or_404(rule_id)
    approvers = get_approvers_for_rule(rule_id)
    return {"approvers": [expand_approver(a) for a in approvers]}


@app.post("/api/rules/{rule_id}/approvers",
          summary="POST /api/rules/:id/approvers — add approver (Admin only)")
def add_approver(rule_id: str, req: AddApproverRequest):
    get_rule_or_404(rule_id)

    # Validate user exists and belongs to company
    user = users.get(req.userId)
    if not user:
        raise HTTPException(404, f"User '{req.userId}' not found.")
    if user.company_id != COMPANY_ID:
        raise HTTPException(400, "User does not belong to this company.")

    existing = get_approvers_for_rule(rule_id)

    # 409: user already an approver OR sequence already taken
    if any(a.user_id == req.userId for a in existing):
        raise HTTPException(409, "User is already an approver for this rule.")
    if any(a.sequence == req.sequence for a in existing):
        raise HTTPException(409, f"Sequence {req.sequence} is already taken for this rule.")

    ra = RuleApprover(
        rule_id         = rule_id,
        user_id         = req.userId,
        sequence        = req.sequence,
        is_key_approver = req.isKeyApprover,
    )
    rule_approvers[ra.id] = ra
    return {"approver": expand_approver(ra), "message": "Approver added."}


@app.put("/api/rules/{rule_id}/approvers/{approver_id}",
         summary="PUT /api/rules/:id/approvers/:approverId — update sequence/isKeyApprover (Admin only)")
def update_approver(rule_id: str, approver_id: str, req: UpdateApproverRequest):
    get_rule_or_404(rule_id)
    ra = rule_approvers.get(approver_id)
    if not ra or ra.rule_id != rule_id:
        raise HTTPException(404, f"Approver '{approver_id}' not found for rule '{rule_id}'.")

    if req.sequence is not None:
        # Check sequence uniqueness
        existing = get_approvers_for_rule(rule_id)
        if any(a.sequence == req.sequence and a.id != approver_id for a in existing):
            raise HTTPException(409, f"Sequence {req.sequence} already taken.")
        ra.sequence = req.sequence

    if req.isKeyApprover is not None:
        ra.is_key_approver = req.isKeyApprover

    return {"approver": expand_approver(ra), "message": "Approver updated."}


@app.delete("/api/rules/{rule_id}/approvers/{approver_id}",
            summary="DELETE /api/rules/:id/approvers/:approverId — remove approver (Admin only)")
def delete_approver(rule_id: str, approver_id: str):
    get_rule_or_404(rule_id)
    ra = rule_approvers.get(approver_id)
    if not ra or ra.rule_id != rule_id:
        raise HTTPException(404, f"Approver '{approver_id}' not found for rule '{rule_id}'.")
    del rule_approvers[approver_id]
    return {"message": f"Approver '{approver_id}' removed from rule '{rule_id}'."}


# ─────────────────────────────────────────────
# EXPENSES
# ─────────────────────────────────────────────

@app.post("/api/expenses/submit", summary="Submit an expense")
def submit_expense(req: ExpenseSubmitRequest):
    employee = users.get(req.submitted_by)
    if not employee:
        raise HTTPException(404, f"Employee '{req.submitted_by}' not found.")

    rule = get_rule_or_404(req.rule_id)
    approvers = get_approvers_for_rule(req.rule_id)

    if not approvers:
        raise HTTPException(400, f"Rule '{req.rule_id}' has no approvers configured.")

    # IS_MANAGER_APPROVER: if employee has is_manager=True flag,
    # auto-prepend their direct manager as sequence 0
    final_approvers = list(approvers)
    if employee.is_manager:
        manager_id = manager_map.get(req.submitted_by)
        if not manager_id:
            raise HTTPException(
                400,
                f"is_manager flag is set for '{req.submitted_by}' but no manager found in manager_map."
            )
        # Insert manager at sequence 0 (before all existing)
        manager_entry = RuleApprover(
            rule_id         = req.rule_id,
            user_id         = manager_id,
            sequence        = 0,
            is_key_approver = False,
        )
        final_approvers = [manager_entry] + final_approvers

    expense = ExpenseRecord(
        company_id         = COMPANY_ID,
        submitted_by       = req.submitted_by,
        vendor             = req.vendor,
        amount             = req.amount,
        currency           = req.currency,
        category           = req.category,
        rule_id            = req.rule_id,
        approver_sequence  = final_approvers,
        current_sequence_index = 0,
    )
    expense.audit_log.append({
        "timestamp":  str(expense.created_at),
        "actor_id":   req.submitted_by,
        "action":     "SUBMITTED",
        "comment":    None,
        "sequence":   None
    })
    expenses[expense.expense_id] = expense

    return {
        "expense_id": expense.expense_id,
        "message":    "Expense submitted successfully.",
        "rule_type":  rule.rule_type,
        "approvers":  [
            {"user_id": a.user_id, "sequence": a.sequence, "is_key_approver": a.is_key_approver}
            for a in final_approvers
        ]
    }


@app.post("/api/expenses/{expense_id}/approve", summary="Approve an expense")
def approve(expense_id: str, req: ActionRequest):
    expense = expenses.get(expense_id)
    if not expense:
        raise HTTPException(404, f"Expense '{expense_id}' not found.")
    rule = get_rule_or_404(expense.rule_id)

    ok, msg = process_action(expense, rule, req.approver_id, ApprovalStatus.APPROVED, req.comment)
    if not ok:
        raise HTTPException(400, msg)
    return {"expense_id": expense_id, "message": msg, "overall_status": expense.overall_status}


@app.post("/api/expenses/{expense_id}/reject", summary="Reject an expense")
def reject(expense_id: str, req: ActionRequest):
    expense = expenses.get(expense_id)
    if not expense:
        raise HTTPException(404, f"Expense '{expense_id}' not found.")
    if not req.comment:
        raise HTTPException(400, "A comment/reason is required when rejecting.")
    rule = get_rule_or_404(expense.rule_id)

    ok, msg = process_action(expense, rule, req.approver_id, ApprovalStatus.REJECTED, req.comment)
    if not ok:
        raise HTTPException(400, msg)
    return {"expense_id": expense_id, "message": msg, "overall_status": expense.overall_status}


@app.get("/api/expenses/{expense_id}/status", summary="Full expense status + audit trail")
def expense_status(expense_id: str):
    expense = expenses.get(expense_id)
    if not expense:
        raise HTTPException(404, f"Expense '{expense_id}' not found.")
    return {
        "expense_id":      expense.expense_id,
        "vendor":          expense.vendor,
        "amount":          expense.amount,
        "currency":        expense.currency,
        "category":        expense.category,
        "submitted_by":    expense.submitted_by,
        "rule_id":         expense.rule_id,
        "overall_status":  expense.overall_status,
        "resolution_note": expense.resolution_note,
        "approver_sequence": [
            {"user_id": a.user_id, "sequence": a.sequence, "is_key_approver": a.is_key_approver}
            for a in expense.approver_sequence
        ],
        "actions":  [
            {"approver_id": a.approver_id, "action": a.action,
             "comment": a.comment, "acted_at": str(a.acted_at)}
            for a in expense.actions
        ],
        "audit_log": expense.audit_log
    }


@app.get("/api/queue/{approver_id}", summary="Pending expenses in approver's queue")
def approver_queue(approver_id: str):
    if approver_id not in users:
        raise HTTPException(404, f"User '{approver_id}' not found.")
    queue = get_approver_queue(approver_id, expenses, rules)
    return {
        "approver_id":   approver_id,
        "pending_count": len(queue),
        "expenses": [
            {"expense_id": e.expense_id, "vendor": e.vendor, "amount": e.amount,
             "currency": e.currency, "category": e.category,
             "submitted_by": e.submitted_by, "submitted_at": str(e.created_at)}
            for e in queue
        ]
    }


# ─────────────────────────────────────────────
# USERS (helper)
# ─────────────────────────────────────────────

@app.get("/api/users", summary="List all users")
def list_users():
    return [u.model_dump() for u in users.values()]


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
