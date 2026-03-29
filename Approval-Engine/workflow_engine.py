from models import (
    ExpenseRecord, ApprovalStatus, RuleApprover,
    ApproverAction, AuditEntry, RuleType, Rule
)
from condition_evaluator import evaluate, is_key_approver_for_rule
from datetime import datetime
from typing import Tuple, List


# ─────────────────────────────────────────────
# WORKFLOW ENGINE
# ─────────────────────────────────────────────

def _audit(expense: ExpenseRecord, actor_id: str, action: str,
           comment: str = None, sequence: int = None):
    expense.audit_log.append(AuditEntry(
        actor_id=actor_id,
        action=action,
        comment=comment,
        sequence=sequence
    ))


def _resolve(expense: ExpenseRecord, status: ApprovalStatus, note: str, actor_id: str):
    expense.overall_status  = status
    expense.resolved_at     = datetime.utcnow()
    expense.resolution_note = note
    _audit(expense, actor_id, f"EXPENSE {status.value.upper()}: {note}")


def _cancel_remaining(expense: ExpenseRecord, reason: str):
    _audit(expense, "SYSTEM", reason)


def current_approver(expense: ExpenseRecord) -> RuleApprover | None:
    """For sequential rules — the approver at current_sequence_index."""
    idx = expense.current_sequence_index
    if 0 <= idx < len(expense.approver_sequence):
        return expense.approver_sequence[idx]
    return None


def already_acted(expense: ExpenseRecord, user_id: str) -> bool:
    return any(a.approver_id == user_id for a in expense.actions)


# ─────────────────────────────────────────────
# MAIN: process an approver action
# ─────────────────────────────────────────────

def process_action(
    expense:   ExpenseRecord,
    rule:      Rule,
    approver_id: str,
    action:    ApprovalStatus,
    comment:   str = None,
) -> Tuple[bool, str]:

    # ── Guard: expense must still be open ───────────────────────────────────
    if expense.overall_status != ApprovalStatus.PENDING:
        return False, f"Expense is already {expense.overall_status.value}."

    approvers = expense.approver_sequence   # sequence-sorted snapshot

    # ── Validate approver belongs to this rule ───────────────────────────────
    if not any(a.user_id == approver_id for a in approvers):
        return False, (
            f"'{approver_id}' is not an approver for this expense. "
            f"Assigned: {[a.user_id for a in approvers]}"
        )

    # ── KEY APPROVER GLOBAL OVERRIDE ─────────────────────────────────────────
    # If the acting user has is_key_approver=True on this rule AND approves
    # → entire expense auto-approved immediately, all steps skipped.
    # Applies to: specific_approver and hybrid rules only.
    # For sequential, key approver just approves their step normally.
    if (
        action == ApprovalStatus.APPROVED
        and rule.rule_type in (RuleType.SPECIFIC_APPROVER, RuleType.HYBRID)
        and is_key_approver_for_rule(approver_id, approvers)
    ):
        # Record the action
        expense.actions.append(ApproverAction(
            approver_id=approver_id, action=action, comment=comment
        ))
        _cancel_remaining(
            expense,
            f"Key approver override by '{approver_id}' — remaining approvers cancelled"
        )
        _resolve(
            expense,
            ApprovalStatus.APPROVED,
            f"Auto-approved via key approver override by '{approver_id}'",
            approver_id
        )
        return True, "Key approver override: expense fully approved."

    # ─────────────────────────────────────────────────────────────────────────
    # SEQUENTIAL RULE
    # ─────────────────────────────────────────────────────────────────────────
    if rule.rule_type == RuleType.SEQUENTIAL:
        cur = current_approver(expense)
        if not cur:
            return False, "No active approver found. Expense may already be resolved."

        if cur.user_id != approver_id:
            return False, (
                f"It is not '{approver_id}'s turn. "
                f"Current approver: '{cur.user_id}' (sequence {cur.sequence})"
            )

        if already_acted(expense, approver_id):
            return False, f"'{approver_id}' has already acted on this expense."

        expense.actions.append(ApproverAction(
            approver_id=approver_id, action=action, comment=comment
        ))
        _audit(expense, approver_id, action.value.upper(),
               comment=comment, sequence=cur.sequence)

        if action == ApprovalStatus.REJECTED:
            _cancel_remaining(
                expense,
                f"Rejected at sequence {cur.sequence} by '{approver_id}' — chain stopped"
            )
            _resolve(
                expense,
                ApprovalStatus.REJECTED,
                f"Rejected at sequence {cur.sequence} by '{approver_id}': {comment or 'No comment'}",
                approver_id
            )
            return True, f"Expense rejected at sequence {cur.sequence}."

        # APPROVED — advance
        expense.current_sequence_index += 1
        if expense.current_sequence_index >= len(approvers):
            _resolve(
                expense, ApprovalStatus.APPROVED,
                f"All approvers completed. Final: '{approver_id}'.",
                approver_id
            )
            return True, "Expense fully approved — all approvers completed."

        next_approver = approvers[expense.current_sequence_index]
        _audit(expense, "SYSTEM",
               f"Advanced to sequence {next_approver.sequence} → '{next_approver.user_id}'")
        return True, (
            f"Sequence {cur.sequence} approved. "
            f"Now waiting on '{next_approver.user_id}' (sequence {next_approver.sequence})."
        )

    # ─────────────────────────────────────────────────────────────────────────
    # PERCENTAGE / SPECIFIC_APPROVER / HYBRID
    # All approvers see it simultaneously.
    # ─────────────────────────────────────────────────────────────────────────
    else:
        if already_acted(expense, approver_id):
            return False, f"'{approver_id}' has already acted on this expense."

        expense.actions.append(ApproverAction(
            approver_id=approver_id, action=action, comment=comment
        ))
        approver_entry = next(a for a in approvers if a.user_id == approver_id)
        _audit(expense, approver_id, action.value.upper(),
               comment=comment, sequence=approver_entry.sequence)

        # Re-evaluate condition after this action
        result, reason = evaluate(
            rule_type            = rule.rule_type,
            percentage_threshold = rule.percentage_threshold,
            approvers            = approvers,
            actions              = expense.actions,
        )

        if result == ApprovalStatus.APPROVED:
            _audit(expense, "SYSTEM", f"Condition met: {reason}")
            _resolve(expense, ApprovalStatus.APPROVED, reason, "SYSTEM")
            return True, f"Condition met: {reason}. Expense fully approved."

        elif result == ApprovalStatus.REJECTED:
            _cancel_remaining(expense, f"Condition failed: {reason}")
            _resolve(expense, ApprovalStatus.REJECTED, reason, "SYSTEM")
            return True, f"Condition dead: {reason}. Expense rejected."

        else:
            return True, f"Action recorded. Still pending: {reason}"


# ─────────────────────────────────────────────
# QUEUE
# ─────────────────────────────────────────────

def get_approver_queue(approver_id: str, all_expenses: dict, all_rules: dict) -> list:
    queue = []
    for expense in all_expenses.values():
        if expense.overall_status != ApprovalStatus.PENDING:
            continue

        rule = all_rules.get(expense.rule_id)
        if not rule:
            continue

        # Must be an assigned approver
        if not any(a.user_id == approver_id for a in expense.approver_sequence):
            continue

        # Must not have already acted
        if already_acted(expense, approver_id):
            continue

        # Sequential: only show if it's their turn
        if rule.rule_type == RuleType.SEQUENTIAL:
            cur = current_approver(expense)
            if not cur or cur.user_id != approver_id:
                continue

        queue.append(expense)
    return queue
