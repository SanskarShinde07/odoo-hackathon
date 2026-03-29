from models import RuleType, ApprovalStatus, RuleApprover, ApproverAction, ExpenseRecord
from typing import List, Tuple


# ─────────────────────────────────────────────
# CONDITION EVALUATOR
# Works off rule_type (rule-level) and
# is_key_approver flag per approver entry.
# ─────────────────────────────────────────────

def get_action(actions: List[ApproverAction], user_id: str) -> ApproverAction | None:
    return next((a for a in actions if a.approver_id == user_id), None)


def evaluate(
    rule_type:            RuleType,
    percentage_threshold: int | None,
    approvers:            List[RuleApprover],   # ALL approvers for this rule (sequence-sorted)
    actions:              List[ApproverAction],
) -> Tuple[ApprovalStatus, str]:
    """
    Returns (ApprovalStatus, reason).

    APPROVED → condition met
    REJECTED → condition can no longer be met (dead)
    PENDING  → waiting for more actions
    """

    total      = len(approvers)
    approved   = [a for a in actions if a.action == ApprovalStatus.APPROVED]
    rejected   = [a for a in actions if a.action == ApprovalStatus.REJECTED]
    n_approved = len(approved)
    n_rejected = len(rejected)
    n_pending  = total - n_approved - n_rejected

    # ── SEQUENTIAL ───────────────────────────────────────────────────────────
    # Handled step-by-step in workflow_engine, not here.
    # This evaluator is only called for non-sequential rules.

    # ── PERCENTAGE ───────────────────────────────────────────────────────────
    if rule_type == RuleType.PERCENTAGE:
        threshold = (percentage_threshold or 60) / 100
        current   = n_approved / total

        if current >= threshold:
            return (
                ApprovalStatus.APPROVED,
                f"{n_approved}/{total} approved ({current*100:.0f}% ≥ {percentage_threshold}%)"
            )
        max_possible = (n_approved + n_pending) / total
        if max_possible < threshold:
            return (
                ApprovalStatus.REJECTED,
                f"Dead: max possible {max_possible*100:.0f}% < {percentage_threshold}% threshold"
            )
        return (
            ApprovalStatus.PENDING,
            f"{n_approved}/{total} approved so far, need {percentage_threshold}%"
        )

    # ── SPECIFIC APPROVER ────────────────────────────────────────────────────
    elif rule_type == RuleType.SPECIFIC_APPROVER:
        key_approvers = [a for a in approvers if a.is_key_approver]
        if not key_approvers:
            return (ApprovalStatus.REJECTED, "No key approver defined for specific_approver rule")

        for ka in key_approvers:
            action = get_action(actions, ka.user_id)
            if action and action.action == ApprovalStatus.APPROVED:
                return (
                    ApprovalStatus.APPROVED,
                    f"Key approver '{ka.user_id}' approved → auto-approved"
                )

        # Check if all key approvers have rejected
        all_key_rejected = all(
            get_action(actions, ka.user_id) and
            get_action(actions, ka.user_id).action == ApprovalStatus.REJECTED
            for ka in key_approvers
        )
        if all_key_rejected:
            return (
                ApprovalStatus.REJECTED,
                "All key approvers rejected → expense rejected"
            )

        return (
            ApprovalStatus.PENDING,
            f"Waiting for key approver(s): {[ka.user_id for ka in key_approvers]}"
        )

    # ── HYBRID ───────────────────────────────────────────────────────────────
    elif rule_type == RuleType.HYBRID:
        threshold     = (percentage_threshold or 60) / 100
        key_approvers = [a for a in approvers if a.is_key_approver]

        # Key approver check (whichever triggers first wins)
        for ka in key_approvers:
            action = get_action(actions, ka.user_id)
            if action and action.action == ApprovalStatus.APPROVED:
                return (
                    ApprovalStatus.APPROVED,
                    f"Hybrid: key approver '{ka.user_id}' approved → auto-approved"
                )

        # Percentage check
        current = n_approved / total
        if current >= threshold:
            return (
                ApprovalStatus.APPROVED,
                f"Hybrid: {n_approved}/{total} approved ({current*100:.0f}% ≥ {percentage_threshold}%)"
            )

        # Dead check: can neither condition ever be met?
        max_possible            = (n_approved + n_pending) / total
        any_key_still_pending   = any(
            get_action(actions, ka.user_id) is None for ka in key_approvers
        )
        pct_dead = max_possible < threshold
        key_dead = not any_key_still_pending   # all key approvers already acted (and didn't approve)

        if pct_dead and key_dead:
            return (
                ApprovalStatus.REJECTED,
                f"Hybrid: dead — max possible {max_possible*100:.0f}% < {percentage_threshold}% "
                f"and no key approver can act"
            )

        return (
            ApprovalStatus.PENDING,
            f"Hybrid: {n_approved}/{total} approved, waiting for more or key approver"
        )

    return (ApprovalStatus.PENDING, "Unknown rule type")


def is_key_approver_for_rule(user_id: str, approvers: List[RuleApprover]) -> bool:
    """
    Returns True if user has is_key_approver=True on this rule.
    This replaces the old hardcoded CFO role check.
    """
    return any(a.user_id == user_id and a.is_key_approver for a in approvers)
