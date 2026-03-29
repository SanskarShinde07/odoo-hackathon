from models import User, UserRole, Rule, RuleApprover, ExpenseRecord
from typing import Dict

# ─────────────────────────────────────────────
# IN-MEMORY STORE
# ─────────────────────────────────────────────

COMPANY_ID = "company-abc-123"

users: Dict[str, User] = {
    "emp_001":   User(id="emp_001",   name="Alice",   email="alice@co.com",   role=UserRole.EMPLOYEE, company_id=COMPANY_ID, is_manager=False),
    "mgr_001":   User(id="mgr_001",   name="Bob",     email="bob@co.com",     role=UserRole.MANAGER,  company_id=COMPANY_ID, is_manager=True),
    "fin_001":   User(id="fin_001",   name="Carol",   email="carol@co.com",   role=UserRole.FINANCE,  company_id=COMPANY_ID, is_manager=False),
    "fin_002":   User(id="fin_002",   name="Frank",   email="frank@co.com",   role=UserRole.FINANCE,  company_id=COMPANY_ID, is_manager=False),
    "legal_001": User(id="legal_001", name="Grace",   email="grace@co.com",   role=UserRole.FINANCE,  company_id=COMPANY_ID, is_manager=False),
    "dir_001":   User(id="dir_001",   name="Dave",    email="dave@co.com",    role=UserRole.DIRECTOR, company_id=COMPANY_ID, is_manager=False),
    "cfo_001":   User(id="cfo_001",   name="Eve CFO", email="cfo@co.com",     role=UserRole.ADMIN,    company_id=COMPANY_ID, is_manager=False),
}

# employee → direct manager mapping
manager_map: Dict[str, str] = {
    "emp_001": "mgr_001",
}

rules:          Dict[str, Rule]         = {}
rule_approvers: Dict[str, RuleApprover] = {}   # keyed by RuleApprover.id
expenses:       Dict[str, ExpenseRecord] = {}
