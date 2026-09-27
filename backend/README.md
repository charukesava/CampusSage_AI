# CampusSage AI Backend

CampusSage now uses a real PostgreSQL database for user accounts and application data, plus server-side file storage for uploaded PDF/DOCX/PPTX files.

## What is stored where?

- PostgreSQL: users, password hashes, profiles, settings, document metadata, timetable, planner, notices, chat threads and chat messages.
- `backend/uploads/<user-id>/`: the actual uploaded PDF/DOCX/PPTX files.
- Browser localStorage: only the JWT session token remains. Application data is no longer stored there.

## Local setup

Requirements: Node.js 20+ and Docker Desktop (or another PostgreSQL 17 instance).

1. Start PostgreSQL:

```bash
docker compose up -d
```

2. Create the environment file:

```bash
copy .env.example .env
```

On macOS/Linux use `cp .env.example .env`.

3. Install dependencies and start the API:

```bash
npm install
npm run dev
```

The API runs on `http://localhost:4000`.

4. In another terminal, start the frontend:

```bash
cd ../frontend
npm install
npm run dev
```

The frontend runs on `http://localhost:5173` and proxies `/api` to the backend.

## Production note

For production, move file storage from `backend/uploads` to object storage such as Supabase Storage or Amazon S3, keep PostgreSQL managed, use a strong random `JWT_SECRET`, HTTPS, rate limiting, and secure cookie-based sessions if appropriate for your deployment.
