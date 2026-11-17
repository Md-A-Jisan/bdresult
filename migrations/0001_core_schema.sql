-- bdresult.me core schema (Cloudflare D1 / SQLite). Timestamps are ISO-8601 UTC text.
-- Posts stay in Git/Markdown (Decap CMS); D1 holds directory data only.
-- No PRAGMA / BEGIN here: D1 migrations run in their own transaction and enforce foreign keys.

-- ---------- Reference / geography ----------
CREATE TABLE institution_types (
  id INTEGER PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,          -- singular key, e.g. 'school'
  url_slug TEXT NOT NULL UNIQUE,      -- directory path, e.g. 'schools'
  name_en TEXT NOT NULL,
  name_bn TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE education_boards (
  id INTEGER PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name_en TEXT NOT NULL,
  name_bn TEXT NOT NULL
);

CREATE TABLE divisions (
  id INTEGER PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name_en TEXT NOT NULL,
  name_bn TEXT NOT NULL,
  bbs_code TEXT UNIQUE
);

CREATE TABLE districts (
  id INTEGER PRIMARY KEY,
  division_id INTEGER NOT NULL REFERENCES divisions(id),
  slug TEXT NOT NULL UNIQUE,
  name_en TEXT NOT NULL,
  name_bn TEXT NOT NULL,
  bbs_code TEXT UNIQUE
);
CREATE INDEX idx_districts_division ON districts(division_id);

-- Upazila names repeat across districts ('Sadar'), so slugs must be globally unique: '{district-slug}-{name}'.
CREATE TABLE upazilas (
  id INTEGER PRIMARY KEY,
  district_id INTEGER NOT NULL REFERENCES districts(id),
  slug TEXT NOT NULL UNIQUE,
  name_en TEXT NOT NULL,
  name_bn TEXT NOT NULL,
  bbs_code TEXT UNIQUE
);
CREATE INDEX idx_upazilas_district ON upazilas(district_id);

-- ---------- Admin ----------
CREATE TABLE admin_users (
  id INTEGER PRIMARY KEY,
  github_login TEXT NOT NULL UNIQUE COLLATE NOCASE,
  github_id INTEGER UNIQUE,
  display_name TEXT,
  role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('owner','admin','editor','reviewer','viewer')),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  last_login_at TEXT
);

-- ---------- Bulk import ----------
CREATE TABLE import_jobs (
  id INTEGER PRIMARY KEY,
  filename TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'uploaded'
    CHECK (status IN ('uploaded','mapped','validated','importing','done','failed','rolled_back')),
  mapping_json TEXT,
  total_rows INTEGER NOT NULL DEFAULT 0,
  valid_rows INTEGER NOT NULL DEFAULT 0,
  error_rows INTEGER NOT NULL DEFAULT 0,
  imported_rows INTEGER NOT NULL DEFAULT 0,
  source_note TEXT,
  created_by INTEGER REFERENCES admin_users(id),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  finished_at TEXT
);

CREATE TABLE import_rows (
  id INTEGER PRIMARY KEY,
  job_id INTEGER NOT NULL REFERENCES import_jobs(id) ON DELETE CASCADE,
  row_no INTEGER NOT NULL,
  raw_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','valid','error','duplicate','imported','skipped')),
  error_text TEXT,
  matched_institution_id INTEGER,
  UNIQUE (job_id, row_no)
);
CREATE INDEX idx_import_rows_job_status ON import_rows(job_id, status);

-- ---------- Institutions ----------
CREATE TABLE institutions (
  id INTEGER PRIMARY KEY,
  eiin TEXT UNIQUE CHECK (eiin IS NULL OR (length(eiin) BETWEEN 5 AND 7 AND eiin NOT GLOB '*[^0-9]*')),
  slug TEXT NOT NULL UNIQUE CHECK (slug NOT GLOB '*[^a-z0-9-]*' AND length(slug) BETWEEN 3 AND 120),
  name_en TEXT NOT NULL,
  name_bn TEXT,
  name_norm TEXT NOT NULL,            -- normalized by app for search and duplicate detection
  type_id INTEGER NOT NULL REFERENCES institution_types(id),
  division_id INTEGER REFERENCES divisions(id),
  district_id INTEGER REFERENCES districts(id),
  upazila_id INTEGER REFERENCES upazilas(id),
  address TEXT,
  postal_code TEXT CHECK (postal_code IS NULL OR (length(postal_code)=4 AND postal_code NOT GLOB '*[^0-9]*')),
  latitude REAL CHECK (latitude IS NULL OR latitude BETWEEN 20.5 AND 26.7),
  longitude REAL CHECK (longitude IS NULL OR longitude BETWEEN 88.0 AND 92.8),
  coords_verified INTEGER NOT NULL DEFAULT 0 CHECK (coords_verified IN (0,1)),
  established_year INTEGER CHECK (established_year IS NULL OR established_year BETWEEN 1500 AND 2100),
  management_type TEXT CHECK (management_type IS NULL OR management_type IN ('government','non_government','private','autonomous','other')),
  website TEXT,
  summary TEXT,
  history TEXT,
  verification_status TEXT NOT NULL DEFAULT 'unverified' CHECK (verification_status IN ('unverified','pending','verified','disputed')),
  publish_state TEXT NOT NULL DEFAULT 'draft' CHECK (publish_state IN ('draft','published','archived')),
  completeness INTEGER NOT NULL DEFAULT 0 CHECK (completeness BETWEEN 0 AND 100),  -- computed by app
  last_verified_at TEXT,
  import_job_id INTEGER REFERENCES import_jobs(id),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_inst_type_district ON institutions(type_id, district_id);
CREATE INDEX idx_inst_district ON institutions(district_id);
CREATE INDEX idx_inst_upazila ON institutions(upazila_id);
CREATE INDEX idx_inst_name_norm ON institutions(name_norm);
CREATE INDEX idx_inst_public ON institutions(publish_state, verification_status, completeness);
CREATE INDEX idx_inst_import ON institutions(import_job_id);

CREATE TRIGGER trg_institutions_updated AFTER UPDATE ON institutions
WHEN NEW.updated_at = OLD.updated_at
BEGIN
  UPDATE institutions SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = NEW.id;
END;

CREATE TABLE institution_aliases (
  id INTEGER PRIMARY KEY,
  institution_id INTEGER NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  alias TEXT NOT NULL,
  alias_norm TEXT NOT NULL,
  UNIQUE (institution_id, alias_norm)
);
CREATE INDEX idx_alias_norm ON institution_aliases(alias_norm);

CREATE TABLE institution_sources (
  id INTEGER PRIMARY KEY,
  institution_id INTEGER NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  field_name TEXT,                    -- which fact this supports (NULL = whole profile)
  source_name TEXT NOT NULL,
  source_url TEXT,
  accessed_on TEXT NOT NULL,          -- YYYY-MM-DD
  note TEXT
);
CREATE INDEX idx_sources_inst ON institution_sources(institution_id);

CREATE TABLE institution_contacts (
  id INTEGER PRIMARY KEY,
  institution_id INTEGER NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('phone','email','website','facebook','other')),
  value TEXT NOT NULL,
  label TEXT,
  is_public INTEGER NOT NULL DEFAULT 1 CHECK (is_public IN (0,1)),
  source_id INTEGER REFERENCES institution_sources(id) ON DELETE SET NULL
);
CREATE INDEX idx_contacts_inst ON institution_contacts(institution_id);

-- ---------- Results ----------
CREATE TABLE institution_results (
  id INTEGER PRIMARY KEY,
  institution_id INTEGER NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  exam TEXT NOT NULL CHECK (exam IN ('SSC','HSC','Dakhil','Alim','SSC_Vocational','HSC_Vocational')),
  exam_year INTEGER NOT NULL CHECK (exam_year BETWEEN 2000 AND 2100),
  board_id INTEGER REFERENCES education_boards(id),
  group_name TEXT NOT NULL DEFAULT 'all',   -- 'all' or a specific group/department
  total_students INTEGER CHECK (total_students IS NULL OR total_students >= 0),
  appeared INTEGER NOT NULL CHECK (appeared >= 0),
  passed INTEGER NOT NULL CHECK (passed >= 0),
  failed INTEGER CHECK (failed IS NULL OR failed >= 0),
  gpa5 INTEGER NOT NULL DEFAULT 0 CHECK (gpa5 >= 0),
  source_id INTEGER REFERENCES institution_sources(id) ON DELETE SET NULL,
  verification_status TEXT NOT NULL DEFAULT 'unverified' CHECK (verification_status IN ('unverified','pending','verified','disputed')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  CHECK (passed <= appeared),
  CHECK (gpa5 <= passed),
  CHECK (total_students IS NULL OR appeared <= total_students),
  CHECK (failed IS NULL OR failed = appeared - passed),
  UNIQUE (institution_id, exam, exam_year, group_name)
);
CREATE INDEX idx_results_exam_year ON institution_results(exam, exam_year);

-- Rates are always derived, never stored. NULL when nobody appeared (no fabricated 0%).
CREATE VIEW v_institution_results AS
SELECT r.*,
  CASE WHEN r.appeared > 0 THEN ROUND(100.0 * r.passed / r.appeared, 2) END AS pass_rate,
  CASE WHEN r.appeared > 0 THEN ROUND(100.0 * r.gpa5   / r.appeared, 2) END AS gpa5_rate
FROM institution_results r;

-- ---------- Editorial reviews ----------
CREATE TABLE institution_reviews (
  id INTEGER PRIMARY KEY,
  institution_id INTEGER NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'editorial' CHECK (kind IN ('editorial','user_feedback')),
  title TEXT NOT NULL,
  body_md TEXT NOT NULL,
  post_slug TEXT,                     -- optional link to a Git-authored article
  author_id INTEGER REFERENCES admin_users(id),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','pending','published','rejected')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  published_at TEXT
);
CREATE INDEX idx_reviews_inst ON institution_reviews(institution_id, status);

-- ---------- Corrections, verification, audit ----------
CREATE TABLE correction_requests (
  id INTEGER PRIMARY KEY,
  institution_id INTEGER NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  field_name TEXT,
  proposed_value TEXT,
  message TEXT NOT NULL CHECK (length(message) BETWEEN 10 AND 2000),
  evidence_url TEXT,
  contact_email TEXT,                 -- private; never rendered publicly
  ip_hash TEXT,                       -- salted hash for abuse control, not raw IP
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','accepted','rejected','needs_info')),
  reviewed_by INTEGER REFERENCES admin_users(id),
  reviewed_at TEXT,
  resolution_note TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_corrections_status ON correction_requests(status, created_at);
CREATE INDEX idx_corrections_inst ON correction_requests(institution_id);

CREATE TABLE verification_logs (
  id INTEGER PRIMARY KEY,
  institution_id INTEGER NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  admin_id INTEGER REFERENCES admin_users(id),
  from_status TEXT,
  to_status TEXT NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_verlogs_inst ON verification_logs(institution_id, created_at);

CREATE TABLE audit_logs (
  id INTEGER PRIMARY KEY,
  admin_id INTEGER REFERENCES admin_users(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  before_json TEXT,
  after_json TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_audit_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_created ON audit_logs(created_at);

CREATE TABLE media (
  id INTEGER PRIMARY KEY,
  url TEXT NOT NULL,                  -- /uploads/... (Git) or R2 key if R2 is ever enabled
  alt_text TEXT,
  mime TEXT,
  bytes INTEGER,
  uploaded_by INTEGER REFERENCES admin_users(id),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
