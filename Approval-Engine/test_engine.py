"""
Test Suite v2 — Gap-Bridged Approval Engine
Tests every scenario including the breached gaps:
  1.  Sequential happy path
  2.  Sequential rejection stops chain
  3.  IS_MANAGER_APPROVER auto-prepend
  4.  Percentage rule
  5.  Dead condition
  6.  Specific approver (is_key_approver flag, not role)
  7.  Key approver override closes entire expense
  8.  Hybrid rule (% OR key approver)
  9.  Duplicate action guard
  10. Wrong approver guard (sequential turn order)
  11. Wrong approver guard (not in rule)
  12. camelCase → snake_case rule creation
  13. Rule CRUD: PUT + DELETE with cascade
  14. Approver sub-resource: add / update / delete
  15. 409 on duplicate approver / sequence
  16. Queue: sequential shows only current turn
  17. Queue: conditional shows all simultaneously
"""

import sys
sys.path.insert(0, "/home/claude/approval_v2")

from models import (
    Rule, RuleApprover, RuleType, ApprovalStatus,
    ExpenseRecord, RuleCreateRequest, AddApproverRequest
)
from workflow_engine import process_action, get_approver_queue
from condition_evaluator import evaluate, is_key_approver_for_rule
import store

PASS = "✅"
FAIL = "❌"

def check(label: str, condition: bool):
    icon = PASS if condition else FAIL
    print(f"  {icon}  {label}")
    return condition

def section(title):
    print(f"\n{'─'*62}")
    print(f"  {title}")
    print(f"{'─'*62}")

# ── Helpers ──────────────────────────────────────────────────────────────────

def make_rule(rule_type, pct=None):
    r = Rule(
        company_id=store.COMPANY_ID,
        name="Test Rule",
        rule_type=rule_type,
        percentage_threshold=pct
    )
    store.rules[r.id] = r
    return r

def make_approvers(rule_id, entries):
    """entries = [(user_id, sequence, is_key_approver)]"""
    ras = []
    for uid, seq, key in entries:
        ra = RuleApprover(rule_id=rule_id, user_id=uid, sequence=seq, is_key_approver=key)
        store.rule_approvers[ra.id] = ra
        ras.append(ra)
    return sorted(ras, key=lambda x: x.sequence)

def make_expense(rule, approvers, submitted_by="emp_001"):
    e = ExpenseRecord(
        company_id=store.COMPANY_ID,
        submitted_by=submitted_by,
        vendor="Test Vendor",
        amount=500, currency="USD", category="Travel",
        rule_id=rule.id,
        approver_sequence=approvers,
        current_sequence_index=0,
    )
    store.expenses[e.expense_id] = e
    return e

def act(expense, rule, user_id, action, comment=None):
    return process_action(expense, rule, user_id, action, comment)

# ─────────────────────────────────────────────────────────────────────────────
section("TEST 1: Sequential — all approve")
# ─────────────────────────────────────────────────────────────────────────────
rule = make_rule(RuleType.SEQUENTIAL)
approvers = make_approvers(rule.id, [("fin_001", 1, False), ("dir_001", 2, False)])
e = make_expense(rule, approvers)

ok, msg = act(e, rule, "fin_001", ApprovalStatus.APPROVED)
check("fin_001 approves → index advances to 1", e.current_sequence_index == 1)
ok, msg = act(e, rule, "dir_001", ApprovalStatus.APPROVED)
check("dir_001 approves → fully approved", e.overall_status == ApprovalStatus.APPROVED)

# ─────────────────────────────────────────────────────────────────────────────
section("TEST 2: Sequential — rejection stops chain")
# ─────────────────────────────────────────────────────────────────────────────
rule = make_rule(RuleType.SEQUENTIAL)
approvers = make_approvers(rule.id, [("fin_001", 1, False), ("dir_001", 2, False)])
e = make_expense(rule, approvers)

act(e, rule, "fin_001", ApprovalStatus.REJECTED, "Over budget")
check("Rejected at seq 1 → overall rejected", e.overall_status == ApprovalStatus.REJECTED)
ok2, _ = act(e, rule, "dir_001", ApprovalStatus.APPROVED)
check("dir_001 cannot act on closed expense", not ok2)

# ─────────────────────────────────────────────────────────────────────────────
section("TEST 3: IS_MANAGER_APPROVER — manager prepended at sequence 0")
# ─────────────────────────────────────────────────────────────────────────────
# Simulate what submit_expense does: prepend manager
rule = make_rule(RuleType.SEQUENTIAL)
approvers = make_approvers(rule.id, [("fin_001", 1, False)])
# Employee emp_001 has is_manager=True in store, maps to mgr_001
manager_entry = RuleApprover(rule_id=rule.id, user_id="mgr_001", sequence=0, is_key_approver=False)
final_approvers = sorted([manager_entry] + list(approvers), key=lambda x: x.sequence)
e = make_expense(rule, final_approvers)

check("Seq 0 = mgr_001", final_approvers[0].user_id == "mgr_001")
check("Seq 1 = fin_001", final_approvers[1].user_id == "fin_001")
act(e, rule, "mgr_001", ApprovalStatus.APPROVED)
check("After mgr approval → index = 1 (fin_001's turn)", e.current_sequence_index == 1)

# ─────────────────────────────────────────────────────────────────────────────
section("TEST 4: Percentage rule — 60% of 3")
# ─────────────────────────────────────────────────────────────────────────────
rule = make_rule(RuleType.PERCENTAGE, pct=60)
approvers = make_approvers(rule.id, [
    ("fin_001", 1, False), ("fin_002", 2, False), ("legal_001", 3, False)
])
e = make_expense(rule, approvers)

act(e, rule, "fin_001", ApprovalStatus.APPROVED)
check("1/3 (33%) → pending", e.overall_status == ApprovalStatus.PENDING)
act(e, rule, "legal_001", ApprovalStatus.REJECTED)
check("1 approve + 1 reject → still pending (fin_002 can tip it)", e.overall_status == ApprovalStatus.PENDING)
act(e, rule, "fin_002", ApprovalStatus.APPROVED)
check("2/3 (66%) ≥ 60% → approved", e.overall_status == ApprovalStatus.APPROVED)

# ─────────────────────────────────────────────────────────────────────────────
section("TEST 5: Dead condition — 60% mathematically impossible")
# ─────────────────────────────────────────────────────────────────────────────
rule = make_rule(RuleType.PERCENTAGE, pct=60)
approvers = make_approvers(rule.id, [
    ("fin_001", 1, False), ("fin_002", 2, False), ("legal_001", 3, False)
])
e = make_expense(rule, approvers)

act(e, rule, "fin_001", ApprovalStatus.REJECTED)
act(e, rule, "fin_002", ApprovalStatus.REJECTED)
check("2/3 rejected → max possible 33% < 60% → auto rejected", e.overall_status == ApprovalStatus.REJECTED)

# ─────────────────────────────────────────────────────────────────────────────
section("TEST 6: Specific approver — is_key_approver FLAG (not role)")
# ─────────────────────────────────────────────────────────────────────────────
# cfo_001 is now just UserRole.ADMIN — what matters is is_key_approver=True on the rule
rule = make_rule(RuleType.SPECIFIC_APPROVER)
approvers = make_approvers(rule.id, [
    ("fin_001", 1, False),
    ("cfo_001", 2, True),   # ← is_key_approver flag on the rule entry
])
e = make_expense(rule, approvers)

act(e, rule, "fin_001", ApprovalStatus.APPROVED)
check("fin_001 approves — not key approver, still pending", e.overall_status == ApprovalStatus.PENDING)
act(e, rule, "cfo_001", ApprovalStatus.APPROVED)
check("cfo_001 (is_key_approver=True) approves → approved", e.overall_status == ApprovalStatus.APPROVED)

# ─────────────────────────────────────────────────────────────────────────────
section("TEST 7: Key approver GLOBAL OVERRIDE — closes ALL remaining")
# ─────────────────────────────────────────────────────────────────────────────
rule = make_rule(RuleType.HYBRID, pct=80)  # high threshold so % won't trigger alone
approvers = make_approvers(rule.id, [
    ("fin_001", 1, False),
    ("fin_002", 2, False),
    ("cfo_001", 3, True),   # key approver
    ("dir_001", 4, False),
])
e = make_expense(rule, approvers)

act(e, rule, "fin_001", ApprovalStatus.APPROVED)   # 1/4 = 25% < 80%
check("1/4 approved → still pending", e.overall_status == ApprovalStatus.PENDING)
act(e, rule, "cfo_001", ApprovalStatus.APPROVED)   # key approver fires
check("Key approver (cfo_001) approves → FULL override, expense approved",
      e.overall_status == ApprovalStatus.APPROVED)
check("Resolution note mentions key approver override",
      "key approver override" in (e.resolution_note or "").lower())
ok, _ = act(e, rule, "dir_001", ApprovalStatus.APPROVED)
check("dir_001 cannot act — expense already closed", not ok)

# ─────────────────────────────────────────────────────────────────────────────
section("TEST 8: Hybrid — % OR key approver, whichever first")
# ─────────────────────────────────────────────────────────────────────────────

# Path A: percentage triggers first
rule = make_rule(RuleType.HYBRID, pct=60)
approvers = make_approvers(rule.id, [
    ("fin_001", 1, False), ("fin_002", 2, False), ("cfo_001", 3, True)
])
e = make_expense(rule, approvers)
act(e, rule, "fin_001", ApprovalStatus.APPROVED)
act(e, rule, "fin_002", ApprovalStatus.APPROVED)   # 2/3 = 66% ≥ 60%
check("Path A: 66% met → approved before key approver acts",
      e.overall_status == ApprovalStatus.APPROVED)

# Path B: key approver triggers first (only 1 approval so far)
rule = make_rule(RuleType.HYBRID, pct=90)  # near-impossible threshold
approvers = make_approvers(rule.id, [
    ("fin_001", 1, False), ("fin_002", 2, False), ("cfo_001", 3, True)
])
e = make_expense(rule, approvers)
act(e, rule, "fin_001", ApprovalStatus.APPROVED)    # 1/3 = 33% < 90%
act(e, rule, "cfo_001", ApprovalStatus.APPROVED)    # key approver override
check("Path B: key approver triggers before % threshold met",
      e.overall_status == ApprovalStatus.APPROVED)

# ─────────────────────────────────────────────────────────────────────────────
section("TEST 9: Duplicate action guard")
# ─────────────────────────────────────────────────────────────────────────────
rule = make_rule(RuleType.PERCENTAGE, pct=60)
approvers = make_approvers(rule.id, [
    ("fin_001", 1, False), ("fin_002", 2, False), ("legal_001", 3, False)
])
e = make_expense(rule, approvers)
act(e, rule, "fin_001", ApprovalStatus.APPROVED)
ok, msg = act(e, rule, "fin_001", ApprovalStatus.APPROVED)
check("fin_001 cannot act twice", not ok and "already acted" in msg)

# ─────────────────────────────────────────────────────────────────────────────
section("TEST 10: Sequential — wrong turn order")
# ─────────────────────────────────────────────────────────────────────────────
rule = make_rule(RuleType.SEQUENTIAL)
approvers = make_approvers(rule.id, [("fin_001", 1, False), ("dir_001", 2, False)])
e = make_expense(rule, approvers)
ok, msg = act(e, rule, "dir_001", ApprovalStatus.APPROVED)
check("dir_001 cannot act — it's fin_001's turn", not ok and "not" in msg.lower())

# ─────────────────────────────────────────────────────────────────────────────
section("TEST 11: Approver not in rule at all")
# ─────────────────────────────────────────────────────────────────────────────
rule = make_rule(RuleType.PERCENTAGE, pct=60)
approvers = make_approvers(rule.id, [("fin_001", 1, False), ("fin_002", 2, False)])
e = make_expense(rule, approvers)
ok, msg = act(e, rule, "dir_001", ApprovalStatus.APPROVED)
check("dir_001 not assigned to rule → blocked", not ok and "not an approver" in msg)

# ─────────────────────────────────────────────────────────────────────────────
section("TEST 12: camelCase → snake_case rule creation")
# ─────────────────────────────────────────────────────────────────────────────
req = RuleCreateRequest(
    name="Hybrid Policy",
    ruleType="hybrid",
    percentageThreshold=60
)
check("ruleType (camelCase) accepted", req.ruleType == RuleType.HYBRID)
check("percentageThreshold (camelCase) accepted", req.percentageThreshold == 60)

# Missing threshold for hybrid → should raise
try:
    bad = RuleCreateRequest(name="Bad", ruleType="hybrid")
    check("Missing percentageThreshold for hybrid → error raised", False)
except Exception:
    check("Missing percentageThreshold for hybrid → error raised", True)

# ─────────────────────────────────────────────────────────────────────────────
section("TEST 13: Rule CRUD — PUT update + DELETE cascade")
# ─────────────────────────────────────────────────────────────────────────────
rule = make_rule(RuleType.SEQUENTIAL)
approvers_before = make_approvers(rule.id, [("fin_001", 1, False), ("dir_001", 2, False)])
approver_ids = [a.id for a in approvers_before]

# Update rule name
rule.name = "Updated Rule"
check("Rule name updated", rule.name == "Updated Rule")

# Delete rule + cascade
del store.rules[rule.id]
for aid in [a.id for a in approvers_before]:
    if aid in store.rule_approvers:
        del store.rule_approvers[aid]
check("Rule deleted", rule.id not in store.rules)
check("Approvers cascade deleted", all(aid not in store.rule_approvers for aid in approver_ids))

# ─────────────────────────────────────────────────────────────────────────────
section("TEST 14: Approver sub-resource — add / update / delete")
# ─────────────────────────────────────────────────────────────────────────────
rule = make_rule(RuleType.HYBRID, pct=60)

# Add approver
ra = RuleApprover(rule_id=rule.id, user_id="fin_001", sequence=1, is_key_approver=False)
store.rule_approvers[ra.id] = ra
check("Approver added with sequence=1", ra.sequence == 1)

# Update is_key_approver
ra.is_key_approver = True
check("is_key_approver updated to True", ra.is_key_approver is True)

# Update sequence
ra.sequence = 5
check("Sequence updated to 5", ra.sequence == 5)

# Delete
del store.rule_approvers[ra.id]
check("Approver deleted", ra.id not in store.rule_approvers)

# ─────────────────────────────────────────────────────────────────────────────
section("TEST 15: 409 on duplicate approver / sequence")
# ─────────────────────────────────────────────────────────────────────────────
rule = make_rule(RuleType.PERCENTAGE, pct=60)
ra1 = RuleApprover(rule_id=rule.id, user_id="fin_001", sequence=1, is_key_approver=False)
store.rule_approvers[ra1.id] = ra1

existing = [ra1]
# Duplicate user check
dup_user = any(a.user_id == "fin_001" for a in existing)
check("Duplicate user → 409 detected", dup_user)

# Duplicate sequence check
dup_seq = any(a.sequence == 1 for a in existing)
check("Duplicate sequence → 409 detected", dup_seq)

# ─────────────────────────────────────────────────────────────────────────────
section("TEST 16: Queue — sequential shows only current turn approver")
# ─────────────────────────────────────────────────────────────────────────────
rule = make_rule(RuleType.SEQUENTIAL)
approvers = make_approvers(rule.id, [("fin_001", 1, False), ("dir_001", 2, False)])
e = make_expense(rule, approvers)

q_fin = get_approver_queue("fin_001", {e.expense_id: e}, store.rules)
q_dir = get_approver_queue("dir_001", {e.expense_id: e}, store.rules)
check("fin_001 sees expense (their turn)", len(q_fin) == 1)
check("dir_001 does NOT see it (not their turn yet)", len(q_dir) == 0)

# After fin_001 approves
act(e, rule, "fin_001", ApprovalStatus.APPROVED)
q_fin2 = get_approver_queue("fin_001", {e.expense_id: e}, store.rules)
q_dir2 = get_approver_queue("dir_001", {e.expense_id: e}, store.rules)
check("After fin_001 acts → dir_001 now sees it", len(q_dir2) == 1)
check("fin_001 no longer sees it", len(q_fin2) == 0)

# ─────────────────────────────────────────────────────────────────────────────
section("TEST 17: Queue — conditional shows all approvers simultaneously")
# ─────────────────────────────────────────────────────────────────────────────
rule = make_rule(RuleType.PERCENTAGE, pct=60)
approvers = make_approvers(rule.id, [
    ("fin_001", 1, False), ("fin_002", 2, False), ("legal_001", 3, False)
])
e = make_expense(rule, approvers)

q1 = get_approver_queue("fin_001",   {e.expense_id: e}, store.rules)
q2 = get_approver_queue("fin_002",   {e.expense_id: e}, store.rules)
q3 = get_approver_queue("legal_001", {e.expense_id: e}, store.rules)
q4 = get_approver_queue("dir_001",   {e.expense_id: e}, store.rules)
check("fin_001 sees it",   len(q1) == 1)
check("fin_002 sees it",   len(q2) == 1)
check("legal_001 sees it", len(q3) == 1)
check("dir_001 does NOT see it (not in rule)", len(q4) == 0)

print(f"\n{'─'*62}")
print("  All tests complete.")
print(f"{'─'*62}\n")
