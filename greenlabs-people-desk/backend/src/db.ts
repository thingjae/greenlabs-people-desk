import './env';
import { Pool, types } from 'pg';
// DATE 컬럼은 시간대 변환 없이 'YYYY-MM-DD' 문자열로 받는다
types.setTypeParser(1082, (v: string) => v);

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
});

export async function q<T = any>(text: string, params: any[] = []): Promise<T[]> {
  const r = await pool.query(text, params);
  return r.rows as T[];
}
export async function one<T = any>(text: string, params: any[] = []): Promise<T | null> {
  const r = await q<T>(text, params);
  return r[0] ?? null;
}

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY, name TEXT NOT NULL, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL,
  role TEXT NOT NULL, employment_type TEXT, title TEXT);
CREATE TABLE IF NOT EXISTS positions (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, department TEXT, headcount INT, opened_at DATE,
  has_task BOOLEAN NOT NULL, interview_minutes INT DEFAULT 60, status TEXT DEFAULT '진행 중');
CREATE TABLE IF NOT EXISTS position_interviewers (
  id SERIAL PRIMARY KEY, position_id TEXT REFERENCES positions(id), user_id INT REFERENCES users(id), stage TEXT NOT NULL,
  UNIQUE(position_id, user_id, stage));
CREATE TABLE IF NOT EXISTS applicants (
  id TEXT PRIMARY KEY, position_id TEXT REFERENCES positions(id), name TEXT NOT NULL, email TEXT NOT NULL, phone TEXT,
  source TEXT, applied_at DATE, stage TEXT, status TEXT, end_stage TEXT, end_reason TEXT, stage_changed_at DATE,
  task_due_at DATE, task_submitted_at DATE, result_notified_at DATE, salary_offer TEXT,
  needs_review BOOLEAN DEFAULT false, review_note TEXT, created_at TIMESTAMPTZ DEFAULT now());
CREATE INDEX IF NOT EXISTS idx_app_pos ON applicants(position_id);
CREATE INDEX IF NOT EXISTS idx_app_email ON applicants(lower(email));
CREATE TABLE IF NOT EXISTS stage_histories (
  id SERIAL PRIMARY KEY, applicant_id TEXT REFERENCES applicants(id), from_stage TEXT, to_stage TEXT NOT NULL,
  changed_by INT, changed_at TIMESTAMPTZ DEFAULT now(), reason TEXT);
CREATE TABLE IF NOT EXISTS eval_criteria (
  id SERIAL PRIMARY KEY, position_id TEXT REFERENCES positions(id), stage TEXT NOT NULL, item TEXT NOT NULL,
  description TEXT, weight REAL, scale_min INT, scale_max INT, scale_labels JSONB, sort_order INT);
CREATE TABLE IF NOT EXISTS evaluations (
  id SERIAL PRIMARY KEY, applicant_id TEXT REFERENCES applicants(id), interviewer_id INT REFERENCES users(id),
  stage TEXT NOT NULL, scores JSONB NOT NULL, verdict TEXT, submitted_at TIMESTAMPTZ, updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(applicant_id, interviewer_id, stage));
CREATE TABLE IF NOT EXISTS evaluation_revisions (
  id SERIAL PRIMARY KEY, evaluation_id INT REFERENCES evaluations(id), before JSONB, edited_by INT, edited_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS availabilities (
  id SERIAL PRIMARY KEY, interviewer_id INT REFERENCES users(id), start_at TIMESTAMPTZ NOT NULL, end_at TIMESTAMPTZ NOT NULL);
CREATE TABLE IF NOT EXISTS interviews (
  id SERIAL PRIMARY KEY, applicant_id TEXT REFERENCES applicants(id), stage TEXT, start_at TIMESTAMPTZ, end_at TIMESTAMPTZ,
  interviewer_ids JSONB, confirmed_by INT, confirmed_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS intake_drafts (
  id SERIAL PRIMARY KEY, raw_text TEXT, extracted JSONB, low_confidence JSONB, duplicate_ids JSONB, suspect_ids JSONB,
  status TEXT DEFAULT '대기', decided_by INT, decided_at TIMESTAMPTZ, applicant_id TEXT, created_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS email_templates (id SERIAL PRIMARY KEY, type TEXT UNIQUE, subject TEXT, body TEXT);
CREATE TABLE IF NOT EXISTS email_logs (
  id SERIAL PRIMARY KEY, applicant_id TEXT REFERENCES applicants(id), type TEXT, subject TEXT, body TEXT,
  status TEXT DEFAULT '초안', created_by INT, created_at TIMESTAMPTZ DEFAULT now(), sent_at TIMESTAMPTZ);
CREATE TABLE IF NOT EXISTS documents (
  id SERIAL PRIMARY KEY, doc_type TEXT NOT NULL, title TEXT, revised_at DATE NOT NULL, file_name TEXT, version INT,
  is_active BOOLEAN DEFAULT true, uploaded_by INT, uploaded_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS doc_chunks (
  id SERIAL PRIMARY KEY, document_id INT REFERENCES documents(id), page INT, article TEXT, text TEXT, embedding REAL[]);
CREATE TABLE IF NOT EXISTS qa_logs (
  id SERIAL PRIMARY KEY, user_id INT REFERENCES users(id), question TEXT, answer TEXT, citations JSONB, conflict JSONB,
  status TEXT, escalation_reason TEXT, is_sensitive BOOLEAN DEFAULT false, resolved_at TIMESTAMPTZ, created_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);
`;

export async function migrate() {
  await pool.query(SCHEMA);
}
