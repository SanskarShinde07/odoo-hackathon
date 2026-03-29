# Odoo Hackathon — Expense Reimbursement System

A full-stack expense reimbursement platform built for the Odoo Hackathon. Employees submit expenses with receipt uploads, managers/approvers action them through configurable workflows, and the system handles multi-currency conversion automatically.
Live Link: https://oddd-pearl.vercel.app/

---

## Architecture

The project is split into **4 services**, each independently deployable:

```
odoo-hackathon/
├── odoo_HackathonFrontend/     # React + TypeScript frontend (Vite)
├── reimbursment_odoo-main/     # Main backend — Auth, Users, Rules (Node.js + Express)
├── Approval-Engine/            # Approval workflow engine (Python + FastAPI)
└── OCR-Engine/                 # Receipt OCR + currency conversion (Python + FastAPI)
```

### Service Responsibilities

| Service | Tech | Responsibility |
|---|---|---|
| **Frontend** | React, TypeScript, Vite, MUI | UI for employees, managers, admins |
| **Main Backend** | Node.js, Express, TypeScript, Supabase | Auth, users, approval rules config |
| **Approval Engine** | Python, FastAPI | Expense submission, approval workflows, queue |
| **OCR Engine** | Python, FastAPI, Tesseract | Receipt scanning, amount extraction, currency conversion |

---

## Live Services (Railway)

| Service | URL |
|---|---|
| Main Backend | `https://reimbursmentodoo-production.up.railway.app` |
| Approval Engine | `https://approval-main-production.up.railway.app` |
| OCR Engine | `https://receipt-processor-production-fd7e.up.railway.app` |

---

## Features

- **Role-based access** — Admin, Manager, Employee roles with scoped permissions
- **Configurable approval rules** — Sequential, Percentage, Specific Approver, and Hybrid rule types
- **Key approver override** — Designated approvers (e.g. CFO) can auto-approve instantly
- **Receipt OCR** — Extracts amount, date, vendor, payment method from image/PDF receipts
- **Multi-currency support** — Auto-converts expense amounts to company base currency via live exchange rates
- **Audit trail** — Every action on an expense is logged with actor, timestamp, and comment
- **Approver queue** — Each approver sees only the expenses awaiting their action

---

## Approval Rule Types

| Type | Behaviour |
|---|---|
| `sequential` | Approvers must act in order — each step unlocks the next |
| `percentage` | A configurable % of approvers must approve (e.g. 60%) |
| `specific_approver` | A designated key approver's approval auto-approves the expense |
| `hybrid` | Percentage threshold **or** key approver approval — whichever triggers first |

---

## Getting Started

### Prerequisites

- Node.js 18+
- Python 3.10+
- Tesseract OCR (`apt-get install tesseract-ocr poppler-utils`)
- A [Supabase](https://supabase.com) project

---

### 1. Main Backend (`reimbursment_odoo-main`)

```bash
cd reimbursment_odoo-main
npm install
cp .env.example .env   # fill in your values
npm run dev
```

**Environment variables:**

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
JWT_SECRET=your-secret-min-32-chars
JWT_EXPIRES_IN=7d
PORT=3000
NODE_ENV=development
```

**API routes:**

| Method | Endpoint | Access | Description |
|---|---|---|---|
| POST | `/api/auth/signup` | Public | Create company + admin account |
| POST | `/api/auth/login` | Public | Login, returns JWT |
| GET | `/api/auth/me` | All | Get current user |
| GET | `/api/users` | All | List users (scoped by role) |
| POST | `/api/users` | Admin | Create employee/manager |
| PUT | `/api/users/:id` | Admin | Update user |
| DELETE | `/api/users/:id` | Admin | Remove user |
| GET | `/api/rules` | All | List approval rules |
| POST | `/api/rules` | Admin | Create rule |
| PUT | `/api/rules/:id` | Admin | Update rule |
| DELETE | `/api/rules/:id` | Admin | Delete rule |
| POST | `/api/rules/:id/approvers` | Admin | Add approver to rule |
| PUT | `/api/rules/:id/approvers/:aid` | Admin | Update approver sequence |
| DELETE | `/api/rules/:id/approvers/:aid` | Admin | Remove approver |
| GET | `/api/currency/convert` | All | Convert currency |
| GET | `/api/currency/rates/:base` | All | Exchange rates for base currency |

---

### 2. Approval Engine (`Approval-Engine`)

```bash
cd Approval-Engine
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

No environment variables required — uses an in-memory store by default.

**API routes:**

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/expenses/submit` | Submit a new expense |
| POST | `/api/expenses/:id/approve` | Approve an expense |
| POST | `/api/expenses/:id/reject` | Reject an expense (comment required) |
| GET | `/api/expenses/:id/status` | Full status + audit trail |
| GET | `/api/queue/:approver_id` | Pending expenses for an approver |
| GET | `/api/rules` | List rules |
| POST | `/api/rules` | Create rule |
| PUT | `/api/rules/:id` | Update rule |
| DELETE | `/api/rules/:id` | Delete rule |
| POST | `/api/rules/:id/approvers` | Add approver |
| PUT | `/api/rules/:id/approvers/:aid` | Update approver |
| DELETE | `/api/rules/:id/approvers/:aid` | Remove approver |
| GET | `/api/users` | List users |

**Run tests:**
```bash
python test_engine.py
```

---

### 3. OCR Engine (`OCR-Engine`)

```bash
cd OCR-Engine
apt-get install tesseract-ocr poppler-utils   # system deps
pip install -r requirements.txt
uvicorn api:app --reload --port 8001
```

**API routes:**

| Method | Endpoint | Description |
|---|---|---|
| POST | `/process-receipt` | Upload receipt image/PDF, returns structured data |
| GET | `/health` | Health check |

**Example request (multipart/form-data):**

```
POST /process-receipt
  file=<image or PDF>
  bill_country=UAE
  company_country=India
  category=Travel
```

**Example response:**
```json
{
  "amount": {
    "original": 200.0,
    "currency": "AED",
    "converted": 4534.0,
    "base_currency": "INR",
    "exchange_rate": 22.67
  },
  "date": "2024-10-04",
  "vendor": "Carrefour Dubai",
  "category": "Travel",
  "payment_method": "Visa",
  "confidence": { "amount": 0.95, "date": 0.9 },
  "warnings": []
}
```

---

### 4. Frontend (`odoo_HackathonFrontend`)

```bash
cd odoo_HackathonFrontend
npm install
cp .env.example .env   # fill in API URLs
npm run dev
```

**Environment variables:**

```env
VITE_API_BASE_URL=http://localhost:3000
VITE_APPROVAL_API_BASE_URL=http://localhost:8000
VITE_OCR_API_BASE_URL=http://localhost:8001
```

---

## Deployment

All services are configured for **Railway** deployment. Each service folder contains a `railway.toml` (or equivalent) that Railway picks up automatically.

Steps per service:
1. Push to GitHub
2. Create a new Railway service → **Deploy from GitHub repo**, select the subfolder
3. Add environment variables in the Railway dashboard
4. Railway handles build and start automatically

---

## Role Permissions

| Feature | Admin | Manager | Employee |
|---|---|---|---|
| Create company | ✅ | ❌ | ❌ |
| Manage users | ✅ | ❌ | ❌ |
| Configure approval rules | ✅ | ❌ | ❌ |
| Submit expenses | ✅ | ✅ | ✅ |
| Approve/Reject expenses | ✅ | ✅ | ❌ |
| View all users | ✅ | Team only | Self only |
| View rules | ✅ | ✅ | ✅ |
| Currency conversion | ✅ | ✅ | ✅ |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite, Material UI |
| Main Backend | Node.js, Express, TypeScript, Supabase (PostgreSQL) |
| Auth | Custom JWT + bcrypt |
| Validation | Zod (backend), Pydantic (Python services) |
| Approval Engine | Python, FastAPI |
| OCR | Tesseract, OpenCV, pdf2image |
| Currency API | [frankfurter.app](https://www.frankfurter.app) (free, ECB-backed) |
| Deployment | Railway |

---

## Team

Built for the Odoo Hackathon.
