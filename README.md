# CampusSage AI

CampusSage AI is a React/Vite student academic workspace with a database-backed backend.

## Architecture

- **Frontend:** React + Vite
- **Backend:** Node.js + Express
- **Database:** PostgreSQL
- **Authentication:** bcrypt password hashing + JWT session token
- **Document storage:** server-side `backend/uploads/<user-id>/` (PDF/DOCX/PPTX)
- **API:** REST endpoints under `/api`

### Data flow

```text
Student Browser
      |
      v
React / Vite frontend
      |
      | REST + JWT
      v
Node.js / Express API
      |
      +--------------------+
      |                    |
      v                    v
PostgreSQL            File Storage
(users, profile,      backend/uploads
 documents metadata,  PDF/DOCX/PPTX
 timetable, planner,  actual files
 notices, chats)
```

## Run locally

### 1. Start PostgreSQL

From `backend/`:

```bash
docker compose up -d
```

### 2. Start backend

```bash
cd backend
copy .env.example .env
npm install
npm run dev
```

macOS/Linux: use `cp .env.example .env` instead of `copy`.

### 3. Start frontend

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`.

The frontend Vite server proxies `/api` to `http://localhost:4000`.

## Important

The current implementation is now genuinely database-backed, but the file storage is local to the backend server. For a multi-server production deployment, replace `backend/uploads` with object storage such as Supabase Storage or Amazon S3 and keep PostgreSQL managed.
