CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'student',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Safe migration for databases created before roles existed.
ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'student';
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('student','teacher','admin'));

CREATE TABLE IF NOT EXISTS profiles (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Student',
  register_number TEXT NOT NULL DEFAULT '',
  department TEXT NOT NULL DEFAULT '',
  semester TEXT NOT NULL DEFAULT '',
  college_name TEXT NOT NULL DEFAULT '',
  preferred_language TEXT NOT NULL DEFAULT 'English',
  subjects JSONB NOT NULL DEFAULT '[]'::jsonb,
  phone TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS settings (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  theme TEXT NOT NULL DEFAULT 'light',
  notifications BOOLEAN NOT NULL DEFAULT TRUE,
  email_notifications BOOLEAN NOT NULL DEFAULT FALSE,
  language TEXT NOT NULL DEFAULT 'English',
  account_privacy TEXT NOT NULL DEFAULT 'private',
  ai_response_style TEXT NOT NULL DEFAULT 'balanced',
  default_answer_format TEXT NOT NULL DEFAULT 'automatic',
  exam_mode BOOLEAN NOT NULL DEFAULT FALSE,
  include_examples BOOLEAN NOT NULL DEFAULT TRUE,
  use_documents BOOLEAN NOT NULL DEFAULT TRUE,
  prefer_documents BOOLEAN NOT NULL DEFAULT FALSE,
  show_citations BOOLEAN NOT NULL DEFAULT TRUE,
  save_chat_history BOOLEAN NOT NULL DEFAULT TRUE,
  use_chat_context BOOLEAN NOT NULL DEFAULT TRUE,
  auto_chat_titles BOOLEAN NOT NULL DEFAULT TRUE
);
-- Safe migrations for users who already have a settings table from an earlier version.
ALTER TABLE settings ADD COLUMN IF NOT EXISTS email_notifications BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS ai_response_style TEXT NOT NULL DEFAULT 'balanced';
ALTER TABLE settings ADD COLUMN IF NOT EXISTS default_answer_format TEXT NOT NULL DEFAULT 'automatic';
ALTER TABLE settings ADD COLUMN IF NOT EXISTS exam_mode BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS include_examples BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS use_documents BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS prefer_documents BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS show_citations BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS save_chat_history BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS use_chat_context BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS auto_chat_titles BOOLEAN NOT NULL DEFAULT TRUE;


CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  original_name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_type TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Uploaded',
  size_bytes BIGINT NOT NULL,
  page_count INTEGER,
  storage_path TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'uploaded',
  tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  source_pages JSONB NOT NULL DEFAULT '[]'::jsonb,
  semester TEXT NOT NULL DEFAULT 'Unassigned',
  subject TEXT NOT NULL DEFAULT 'Unassigned',
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Safe migrations for databases created before semester/subject organization.
ALTER TABLE documents ADD COLUMN IF NOT EXISTS semester TEXT NOT NULL DEFAULT 'Unassigned';
ALTER TABLE documents ADD COLUMN IF NOT EXISTS subject TEXT NOT NULL DEFAULT 'Unassigned';

-- Embedding dimensionality must match GEMINI_EMBEDDING_DIMENSIONS in the backend .env
-- (default 768). If you change that value, this column needs to be recreated to match.
CREATE TABLE IF NOT EXISTS document_chunks (
  id UUID PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  page_number INTEGER,
  content TEXT NOT NULL,
  embedding vector(768),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS timetable (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  subject TEXT NOT NULL,
  room TEXT NOT NULL DEFAULT '',
  faculty TEXT NOT NULL DEFAULT '',
  type TEXT NOT NULL DEFAULT 'Theory'
);

CREATE TABLE IF NOT EXISTS planner_tasks (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  task_date DATE NOT NULL,
  subject TEXT NOT NULL,
  label TEXT NOT NULL,
  done BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS planner_settings (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  exam_date DATE,
  available_hours INTEGER NOT NULL DEFAULT 0,
  priority TEXT NOT NULL DEFAULT 'Medium',
  subjects JSONB NOT NULL DEFAULT '[]'::jsonb
);

CREATE TABLE IF NOT EXISTS notices (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT '',
  type TEXT NOT NULL DEFAULT 'General',
  due_date DATE,
  read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chats (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'New conversation',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY,
  chat_id UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  citations JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- CampusConnect: shared academic communication spaces (subjects), separate from
-- the per-user tables above. A subject is created by a teacher; students join it
-- with a join code. All members can post to a subject's message stream; only the
-- owning teacher can post announcements or pin messages.
CREATE TABLE IF NOT EXISTS subjects (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  semester TEXT NOT NULL DEFAULT '',
  join_code TEXT NOT NULL UNIQUE,
  teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS subject_members (
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (subject_id, user_id)
);

CREATE TABLE IF NOT EXISTS subject_messages (
  id UUID PRIMARY KEY,
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL DEFAULT '',
  is_announcement BOOLEAN NOT NULL DEFAULT FALSE,
  pinned BOOLEAN NOT NULL DEFAULT FALSE,
  attachment_name TEXT,
  attachment_mime TEXT,
  attachment_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS subjects_teacher_idx ON subjects(teacher_id);
CREATE INDEX IF NOT EXISTS subject_members_user_idx ON subject_members(user_id);
CREATE INDEX IF NOT EXISTS subject_members_subject_idx ON subject_members(subject_id);
CREATE INDEX IF NOT EXISTS subject_messages_subject_idx ON subject_messages(subject_id, created_at);

-- Tracks which upcoming-class email reminders have already been sent so the
-- scheduler in backend/src/lib/classReminders.js never emails the same class
-- twice on the same day.
CREATE TABLE IF NOT EXISTS class_reminder_log (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  timetable_id UUID NOT NULL REFERENCES timetable(id) ON DELETE CASCADE,
  reminder_date DATE NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, timetable_id, reminder_date)
);

CREATE INDEX IF NOT EXISTS documents_user_idx ON documents(user_id);
CREATE INDEX IF NOT EXISTS documents_user_semester_idx ON documents(user_id, semester);
CREATE INDEX IF NOT EXISTS documents_user_subject_idx ON documents(user_id, subject);
CREATE INDEX IF NOT EXISTS document_chunks_user_idx ON document_chunks(user_id);
CREATE INDEX IF NOT EXISTS document_chunks_document_idx ON document_chunks(document_id);
CREATE INDEX IF NOT EXISTS timetable_user_idx ON timetable(user_id);
CREATE INDEX IF NOT EXISTS planner_tasks_user_idx ON planner_tasks(user_id);
CREATE INDEX IF NOT EXISTS notices_user_idx ON notices(user_id);
CREATE INDEX IF NOT EXISTS chats_user_idx ON chats(user_id);
CREATE INDEX IF NOT EXISTS chat_messages_chat_idx ON chat_messages(chat_id);
