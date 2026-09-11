# Akpoly Computer Engineering — Public Website & Portal System

Phase 1 build: public landing page, dynamic registration, and login with
OTP/device recognition, backed by a real Express + SQLite API.

## What's included

```
akpoly-computer-engineering/
├── backend/                  Node.js + Express REST API
│   ├── src/
│   │   ├── config/           db.js, migrate.js, mailer.js
│   │   ├── controllers/      authController.js
│   │   ├── middleware/       auth.js (RBAC), upload.js, errorHandler.js
│   │   ├── models/           userModel.js, otpModel.js, auditModel.js
│   │   ├── routes/           authRoutes.js
│   │   └── server.js
│   ├── package.json
│   └── .env.example
├── database/
│   └── migrations/001_init.sql   users, students, lecturers, hods,
│                                  files, otp_codes, audit_logs, sessions
└── frontend/public/          Static site (no build step)
    ├── index.html            Landing page
    ├── register.html         Dynamic role-based registration + OTP step
    ├── login.html             Student/staff login + device OTP step
    ├── css/style.css
    └── js/{app,register,login}.js
```

## Why SQLite (recommended)

The blueprint targets a single Raspberry Pi with an external SSD. SQLite
needs no separate database service, backs up as a single file (matches the
"manual SQLite backup" requirement in the blueprint), and comfortably
handles a departmental system's read/write volume. `better-sqlite3` is used
because it's synchronous and fast, which keeps the controller code simple.
If the department later needs concurrent write-heavy access or a networked
DB server, the model layer is thin enough to swap for PostgreSQL without
touching routes or controllers.

## Running it locally

**Backend**

```bash
cd backend
npm install
cp .env.example .env        # edit JWT_SECRET and HOD_ADMIN_PASSCODE at minimum
npm run migrate             # creates database/akpoly.db and applies the schema
npm run dev                 # starts the API on http://localhost:4000
```

**Frontend**

The frontend is plain HTML/CSS/JS — no build step. Serve the `frontend/public`
folder with any static server, e.g.:

```bash
cd frontend/public
npx serve -l 5500
```

Then open `http://localhost:5500`. `js/app.js` points API calls at
`http://localhost:4000/api` automatically when running on localhost.

OTP codes print to the backend console (`[DEV MAIL]`) until you fill in
real SMTP credentials in `.env`.

## What's implemented vs. still to build

**Implemented (Phase 1):**
- Landing page, dynamic registration (student/lecturer/HOD), login
- Password hashing (bcrypt), OTP email verification, device-aware login OTP
- Receipt upload (validated type/size, stored outside the web root, metadata in DB)
- RBAC-ready session middleware (`requireAuth`, `requireRole`) for future portal routes
- Audit logging on registration, login success/failure, OTP events
- Rate limiting on auth endpoints

**Not yet built (next phases, per the development plan):**
- Student/Lecturer/HOD/Technician dashboards and their API routes
- Results workflow, timetables, jobs, approvals
- Technician telemetry, backups, log viewer
- Deployment to the actual Raspberry Pi + Cloudflare Tunnel

## Security notes for going to production

- Set a strong random `JWT_SECRET` and `HOD_ADMIN_PASSCODE` — never commit `.env`
- Put the backend behind HTTPS (Cloudflare Tunnel handles this per the blueprint)
- Configure real SMTP credentials so OTPs actually deliver
- `storage/receipts` and `database/akpoly.db` should live on the external SSD, outside any publicly served directory
