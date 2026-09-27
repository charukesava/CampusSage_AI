import "dotenv/config";
import express from "express";
import cors from "cors";
import multer from "multer";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import pg from "pg";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { processDocument } from "./lib/processDocument.js";
import { retrieveRelevantChunks } from "./lib/retrieval.js";
import { generateAnswer, isGeminiConfigured, extractTimetableFromFile } from "./lib/gemini.js";
import { startClassReminderScheduler } from "./lib/classReminders.js";

const { Pool } = pg;
// Postgres sends DATE columns as plain "YYYY-MM-DD" strings on the wire, but pg's
// default type parser converts them into JS Date objects (in server-local time).
// Downstream code does String(row.some_date).slice(0, 10) expecting an ISO string,
// which on a Date object yields something like "Thu Oct 01" instead of "2026-10-01".
// Disabling the parser for the DATE oid (1082) keeps the original string as-is.
pg.types.setTypeParser(1082, (value) => value);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const port = Number(process.env.PORT || 4000);
const jwtSecret = process.env.JWT_SECRET || "dev-only-change-me";
const uploadDir = path.resolve(__dirname, "..", process.env.UPLOAD_DIR || "uploads");
fs.mkdirSync(uploadDir, { recursive: true });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

app.use(cors({ origin: process.env.FRONTEND_ORIGIN || "http://localhost:5173" }));
app.use(express.json({ limit: "2mb" }));

const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const userDir = path.join(uploadDir, req.user.sub);
    fs.mkdirSync(userDir, { recursive: true });
    cb(null, userDir);
  },
  filename: (_req, file, cb) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    cb(null, `${Date.now()}-${randomUUID()}-${safeName}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024, files: 10 },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ];
    cb(null, allowed.includes(file.mimetype));
  },
});

const campusUploadDir = path.join(uploadDir, "campus-connect");
fs.mkdirSync(campusUploadDir, { recursive: true });
const campusUpload = multer({
  storage: multer.diskStorage({
    destination: (req, _file, cb) => {
      const dir = path.join(campusUploadDir, req.params.id);
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (_req, file, cb) => {
      const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
      cb(null, `${Date.now()}-${randomUUID()}-${safeName}`);
    },
  }),
  limits: { fileSize: 25 * 1024 * 1024, files: 1 },
});

const timetableImportUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    // Accept any image MIME at the upload boundary. The frontend normalizes
    // browser-decodable image formats to PNG; Gemini-native formats are passed
    // through unchanged. PDFs are also supported.
    const allowed = ["application/pdf"];
    cb(null, allowed.includes(file.mimetype) || file.mimetype.startsWith("image/"));
  },
});

async function initDb() {
  const schema = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");
  await pool.query(schema);
}

function signToken(user) {
  return jwt.sign({ sub: user.id, email: user.email, role: user.role || "student" }, jwtSecret, { expiresIn: "7d" });
}

function generateJoinCode() {
  return Array.from({ length: 6 }, () => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 32)]).join("");
}

function publicSubject(row) {
  return {
    id: row.id,
    name: row.name,
    semester: row.semester,
    joinCode: row.join_code,
    teacherId: row.teacher_id,
    teacherName: row.teacher_name || "",
    isOwner: row.is_owner ?? undefined,
    memberCount: row.member_count != null ? Number(row.member_count) : undefined,
    createdAt: row.created_at,
  };
}

function publicSubjectMessage(row) {
  return {
    id: row.id,
    subjectId: row.subject_id,
    senderId: row.sender_id,
    senderName: row.sender_name || "Unknown",
    senderRole: row.sender_role || "student",
    content: row.content,
    isAnnouncement: row.is_announcement,
    pinned: row.pinned,
    attachment: row.attachment_name
      ? { name: row.attachment_name, mimeType: row.attachment_mime, url: `/api/subjects/${row.subject_id}/messages/${row.id}/file` }
      : null,
    createdAt: row.created_at,
  };
}

function auth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ message: "Authentication required." });
  try {
    req.user = jwt.verify(token, jwtSecret);
    next();
  } catch {
    return res.status(401).json({ message: "Your session has expired. Please sign in again." });
  }
}

function publicSettings(row) {
  return {
    theme: row.theme,
    notifications: row.notifications,
    emailNotifications: row.email_notifications,
    language: row.language,
    accountPrivacy: row.account_privacy,
    aiResponseStyle: row.ai_response_style,
    defaultAnswerFormat: row.default_answer_format,
    examMode: row.exam_mode,
    includeExamples: row.include_examples,
    useDocuments: row.use_documents,
    preferDocuments: row.prefer_documents,
    showCitations: row.show_citations,
    saveChatHistory: row.save_chat_history,
    useChatContext: row.use_chat_context,
    autoChatTitles: row.auto_chat_titles,
  };
}

function publicProfile(row) {
  return {
    name: row.name,
    registerNumber: row.register_number,
    department: row.department,
    semester: row.semester,
    collegeName: row.college_name,
    preferredLanguage: row.preferred_language,
    subjects: row.subjects || [],
    email: row.email || "",
    phone: row.phone,
  };
}

function publicDocument(row) {
  return {
    id: row.id,
    name: row.display_name,
    originalName: row.original_name,
    type: row.file_type,
    mimeType: row.mime_type,
    category: row.category,
    size: `${Math.max(1, Math.round(Number(row.size_bytes) / 1024))} KB`,
    sizeBytes: Number(row.size_bytes),
    pages: row.page_count,
    uploadedAt: new Date(row.uploaded_at).toISOString().slice(0, 10),
    status: row.status,
    tags: row.tags || [],
    sourcePages: row.source_pages || [],
    semester: row.semester || "Unassigned",
    subject: row.subject || "Unassigned",
    fileUrl: `/api/documents/${row.id}/file`,
  };
}

function publicTimetable(row) {
  return {
    id: row.id,
    day: row.day,
    startTime: row.start_time,
    endTime: row.end_time,
    subject: row.subject,
    room: row.room,
    faculty: row.faculty,
    type: row.type,
  };
}

function publicPlanner(tasks, settings) {
  return {
    examDate: settings?.exam_date ? String(settings.exam_date).slice(0, 10) : "",
    availableHours: settings?.available_hours || 0,
    priority: settings?.priority || "Medium",
    subjects: settings?.subjects || [],
    tasks: tasks.map((row) => ({
      id: row.id,
      date: String(row.task_date).slice(0, 10),
      subject: row.subject,
      label: row.label,
      done: row.done,
    })),
  };
}

function publicNotice(row) {
  return {
    id: row.id,
    title: row.title,
    detail: row.detail,
    type: row.type,
    dueDate: row.due_date ? String(row.due_date).slice(0, 10) : "",
    read: row.read,
    createdAt: row.created_at,
  };
}

async function getBootstrap(userId) {
  const [profile, settings, documents, timetable, plannerSettings, tasks, notices, chats] = await Promise.all([
    pool.query(`SELECT p.*, u.email FROM profiles p JOIN users u ON u.id=p.user_id WHERE p.user_id=$1`, [userId]),
    pool.query(`SELECT * FROM settings WHERE user_id=$1`, [userId]),
    pool.query(`SELECT * FROM documents WHERE user_id=$1 ORDER BY uploaded_at DESC`, [userId]),
    pool.query(`SELECT * FROM timetable WHERE user_id=$1 ORDER BY day, start_time`, [userId]),
    pool.query(`SELECT * FROM planner_settings WHERE user_id=$1`, [userId]),
    pool.query(`SELECT * FROM planner_tasks WHERE user_id=$1 ORDER BY task_date`, [userId]),
    pool.query(`SELECT * FROM notices WHERE user_id=$1 ORDER BY created_at DESC`, [userId]),
    pool.query(`SELECT c.id, c.title, c.updated_at, COALESCE(json_agg(json_build_object('id',m.id,'role',m.role,'content',m.content,'citations',m.citations,'createdAt',m.created_at) ORDER BY m.created_at) FILTER (WHERE m.id IS NOT NULL), '[]') AS messages FROM chats c LEFT JOIN chat_messages m ON m.chat_id=c.id WHERE c.user_id=$1 GROUP BY c.id ORDER BY c.updated_at DESC`, [userId]),
  ]);
  const chatRows = chats.rows.map((c) => ({ id: c.id, title: c.title, updatedAt: c.updated_at, messages: c.messages || [] }));
  return {
    profile: profile.rows[0] ? publicProfile(profile.rows[0]) : null,
    settings: settings.rows[0] ? publicSettings(settings.rows[0]) : null,
    documents: documents.rows.map(publicDocument),
    timetable: timetable.rows.map(publicTimetable),
    notices: notices.rows.map(publicNotice),
    planner: publicPlanner(tasks.rows, plannerSettings.rows[0]),
    chats: chatRows,
    activeChatId: chatRows[0]?.id || null,
  };
}

app.get("/api/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ ok: true, database: "postgresql" });
  } catch {
    res.status(503).json({ ok: false, database: "unavailable" });
  }
});

app.post("/api/auth/register", async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { name, email, password } = req.body;
    const role = ["student", "teacher"].includes(req.body.role) ? req.body.role : "student";
    if (!name?.trim() || !email?.trim() || !password || password.length < 8) {
      return res.status(400).json({ message: "Name, email and a password of at least 8 characters are required." });
    }
    const normalizedEmail = email.trim().toLowerCase();
    const exists = await client.query("SELECT id FROM users WHERE email=$1", [normalizedEmail]);
    if (exists.rowCount) return res.status(409).json({ message: "An account with that email already exists." });
    const userId = randomUUID();
    const hash = await bcrypt.hash(password, 12);
    await client.query("BEGIN");
    await client.query("INSERT INTO users(id,email,password_hash,role) VALUES($1,$2,$3,$4)", [userId, normalizedEmail, hash, role]);
    await client.query("INSERT INTO profiles(user_id,name,subjects) VALUES($1,$2,$3)", [userId, name.trim(), JSON.stringify([])]);
    await client.query("INSERT INTO settings(user_id) VALUES($1)", [userId]);
    await client.query("INSERT INTO planner_settings(user_id) VALUES($1)", [userId]);
    await client.query("COMMIT");
    const user = { id: userId, email: normalizedEmail, name: name.trim(), role };
    res.status(201).json({ token: signToken(user), user: { name: user.name, email: user.email, role: user.role } });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    next(error);
  } finally {
    client.release();
  }
});

app.post("/api/auth/login", async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: "Email and password are required." });
    const result = await pool.query("SELECT u.id,u.email,u.password_hash,u.role,p.name FROM users u JOIN profiles p ON p.user_id=u.id WHERE u.email=$1", [email.trim().toLowerCase()]);
    const row = result.rows[0];
    if (!row || !(await bcrypt.compare(password, row.password_hash))) return res.status(401).json({ message: "Invalid email or password." });
    res.json({ token: signToken(row), user: { name: row.name, email: row.email, role: row.role } });
  } catch (error) { next(error); }
});

app.get("/api/auth/me", auth, async (req, res, next) => {
  try {
    const result = await pool.query("SELECT u.email,u.role,p.name FROM users u JOIN profiles p ON p.user_id=u.id WHERE u.id=$1", [req.user.sub]);
    if (!result.rows[0]) return res.status(404).json({ message: "User not found." });
    res.json({ user: { name: result.rows[0].name, email: result.rows[0].email, role: result.rows[0].role } });
  } catch (error) { next(error); }
});

app.get("/api/bootstrap", auth, async (req, res, next) => {
  try { res.json(await getBootstrap(req.user.sub)); } catch (error) { next(error); }
});

app.get("/api/profile", auth, async (req, res, next) => {
  try {
    const result = await pool.query("SELECT p.*,u.email FROM profiles p JOIN users u ON u.id=p.user_id WHERE p.user_id=$1", [req.user.sub]);
    res.json(publicProfile(result.rows[0]));
  } catch (error) { next(error); }
});
app.patch("/api/profile", auth, async (req, res, next) => {
  try {
    const p = req.body;
    const result = await pool.query(`UPDATE profiles SET name=$2,register_number=$3,department=$4,semester=$5,college_name=$6,preferred_language=$7,subjects=$8,phone=$9 WHERE user_id=$1 RETURNING *`, [req.user.sub, p.name || "Student", p.registerNumber || "", p.department || "", p.semester || "", p.collegeName || "", p.preferredLanguage || "English", JSON.stringify(p.subjects || []), p.phone || ""]);
    const email = await pool.query("SELECT email FROM users WHERE id=$1", [req.user.sub]);
    res.json(publicProfile({ ...result.rows[0], email: email.rows[0].email }));
  } catch (error) { next(error); }
});

app.get("/api/settings", auth, async (req, res, next) => {
  try {
    const r = await pool.query("SELECT * FROM settings WHERE user_id=$1", [req.user.sub]);
    if (!r.rowCount) return res.status(404).json({ message: "Settings not found." });
    res.json(publicSettings(r.rows[0]));
  } catch (e) { next(e); }
});

app.patch("/api/settings", auth, async (req, res, next) => {
  try {
    const s = req.body || {};
    const r = await pool.query(`
      UPDATE settings SET
        theme=$2, notifications=$3, email_notifications=$4, language=$5, account_privacy=$6,
        ai_response_style=$7, default_answer_format=$8, exam_mode=$9, include_examples=$10,
        use_documents=$11, prefer_documents=$12, show_citations=$13, save_chat_history=$14,
        use_chat_context=$15, auto_chat_titles=$16
      WHERE user_id=$1 RETURNING *
    `, [
      req.user.sub,
      ["light", "dark", "system"].includes(s.theme) ? s.theme : "light",
      Boolean(s.notifications),
      Boolean(s.emailNotifications),
      ["English", "Tamil", "Hindi"].includes(s.language) ? s.language : "English",
      ["private", "shared"].includes(s.accountPrivacy) ? s.accountPrivacy : "private",
      ["concise", "balanced", "detailed"].includes(s.aiResponseStyle) ? s.aiResponseStyle : "balanced",
      ["automatic", "explanation", "step-by-step", "bullets", "exam", "summary"].includes(s.defaultAnswerFormat) ? s.defaultAnswerFormat : "automatic",
      Boolean(s.examMode),
      Boolean(s.includeExamples),
      Boolean(s.useDocuments),
      Boolean(s.preferDocuments),
      Boolean(s.showCitations),
      Boolean(s.saveChatHistory),
      Boolean(s.useChatContext),
      Boolean(s.autoChatTitles),
    ]);
    res.json(publicSettings(r.rows[0]));
  } catch (e) { next(e); }
});

app.post("/api/auth/change-password", auth, async (req, res, next) => {
  try {
    const currentPassword = String(req.body?.currentPassword || "");
    const newPassword = String(req.body?.newPassword || "");

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "Current password and new password are required." });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ message: "New password must contain at least 8 characters." });
    }
    if (currentPassword === newPassword) {
      return res.status(400).json({ message: "New password must be different from your current password." });
    }

    const result = await pool.query("SELECT password_hash FROM users WHERE id=$1", [req.user.sub]);
    if (!result.rowCount) return res.status(404).json({ message: "User not found." });

    const matches = await bcrypt.compare(currentPassword, result.rows[0].password_hash);
    if (!matches) return res.status(401).json({ message: "Current password is incorrect." });

    const hash = await bcrypt.hash(newPassword, 12);
    await pool.query("UPDATE users SET password_hash=$2 WHERE id=$1", [req.user.sub, hash]);

    res.json({ message: "Password changed successfully." });
  } catch (error) { next(error); }
});

app.get("/api/documents", auth, async (req,res,next)=>{try{const r=await pool.query("SELECT * FROM documents WHERE user_id=$1 ORDER BY uploaded_at DESC",[req.user.sub]);res.json(r.rows.map(publicDocument));}catch(e){next(e);}});
app.post("/api/documents/upload", auth, upload.array("files",10), async (req,res,next)=>{
  try {
    const rows=[];
    const semester = String(req.body?.semester || "Unassigned").trim() || "Unassigned";
    const subject = String(req.body?.subject || "Unassigned").trim() || "Unassigned";
    const category = String(req.body?.category || "Uploaded").trim() || "Uploaded";
    for (const file of req.files || []) {
      const ext=path.extname(file.originalname).toLowerCase();
      const type=ext===".pptx"?"PPTX":ext===".docx"?"DOCX":"PDF";
      const id=randomUUID();
      const storagePath=path.relative(uploadDir,file.path);
      const r=await pool.query(`INSERT INTO documents(id,user_id,original_name,display_name,mime_type,file_type,size_bytes,page_count,storage_path,status,tags,semester,subject,category) VALUES($1,$2,$3,$3,$4,$5,$6,$7,$8,'uploaded',$9,$10,$11,$12) RETURNING *`,[id,req.user.sub,file.originalname,file.mimetype,type,file.size,null,storagePath,JSON.stringify([type.toLowerCase()]),semester,subject,category]);
      rows.push(publicDocument(r.rows[0]));
      processDocument(pool, { id, userId: req.user.sub, filePath: file.path, fileType: type }).catch((error) => console.error("Document processing error:", error));
    }
    res.status(201).json(rows);
  } catch(e){next(e);}
});
app.patch("/api/documents/:id", auth, async (req,res,next)=>{
  try {
    const name = req.body?.name;
    const hasOrganization = Object.prototype.hasOwnProperty.call(req.body || {}, "semester") || Object.prototype.hasOwnProperty.call(req.body || {}, "subject") || Object.prototype.hasOwnProperty.call(req.body || {}, "category");
    const r = hasOrganization
      ? await pool.query("UPDATE documents SET display_name=COALESCE($3,display_name), semester=COALESCE(NULLIF($4,''),semester), subject=COALESCE(NULLIF($5,''),subject), category=COALESCE(NULLIF($6,''),category) WHERE id=$1 AND user_id=$2 RETURNING *", [req.params.id,req.user.sub,name,req.body?.semester,req.body?.subject,req.body?.category])
      : await pool.query("UPDATE documents SET display_name=$3 WHERE id=$1 AND user_id=$2 RETURNING *", [req.params.id,req.user.sub,name]);
    if(!r.rowCount)return res.status(404).json({message:"Document not found."});
    res.json(publicDocument(r.rows[0]));
  } catch(e){next(e);}
});
app.delete("/api/documents/:id", auth, async (req,res,next)=>{try{const r=await pool.query("DELETE FROM documents WHERE id=$1 AND user_id=$2 RETURNING storage_path",[req.params.id,req.user.sub]);if(!r.rowCount)return res.status(404).json({message:"Document not found."});const p=path.join(uploadDir,r.rows[0].storage_path);fs.rmSync(p,{force:true});res.status(204).end();}catch(e){next(e);}});
app.get("/api/documents/:id/file", auth, async (req,res,next)=>{try{const r=await pool.query("SELECT * FROM documents WHERE id=$1 AND user_id=$2",[req.params.id,req.user.sub]);if(!r.rowCount)return res.status(404).json({message:"Document not found."});const row=r.rows[0];const filePath=path.join(uploadDir,row.storage_path);if(!fs.existsSync(filePath))return res.status(404).json({message:"Stored file is missing."});res.type(row.mime_type);res.sendFile(path.resolve(filePath));}catch(e){next(e);}});

app.get("/api/timetable", auth, async(req,res,next)=>{try{const r=await pool.query("SELECT * FROM timetable WHERE user_id=$1 ORDER BY day,start_time",[req.user.sub]);res.json(r.rows.map(publicTimetable));}catch(e){next(e);}});
app.post("/api/timetable", auth, async(req,res,next)=>{try{const x=req.body,id=randomUUID();const r=await pool.query(`INSERT INTO timetable(id,user_id,day,start_time,end_time,subject,room,faculty,type) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,[id,req.user.sub,x.day,x.startTime,x.endTime,x.subject,x.room||"",x.faculty||"",x.type||"Theory"]);res.status(201).json(publicTimetable(r.rows[0]));}catch(e){next(e);}});
app.patch("/api/timetable/:id", auth, async(req,res,next)=>{try{const x=req.body;const r=await pool.query(`UPDATE timetable SET day=$3,start_time=$4,end_time=$5,subject=$6,room=$7,faculty=$8,type=$9 WHERE id=$1 AND user_id=$2 RETURNING *`,[req.params.id,req.user.sub,x.day,x.startTime,x.endTime,x.subject,x.room||"",x.faculty||"",x.type||"Theory"]);if(!r.rowCount)return res.status(404).json({message:"Class not found."});res.json(publicTimetable(r.rows[0]));}catch(e){next(e);}});
app.delete("/api/timetable/:id", auth, async(req,res,next)=>{try{await pool.query("DELETE FROM timetable WHERE id=$1 AND user_id=$2",[req.params.id,req.user.sub]);res.status(204).end();}catch(e){next(e);}});

app.post("/api/timetable/import/preview", auth, timetableImportUpload.single("file"), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ message: "Please select a timetable image or PDF." });
    if (!isGeminiConfigured()) return res.status(503).json({ message: "Gemini AI is not configured on the server." });
    const entries = await extractTimetableFromFile(req.file.buffer, req.file.mimetype);
    if (!entries.length) {
      return res.status(422).json({ message: "No timetable classes could be detected. Please upload a clearer timetable image." });
    }
    res.json({ entries, detectedCount: entries.length, fileName: req.file.originalname });
  } catch (error) { next(error); }
});

app.put("/api/timetable/bulk", auth, async (req, res, next) => {
  const client = await pool.connect();
  try {
    const entries = Array.isArray(req.body?.entries) ? req.body.entries : [];
    const replaceExisting = req.body?.replaceExisting !== false;
    if (!entries.length) return res.status(400).json({ message: "No timetable entries were supplied." });

    const allowedDays = new Set(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);
    const allowedTypes = new Set(["Theory", "Lab", "Tutorial"]);
    const valid = entries.filter((x) => {
      const time = (value) => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(value || ""));
      return allowedDays.has(x.day) && time(x.startTime) && time(x.endTime) && x.startTime < x.endTime && String(x.subject || "").trim();
    });
    if (!valid.length) return res.status(400).json({ message: "The timetable entries are invalid." });

    await client.query("BEGIN");
    if (replaceExisting) await client.query("DELETE FROM timetable WHERE user_id=$1", [req.user.sub]);
    for (const x of valid) {
      await client.query(
        "INSERT INTO timetable(id,user_id,day,start_time,end_time,subject,room,faculty,type) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)",
        [randomUUID(), req.user.sub, x.day, x.startTime, x.endTime, String(x.subject).trim(), String(x.room || "").trim(), String(x.faculty || "").trim(), allowedTypes.has(x.type) ? x.type : "Theory"]
      );
    }
    const result = await client.query("SELECT * FROM timetable WHERE user_id=$1 ORDER BY day,start_time", [req.user.sub]);
    await client.query("COMMIT");
    res.json(result.rows.map(publicTimetable));
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    next(error);
  } finally { client.release(); }
});


app.get("/api/planner", auth, async(req,res,next)=>{try{const [s,t]=await Promise.all([pool.query("SELECT * FROM planner_settings WHERE user_id=$1",[req.user.sub]),pool.query("SELECT * FROM planner_tasks WHERE user_id=$1 ORDER BY task_date",[req.user.sub])]);res.json(publicPlanner(t.rows,s.rows[0]));}catch(e){next(e);}});
app.put("/api/planner", auth, async(req,res,next)=>{const client=await pool.connect();try{const p=req.body;await client.query("BEGIN");await client.query(`INSERT INTO planner_settings(user_id,exam_date,available_hours,priority,subjects) VALUES($1,$2,$3,$4,$5) ON CONFLICT(user_id) DO UPDATE SET exam_date=EXCLUDED.exam_date,available_hours=EXCLUDED.available_hours,priority=EXCLUDED.priority,subjects=EXCLUDED.subjects`,[req.user.sub,p.examDate||null,Number(p.availableHours)||0,p.priority||"Medium",JSON.stringify(p.subjects||[])]);await client.query("DELETE FROM planner_tasks WHERE user_id=$1",[req.user.sub]);for(const task of p.tasks||[]){await client.query("INSERT INTO planner_tasks(id,user_id,task_date,subject,label,done) VALUES($1,$2,$3,$4,$5,$6)",[task.id||randomUUID(),req.user.sub,task.date,task.subject,task.label,Boolean(task.done)]);}await client.query("COMMIT");const [s,t]=await Promise.all([client.query("SELECT * FROM planner_settings WHERE user_id=$1",[req.user.sub]),client.query("SELECT * FROM planner_tasks WHERE user_id=$1 ORDER BY task_date",[req.user.sub])]);res.json(publicPlanner(t.rows,s.rows[0]));}catch(e){await client.query("ROLLBACK").catch(()=>{});next(e);}finally{client.release();}});
app.patch("/api/planner/tasks/:id", auth, async(req,res,next)=>{try{const r=await pool.query("UPDATE planner_tasks SET done=$3 WHERE id=$1 AND user_id=$2 RETURNING *",[req.params.id,req.user.sub,Boolean(req.body.done)]);if(!r.rowCount)return res.status(404).json({message:"Task not found."});res.json({id:r.rows[0].id,date:String(r.rows[0].task_date).slice(0,10),subject:r.rows[0].subject,label:r.rows[0].label,done:r.rows[0].done});}catch(e){next(e);}});

app.get("/api/notices", auth, async(req,res,next)=>{try{const r=await pool.query("SELECT * FROM notices WHERE user_id=$1 ORDER BY created_at DESC",[req.user.sub]);res.json(r.rows.map(publicNotice));}catch(e){next(e);}});
app.patch("/api/notices/:id", auth, async(req,res,next)=>{try{const r=await pool.query("UPDATE notices SET read=$3 WHERE id=$1 AND user_id=$2 RETURNING *",[req.params.id,req.user.sub,Boolean(req.body.read)]);if(!r.rowCount)return res.status(404).json({message:"Notice not found."});res.json(publicNotice(r.rows[0]));}catch(e){next(e);}});
app.delete("/api/notices/:id", auth, async(req,res,next)=>{try{await pool.query("DELETE FROM notices WHERE id=$1 AND user_id=$2",[req.params.id,req.user.sub]);res.status(204).end();}catch(e){next(e);}});
app.put("/api/notices", auth, async(req,res,next)=>{const client=await pool.connect();try{await client.query("BEGIN");await client.query("DELETE FROM notices WHERE user_id=$1",[req.user.sub]);for(const n of req.body||[]){await client.query(`INSERT INTO notices(id,user_id,title,detail,type,due_date,read,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,[n.id||randomUUID(),req.user.sub,n.title,n.detail||"",n.type||"General",n.dueDate||null,Boolean(n.read),n.createdAt||new Date().toISOString()]);}await client.query("COMMIT");const r=await client.query("SELECT * FROM notices WHERE user_id=$1 ORDER BY created_at DESC",[req.user.sub]);res.json(r.rows.map(publicNotice));}catch(e){await client.query("ROLLBACK").catch(()=>{});next(e);}finally{client.release();}});

app.get("/api/chats", auth, async(req,res,next)=>{try{const r=await pool.query(`SELECT c.id,c.title,c.updated_at,COALESCE(json_agg(json_build_object('id',m.id,'role',m.role,'content',m.content,'citations',m.citations,'createdAt',m.created_at) ORDER BY m.created_at) FILTER(WHERE m.id IS NOT NULL),'[]') messages FROM chats c LEFT JOIN chat_messages m ON m.chat_id=c.id WHERE c.user_id=$1 GROUP BY c.id ORDER BY c.updated_at DESC`,[req.user.sub]);res.json(r.rows.map(c=>({id:c.id,title:c.title,updatedAt:c.updated_at,messages:c.messages})));}catch(e){next(e);}});
app.post("/api/chats", auth, async(req,res,next)=>{try{const id=randomUUID();const r=await pool.query("INSERT INTO chats(id,user_id,title) VALUES($1,$2,$3) RETURNING id,title,updated_at",[id,req.user.sub,req.body.title||"New conversation"]);res.status(201).json({id:r.rows[0].id,title:r.rows[0].title,updatedAt:r.rows[0].updated_at,messages:[]});}catch(e){next(e);}});
app.post("/api/chats/:id/messages", auth, async (req,res,next)=>{
  try {
    const chat = await pool.query("SELECT id FROM chats WHERE id=$1 AND user_id=$2", [req.params.id, req.user.sub]);
    if (!chat.rowCount) return res.status(404).json({ message: "Chat not found." });
    const userText = String(req.body.content || "").trim();
    if (!userText) return res.status(400).json({ message: "Message cannot be empty." });
    const includeUserMessage = req.body.includeUserMessage !== false;

    const historyResult = await pool.query(
      "SELECT role, content FROM chat_messages WHERE chat_id=$1 ORDER BY created_at DESC LIMIT 12",
      [req.params.id]
    );
    const history = historyResult.rows.reverse();

    const profileResult = await pool.query(
      "SELECT semester, subjects FROM profiles WHERE user_id=$1",
      [req.user.sub]
    );
    const profile = profileResult.rows[0] || { semester: "", subjects: [] };

    const userMsg = { id: randomUUID(), role: "user", content: userText, citations: [], createdAt: new Date().toISOString() };
    if (includeUserMessage) await pool.query("INSERT INTO chat_messages(id,chat_id,role,content) VALUES($1,$2,$3,$4)", [userMsg.id, req.params.id, "user", userText]);

    let assistantContent;
    let citations = [];
    if (!isGeminiConfigured()) {
      assistantContent = "AI answering isn't configured yet. Ask the server admin to set a `GEMINI_API_KEY` in the backend's `.env` file, then try again.";
    } else {
      try {
        const chunks = await retrieveRelevantChunks(pool, req.user.sub, userText, profile);
        assistantContent = await generateAnswer(userText, chunks, history);
        const referencedSources = [...assistantContent.matchAll(/\[Source\s+(\d+)\]/gi)]
          .map((match) => Number(match[1]) - 1)
          .filter((index, position, all) => Number.isInteger(index) && index >= 0 && index < chunks.length && all.indexOf(index) === position);

        const sourceIndexes = referencedSources.length ? referencedSources : [];
        const seen = new Set();
        citations = sourceIndexes.map((index) => chunks[index]).filter((chunk) => {
          const key = `${chunk.documentId}-${chunk.page}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        }).map((chunk) => ({ documentId: chunk.documentId, label: chunk.label, page: chunk.page || 1 }));
      } catch (error) {
        console.error("RAG answer generation failed:", error);
        assistantContent = "I ran into a problem generating an answer just now. Please try again in a moment.";
      }
    }

    const assistantMsg = { id: randomUUID(), role: "assistant", content: assistantContent, citations, createdAt: new Date().toISOString() };
    await pool.query("INSERT INTO chat_messages(id,chat_id,role,content,citations) VALUES($1,$2,$3,$4,$5)", [assistantMsg.id, req.params.id, "assistant", assistantContent, JSON.stringify(citations)]);
    await pool.query("UPDATE chats SET title=CASE WHEN title='New conversation' THEN $2 ELSE title END,updated_at=NOW() WHERE id=$1", [req.params.id, userText.slice(0, 32)]);
    res.json({ userMessage: includeUserMessage ? userMsg : null, assistantMessage: assistantMsg });
  } catch (e) { next(e); }
});

// ---------- CampusConnect: subjects & messages ----------

function requireTeacher(req, res, next) {
  if (req.user.role !== "teacher") return res.status(403).json({ message: "Only teachers can do this." });
  next();
}

async function assertSubjectMember(subjectId, userId) {
  const r = await pool.query("SELECT 1 FROM subject_members WHERE subject_id=$1 AND user_id=$2", [subjectId, userId]);
  return r.rowCount > 0;
}

function publicMember(row, viewerIsTeacherOwner) {
  const base = {
    userId: row.user_id,
    name: row.name,
    role: row.role,
    joinedAt: row.joined_at,
    isOwner: row.is_owner,
  };
  if (viewerIsTeacherOwner) {
    return {
      ...base,
      semester: row.semester,
      department: row.department,
      registerNumber: row.register_number,
      email: row.email,
    };
  }
  return base;
}

app.get("/api/subjects", auth, async (req, res, next) => {
  try {
    const r = await pool.query(
      `SELECT s.*, t.name AS teacher_name, (s.teacher_id=$1) AS is_owner,
              (SELECT COUNT(*) FROM subject_members m WHERE m.subject_id=s.id) AS member_count
       FROM subjects s
       JOIN subject_members sm ON sm.subject_id=s.id AND sm.user_id=$1
       JOIN profiles t ON t.user_id=s.teacher_id
       ORDER BY s.created_at DESC`,
      [req.user.sub]
    );
    res.json(r.rows.map(publicSubject));
  } catch (e) { next(e); }
});

app.post("/api/subjects", auth, requireTeacher, async (req, res, next) => {
  const client = await pool.connect();
  try {
    const name = String(req.body?.name || "").trim();
    const semester = String(req.body?.semester || "").trim();
    if (!name) return res.status(400).json({ message: "Subject name is required." });
    const id = randomUUID();
    let joinCode = generateJoinCode();
    await client.query("BEGIN");
    for (let attempts = 0; attempts < 5; attempts++) {
      const clash = await client.query("SELECT 1 FROM subjects WHERE join_code=$1", [joinCode]);
      if (!clash.rowCount) break;
      joinCode = generateJoinCode();
    }
    await client.query("INSERT INTO subjects(id,name,semester,join_code,teacher_id) VALUES($1,$2,$3,$4,$5)", [id, name, semester, joinCode, req.user.sub]);
    await client.query("INSERT INTO subject_members(subject_id,user_id) VALUES($1,$2)", [id, req.user.sub]);
    await client.query("COMMIT");
    const r = await pool.query(
      `SELECT s.*, t.name AS teacher_name, TRUE AS is_owner, 1 AS member_count FROM subjects s JOIN profiles t ON t.user_id=s.teacher_id WHERE s.id=$1`,
      [id]
    );
    res.status(201).json(publicSubject(r.rows[0]));
  } catch (e) { await client.query("ROLLBACK").catch(() => {}); next(e); }
  finally { client.release(); }
});

app.post("/api/subjects/join", auth, async (req, res, next) => {
  try {
    const joinCode = String(req.body?.joinCode || "").trim().toUpperCase();
    if (!joinCode) return res.status(400).json({ message: "Enter a join code." });
    const subject = await pool.query("SELECT * FROM subjects WHERE join_code=$1", [joinCode]);
    if (!subject.rowCount) return res.status(404).json({ message: "No subject found with that join code." });
    await pool.query("INSERT INTO subject_members(subject_id,user_id) VALUES($1,$2) ON CONFLICT DO NOTHING", [subject.rows[0].id, req.user.sub]);
    const r = await pool.query(
      `SELECT s.*, t.name AS teacher_name, (s.teacher_id=$1) AS is_owner,
              (SELECT COUNT(*) FROM subject_members m WHERE m.subject_id=s.id) AS member_count
       FROM subjects s JOIN profiles t ON t.user_id=s.teacher_id WHERE s.id=$2`,
      [req.user.sub, subject.rows[0].id]
    );
    res.status(201).json(publicSubject(r.rows[0]));
  } catch (e) { next(e); }
});

app.get("/api/subjects/:id/messages", auth, async (req, res, next) => {
  try {
    if (!(await assertSubjectMember(req.params.id, req.user.sub))) return res.status(403).json({ message: "You are not a member of this subject." });
    const r = await pool.query(
      `SELECT m.*, p.name AS sender_name, u.role AS sender_role
       FROM subject_messages m
       JOIN profiles p ON p.user_id=m.sender_id
       JOIN users u ON u.id=m.sender_id
       WHERE m.subject_id=$1
       ORDER BY m.pinned DESC, m.created_at ASC`,
      [req.params.id]
    );
    res.json(r.rows.map(publicSubjectMessage));
  } catch (e) { next(e); }
});

app.post("/api/subjects/:id/messages", auth, campusUpload.single("file"), async (req, res, next) => {
  try {
    if (!(await assertSubjectMember(req.params.id, req.user.sub))) return res.status(403).json({ message: "You are not a member of this subject." });
    const subject = await pool.query("SELECT teacher_id FROM subjects WHERE id=$1", [req.params.id]);
    if (!subject.rowCount) return res.status(404).json({ message: "Subject not found." });
    const isTeacherOfSubject = req.user.role === "teacher" && subject.rows[0].teacher_id === req.user.sub;
    const content = String(req.body?.content || "").trim();
    if (!content && !req.file) return res.status(400).json({ message: "Write a message or attach a file." });
    const id = randomUUID();
    const isAnnouncement = isTeacherOfSubject && req.body?.isAnnouncement === "true";
    const attachmentPath = req.file ? path.relative(uploadDir, req.file.path) : null;
    await pool.query(
      `INSERT INTO subject_messages(id,subject_id,sender_id,content,is_announcement,attachment_name,attachment_mime,attachment_path)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,
      [id, req.params.id, req.user.sub, content, isAnnouncement, req.file?.originalname || null, req.file?.mimetype || null, attachmentPath]
    );
    const r = await pool.query(
      `SELECT m.*, p.name AS sender_name, u.role AS sender_role FROM subject_messages m JOIN profiles p ON p.user_id=m.sender_id JOIN users u ON u.id=m.sender_id WHERE m.id=$1`,
      [id]
    );
    res.status(201).json(publicSubjectMessage(r.rows[0]));
  } catch (e) { next(e); }
});

app.patch("/api/subjects/:id/messages/:messageId", auth, async (req, res, next) => {
  try {
    const subject = await pool.query("SELECT teacher_id FROM subjects WHERE id=$1", [req.params.id]);
    if (!subject.rowCount) return res.status(404).json({ message: "Subject not found." });
    if (subject.rows[0].teacher_id !== req.user.sub) return res.status(403).json({ message: "Only the subject's teacher can pin messages." });
    const r = await pool.query(
      "UPDATE subject_messages SET pinned=$3 WHERE id=$1 AND subject_id=$2 RETURNING *",
      [req.params.messageId, req.params.id, Boolean(req.body?.pinned)]
    );
    if (!r.rowCount) return res.status(404).json({ message: "Message not found." });
    const full = await pool.query(
      `SELECT m.*, p.name AS sender_name, u.role AS sender_role FROM subject_messages m JOIN profiles p ON p.user_id=m.sender_id JOIN users u ON u.id=m.sender_id WHERE m.id=$1`,
      [r.rows[0].id]
    );
    res.json(publicSubjectMessage(full.rows[0]));
  } catch (e) { next(e); }
});

app.delete("/api/subjects/:id/messages/:messageId", auth, async (req, res, next) => {
  try {
    const subject = await pool.query("SELECT teacher_id FROM subjects WHERE id=$1", [req.params.id]);
    if (!subject.rowCount) return res.status(404).json({ message: "Subject not found." });
    const message = await pool.query("SELECT * FROM subject_messages WHERE id=$1 AND subject_id=$2", [req.params.messageId, req.params.id]);
    if (!message.rowCount) return res.status(404).json({ message: "Message not found." });
    const canDelete = message.rows[0].sender_id === req.user.sub || subject.rows[0].teacher_id === req.user.sub;
    if (!canDelete) return res.status(403).json({ message: "You can't delete this message." });
    await pool.query("DELETE FROM subject_messages WHERE id=$1", [req.params.messageId]);
    if (message.rows[0].attachment_path) fs.rmSync(path.join(uploadDir, message.rows[0].attachment_path), { force: true });
    res.status(204).end();
  } catch (e) { next(e); }
});

app.get("/api/subjects/:id/messages/:messageId/file", auth, async (req, res, next) => {
  try {
    if (!(await assertSubjectMember(req.params.id, req.user.sub))) return res.status(403).json({ message: "You are not a member of this subject." });
    const r = await pool.query("SELECT * FROM subject_messages WHERE id=$1 AND subject_id=$2", [req.params.messageId, req.params.id]);
    if (!r.rowCount || !r.rows[0].attachment_path) return res.status(404).json({ message: "Attachment not found." });
    const filePath = path.join(uploadDir, r.rows[0].attachment_path);
    if (!fs.existsSync(filePath)) return res.status(404).json({ message: "Stored file is missing." });
    res.type(r.rows[0].attachment_mime || "application/octet-stream");
    res.sendFile(path.resolve(filePath));
  } catch (e) { next(e); }
});

app.get("/api/subjects/:id/members", auth, async (req, res, next) => {
  try {
    const subject = await pool.query("SELECT teacher_id FROM subjects WHERE id=$1", [req.params.id]);
    if (!subject.rowCount) return res.status(404).json({ message: "Subject not found." });
    if (!(await assertSubjectMember(req.params.id, req.user.sub))) return res.status(403).json({ message: "You are not a member of this subject." });
    const isOwner = subject.rows[0].teacher_id === req.user.sub;
    const r = await pool.query(
      `SELECT sm.user_id, sm.joined_at, u.role, u.email, p.name, p.semester, p.department, p.register_number,
              (sm.user_id=$1) AS is_owner
       FROM subject_members sm
       JOIN users u ON u.id=sm.user_id
       JOIN profiles p ON p.user_id=sm.user_id
       WHERE sm.subject_id=$2
       ORDER BY is_owner DESC, sm.joined_at ASC`,
      [subject.rows[0].teacher_id, req.params.id]
    );
    res.json(r.rows.map((row) => publicMember(row, isOwner)));
  } catch (e) { next(e); }
});

app.delete("/api/subjects/:id/members/:userId", auth, async (req, res, next) => {
  try {
    const subject = await pool.query("SELECT teacher_id FROM subjects WHERE id=$1", [req.params.id]);
    if (!subject.rowCount) return res.status(404).json({ message: "Subject not found." });
    if (subject.rows[0].teacher_id !== req.user.sub) return res.status(403).json({ message: "Only the subject's teacher can remove members." });
    if (req.params.userId === req.user.sub) return res.status(400).json({ message: "You can't remove yourself from a subject you teach." });
    await pool.query("DELETE FROM subject_members WHERE subject_id=$1 AND user_id=$2", [req.params.id, req.params.userId]);
    res.status(204).end();
  } catch (e) { next(e); }
});

app.post("/api/subjects/:id/members", auth, async (req, res, next) => {
  try {
    const subject = await pool.query("SELECT teacher_id FROM subjects WHERE id=$1", [req.params.id]);
    if (!subject.rowCount) return res.status(404).json({ message: "Subject not found." });
    if (subject.rows[0].teacher_id !== req.user.sub) return res.status(403).json({ message: "Only the subject's teacher can add members." });
    const userId = String(req.body?.userId || "");
    const target = await pool.query("SELECT id FROM users WHERE id=$1", [userId]);
    if (!target.rowCount) return res.status(404).json({ message: "Student not found." });
    await pool.query("INSERT INTO subject_members(subject_id,user_id) VALUES($1,$2) ON CONFLICT DO NOTHING", [req.params.id, userId]);
    const r = await pool.query(
      `SELECT sm.user_id, sm.joined_at, u.role, u.email, p.name, p.semester, p.department, p.register_number, FALSE AS is_owner
       FROM subject_members sm JOIN users u ON u.id=sm.user_id JOIN profiles p ON p.user_id=sm.user_id
       WHERE sm.subject_id=$1 AND sm.user_id=$2`,
      [req.params.id, userId]
    );
    res.status(201).json(publicMember(r.rows[0], true));
  } catch (e) { next(e); }
});

app.get("/api/students/search", auth, requireTeacher, async (req, res, next) => {
  try {
    const q = String(req.query?.q || "").trim();
    if (q.length < 2) return res.json([]);
    const r = await pool.query(
      `SELECT p.user_id AS id, p.name, p.register_number AS "registerNumber", p.semester, p.department, u.email
       FROM profiles p JOIN users u ON u.id=p.user_id
       WHERE u.role='student' AND (p.name ILIKE $1 OR p.register_number ILIKE $1 OR u.email ILIKE $1)
       ORDER BY p.name ASC LIMIT 10`,
      [`%${q}%`]
    );
    res.json(r.rows);
  } catch (e) { next(e); }
});

app.use((error, _req, res, _next) => {
  console.error(error);
  if (error instanceof multer.MulterError || error?.code === "LIMIT_FILE_SIZE") {
    if (_req.path.includes("/subjects/")) return res.status(400).json({ message: "Attachment upload failed. Files must be under 25 MB." });
    if (error?.field === "file" || _req.path.includes("/timetable/import")) return res.status(400).json({ message: "Timetable upload failed. Use a JPG, PNG, WEBP, HEIC, or PDF up to 10 MB." });
    return res.status(400).json({ message: "File upload failed. Only PDF, DOCX and PPTX files up to 25 MB are allowed." });
  }
  res.status(500).json({ message: "Server error. Please try again." });
});

initDb()
  .then(() => {
    app.listen(port, () => console.log(`CampusSage API running on http://localhost:${port}`));
    // Background job only: emails an upcoming-class reminder to a student's
    // login email a few minutes before class. Adds no new API endpoints.
    startClassReminderScheduler(pool);
  })
  .catch((error) => { console.error("Database initialization failed:", error); process.exit(1); });
