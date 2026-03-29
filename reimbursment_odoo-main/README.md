# Reimbursement Management — Backend API

Express.js + TypeScript backend for the Reimbursement Management System. Designed to deploy on **Railway** with **Supabase** as the database.

---

## Stack

- **Runtime**: Node.js + TypeScript
- **Framework**: Express.js
- **Database**: Supabase (PostgreSQL)
- **Auth**: Custom JWT + bcrypt
- **Validation**: Zod
- **Deployment**: Railway

---

## Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment variables
```bash
cp .env.example .env
```

Fill in your `.env`:
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key   # ⚠️ Keep this secret!
JWT_SECRET=your-super-secret-jwt-key-min-32-chars
JWT_EXPIRES_IN=7d
PORT=3000
NODE_ENV=development
```

> Get your Supabase keys from: **Project Settings → API → Service role key**

### 3. Run locally
```bash
npm run dev
```

### 4. Build for production
```bash
npm run build
npm start
```

---

## Deploy on Railway

1. Push this repo to GitHub
2. Create a new Railway project → **Deploy from GitHub repo**
3. Add environment variables in Railway dashboard (same as `.env`)
4. Railway auto-detects `railway.toml` and runs `npm install && npm run build` then `npm start`

---

## API Reference

All protected routes require:
```
Authorization: Bearer <token>
```

### Auth

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| POST | `/api/auth/signup` | Public | Create company + admin account |
| POST | `/api/auth/login` | Public | Login, returns JWT |
| GET | `/api/auth/me` | All roles | Get current user profile |

#### POST `/api/auth/signup`
```json
{
  "companyName": "Acme Corp",
  "country": "India",
  "name": "John Doe",
  "email": "john@acme.com",
  "password": "securepassword"
}
```
> Auto-resolves currency code from country name using restcountries.com API

---

### Users

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | `/api/users` | All | List users (scoped by role) |
| GET | `/api/users/:id` | All | Get single user |
| POST | `/api/users` | Admin | Create employee/manager |
| PUT | `/api/users/:id` | Admin | Update role, manager, name |
| DELETE | `/api/users/:id` | Admin | Remove user |

#### POST `/api/users`
```json
{
  "name": "Jane Smith",
  "email": "jane@acme.com",
  "password": "securepassword",
  "role": "manager",
  "managerId": null,
  "isManagerApprover": true
}
```

---

### Rules

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | `/api/rules` | All | List all rules |
| GET | `/api/rules/:id` | All | Get rule with approvers |
| POST | `/api/rules` | Admin | Create rule |
| PUT | `/api/rules/:id` | Admin | Update rule |
| DELETE | `/api/rules/:id` | Admin | Delete rule |
| GET | `/api/rules/:id/approvers` | All | List approvers for rule |
| POST | `/api/rules/:id/approvers` | Admin | Add approver to rule |
| PUT | `/api/rules/:id/approvers/:aid` | Admin | Update approver sequence |
| DELETE | `/api/rules/:id/approvers/:aid` | Admin | Remove approver from rule |

#### POST `/api/rules`
```json
{
  "name": "Finance Approval",
  "ruleType": "percentage",
  "percentageThreshold": 60
}
```

**Rule types:**
- `sequential` — approvers must approve in order
- `percentage` — X% of approvers must approve (requires `percentageThreshold`)
- `specific_approver` — a key approver's approval auto-approves
- `hybrid` — percentage OR key approver (requires `percentageThreshold`)

#### POST `/api/rules/:id/approvers`
```json
{
  "userId": "uuid-of-user",
  "sequence": 1,
  "isKeyApprover": false
}
```

---

### Currency

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | `/api/currency/countries` | All | All countries + currency info |
| GET | `/api/currency/convert?amount=100&from=USD&to=INR` | All | Convert currency |
| GET | `/api/currency/rates/:base` | All | All rates for a base currency |

---

## Role Permissions

| Feature | Admin | Manager | Employee |
|---------|-------|---------|----------|
| Create company | ✅ (auto) | ❌ | ❌ |
| Manage users | ✅ | ❌ | ❌ |
| Configure rules | ✅ | ❌ | ❌ |
| View all users | ✅ | Team only | Self only |
| View rules | ✅ | ✅ | ✅ |
| Currency utils | ✅ | ✅ | ✅ |

---

## Notes for your friend (Python team)

The following tables are **not managed** by this service:
- `receipts` — submit, view, OCR
- `approvers` — approval tracking per receipt
- `approval_status` — overall status tracker

Your Python service can use the same Supabase project. Share the `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.

The JWT token format this service issues:
```json
{
  "userId": "uuid",
  "companyId": "uuid",
  "role": "admin|manager|employee",
  "email": "user@company.com"
}
```
