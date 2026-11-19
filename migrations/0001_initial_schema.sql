-- ============================================================================
-- BDRESULT.ME - CORE RELATIONAL DATABASE SCHEMA (Cloudflare D1 / SQLite)
-- Migration: 0001_initial_schema.sql
-- ============================================================================

PRAGMA foreign_keys = ON;

-- 1. INSTITUTION TYPES (School, College, Madrasa, Technical, University)
CREATE TABLE IF NOT EXISTS institution_types (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT NOT NULL UNIQUE,
    name_en TEXT NOT NULL,
    name_bn TEXT NOT NULL,
    description_bn TEXT,
    display_order INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
);

-- 2. DIVISIONS
CREATE TABLE IF NOT EXISTS divisions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT NOT NULL UNIQUE,
    name_en TEXT NOT NULL,
    name_bn TEXT NOT NULL,
    bbs_code TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

-- 3. DISTRICTS
CREATE TABLE IF NOT EXISTS districts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    division_id INTEGER NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    name_en TEXT NOT NULL,
    name_bn TEXT NOT NULL,
    bbs_code TEXT,
    intro_bn TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (division_id) REFERENCES divisions(id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_districts_division ON districts(division_id);

-- 4. UPAZILAS
CREATE TABLE IF NOT EXISTS upazilas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    district_id INTEGER NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    name_en TEXT NOT NULL,
    name_bn TEXT NOT NULL,
    bbs_code TEXT,
    intro_bn TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (district_id) REFERENCES districts(id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_upazilas_district ON upazilas(district_id);

-- 5. INSTITUTIONS (Core Table)
CREATE TABLE IF NOT EXISTS institutions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    internal_code TEXT NOT NULL UNIQUE, -- Fallback unique ID when EIIN is null (e.g., BDR-10001)
    eiin TEXT UNIQUE,                   -- Nullable, but strictly UNIQUE when present
    slug TEXT NOT NULL UNIQUE,
    name_en TEXT NOT NULL,
    name_bn TEXT NOT NULL,
    normalized_name TEXT NOT NULL,      -- Lowercase stripped name for duplicate detection
    institution_type_id INTEGER NOT NULL,
    division_id INTEGER NOT NULL,
    district_id INTEGER NOT NULL,
    upazila_id INTEGER NOT NULL,
    
    -- Location & Address
    address_en TEXT,
    address_bn TEXT,
    postal_code TEXT,
    latitude REAL,
    longitude REAL,
    
    -- Institutional Profile
    established_year INTEGER,
    management_type TEXT CHECK(management_type IN ('government', 'non_government', 'autonomous', 'private', 'mpo', 'unknown')) DEFAULT 'unknown',
    education_board TEXT,               -- Dhaka, Rajshahi, Madrasah, Technical, etc.
    education_levels TEXT,              -- JSON array: ["Secondary", "Higher Secondary"]
    academic_groups TEXT,               -- JSON array: ["Science", "Humanities", "Business Studies"]
    programs_offered TEXT,              -- JSON array of verified degrees/courses
    gender_type TEXT CHECK(gender_type IN ('boys', 'girls', 'co-education', 'unknown')) DEFAULT 'unknown',
    shift_info TEXT,
    
    -- Narrative Content (Strict separation of official fact vs overview)
    overview_bn TEXT,
    overview_en TEXT,
    history_bn TEXT,
    admission_info_bn TEXT,
    official_admission_url TEXT,
    facilities_json TEXT,               -- JSON array of verified facilities only
    
    -- Contact Summary
    official_website TEXT,
    
    -- Verification & SEO Publishing Guardrails
    verification_status TEXT CHECK(verification_status IN ('unverified', 'pending_review', 'verified', 'rejected')) DEFAULT 'unverified',
    is_published INTEGER DEFAULT 0,     -- 1 = Publicly indexable, 0 = Draft/Noindex
    completeness_score INTEGER DEFAULT 0, -- 0 to 100 calculated score
    last_verified_at TEXT,
    verified_by_admin_id INTEGER,
    
    -- Custom SEO Overrides
    seo_title TEXT,
    seo_description TEXT,
    
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    
    FOREIGN KEY (institution_type_id) REFERENCES institution_types(id) ON DELETE RESTRICT,
    FOREIGN KEY (division_id) REFERENCES divisions(id) ON DELETE RESTRICT,
    FOREIGN KEY (district_id) REFERENCES districts(id) ON DELETE RESTRICT,
    FOREIGN KEY (upazila_id) REFERENCES upazilas(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_institutions_eiin ON institutions(eiin);
CREATE INDEX IF NOT EXISTS idx_institutions_type ON institutions(institution_type_id);
CREATE INDEX IF NOT EXISTS idx_institutions_location ON institutions(division_id, district_id, upazila_id);
CREATE INDEX IF NOT EXISTS idx_institutions_pub_status ON institutions(is_published, verification_status);
CREATE INDEX IF NOT EXISTS idx_institutions_norm_name ON institutions(normalized_name, district_id);

-- 6. INSTITUTION CONTACTS
CREATE TABLE IF NOT EXISTS institution_contacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    institution_id INTEGER NOT NULL,
    contact_type TEXT CHECK(contact_type IN ('phone', 'email', 'Website', 'facebook', 'hotline')) NOT NULL,
    contact_value TEXT NOT NULL,
    label_bn TEXT,
    is_primary INTEGER DEFAULT 0,
    is_verified INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (institution_id) REFERENCES institutions(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_contacts_institution ON institution_contacts(institution_id);

-- 7. INSTITUTION SOURCES (Provenance & Trust Tracking)
CREATE TABLE IF NOT EXISTS institution_sources (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    institution_id INTEGER NOT NULL,
    source_name TEXT NOT NULL,          -- e.g., BANBEIS, DSHE, Dhaka Board, Official Website
    source_url TEXT,
    covered_fields TEXT,                -- e.g., "EIIN, Established Year, Result 2025"
    accessed_date TEXT NOT NULL,
    verification_status TEXT CHECK(verification_status IN ('verified', 'archived', 'disputed')) DEFAULT 'verified',
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (institution_id) REFERENCES institutions(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_sources_institution ON institution_sources(institution_id);

-- 8. INSTITUTION ALIASES (For Search & Duplicate Prevention)
CREATE TABLE IF NOT EXISTS institution_aliases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    institution_id INTEGER NOT NULL,
    alias_name TEXT NOT NULL,
    normalized_alias TEXT NOT NULL,
    language TEXT CHECK(language IN ('bn', 'en', 'banglish')) DEFAULT 'en',
    FOREIGN KEY (institution_id) REFERENCES institutions(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_aliases_normalized ON institution_aliases(normalized_alias);

-- 9. INSTITUTION RESULTS (SSC, HSC, Dakhil, Alim, Equivalent)
CREATE TABLE IF NOT EXISTS institution_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    institution_id INTEGER NOT NULL,
    exam_type TEXT CHECK(exam_type IN ('SSC', 'HSC', 'Dakhil', 'Alim', 'SSC_Vocational', 'HSC_BM', 'Equivalent')) NOT NULL,
    exam_year INTEGER NOT NULL,
    education_board TEXT NOT NULL,
    academic_group TEXT DEFAULT 'All',  -- 'All', 'Science', 'Humanities', 'Business Studies'
    total_students INTEGER,
    appeared_students INTEGER NOT NULL CHECK(appeared_students >= 0),
    passed_students INTEGER NOT NULL CHECK(passed_students >= 0),
    failed_students INTEGER NOT NULL CHECK(failed_students >= 0),
    gpa5_students INTEGER NOT NULL DEFAULT 0 CHECK(gpa5_students >= 0),
    pass_rate REAL NOT NULL,            -- Calculated: (passed / appeared) * 100
    gpa5_rate REAL NOT NULL,            -- Calculated: (gpa5 / appeared) * 100
    source_name TEXT NOT NULL,
    source_url TEXT,
    verification_status TEXT CHECK(verification_status IN ('unverified', 'verified')) DEFAULT 'unverified',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    UNIQUE(institution_id, exam_type, exam_year, academic_group),
    FOREIGN KEY (institution_id) REFERENCES institutions(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_results_inst_exam_year ON institution_results(institution_id, exam_type, exam_year DESC);

-- 10. INSTITUTION REVIEWS (Strict Distinction: Editorial vs User Feedback)
CREATE TABLE IF NOT EXISTS institution_reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    institution_id INTEGER NOT NULL,
    review_type TEXT CHECK(review_type IN ('editorial_analysis', 'user_feedback')) NOT NULL,
    author_name TEXT NOT NULL,
    author_role TEXT,                   -- e.g., 'bdresult Editorial Desk', 'Alumni', 'Guardian'
    title_bn TEXT,
    academic_analysis_bn TEXT,
    facilities_analysis_bn TEXT,
    accessibility_notes_bn TEXT,
    strengths_json TEXT,                -- JSON array of evidence-backed strengths
    limitations_json TEXT,              -- JSON array of evidence-backed limitations
    overall_assessment_bn TEXT,
    source_references_json TEXT,
    moderation_status TEXT CHECK(moderation_status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
    ip_hash TEXT,                       -- Privacy-preserving abuse protection for user feedback
    published_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (institution_id) REFERENCES institutions(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_reviews_inst_status ON institution_reviews(institution_id, review_type, moderation_status);

-- 11. CORRECTION REQUESTS (Public Crowdsourced Fact-Checking)
CREATE TABLE IF NOT EXISTS correction_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    institution_id INTEGER NOT NULL,
    requester_name TEXT NOT NULL,
    requester_email TEXT,
    requester_relation TEXT,            -- e.g., 'Teacher', 'Student', 'Official', 'Public'
    field_name TEXT NOT NULL,           -- e.g., 'EIIN', 'Address', 'SSC Result 2025'
    current_value TEXT,
    proposed_value TEXT NOT NULL,
    evidence_description TEXT NOT NULL,
    evidence_url TEXT,
    status TEXT CHECK(status IN ('pending', 'approved', 'rejected', 'clarification_needed')) DEFAULT 'pending',
    admin_notes TEXT,
    reviewed_by_admin_id INTEGER,
    reviewed_at TEXT,
    ip_hash TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (institution_id) REFERENCES institutions(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_corrections_status ON correction_requests(status, created_at DESC);

-- 12. ADMIN USERS & ROLES
CREATE TABLE IF NOT EXISTS admin_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    github_username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE,
    display_name TEXT NOT NULL,
    role TEXT CHECK(role IN ('super_admin', 'editor', 'verifier', 'contributor')) NOT NULL DEFAULT 'editor',
    is_active INTEGER DEFAULT 1,
    last_login_at TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

-- 13. VERIFICATION LOGS (Transparency History on Public Profiles)
CREATE TABLE IF NOT EXISTS verification_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    institution_id INTEGER NOT NULL,
    admin_user_id INTEGER,
    previous_status TEXT,
    new_status TEXT NOT NULL,
    verified_fields_summary TEXT NOT NULL,
    source_reference TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (institution_id) REFERENCES institutions(id) ON DELETE CASCADE,
    FOREIGN KEY (admin_user_id) REFERENCES admin_users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_verif_logs_inst ON verification_logs(institution_id, created_at DESC);

-- 14. AUDIT LOGS (System-wide Security & Activity Trail)
CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    admin_user_id INTEGER,
    action_type TEXT NOT NULL,          -- e.g., 'CREATE_INSTITUTION', 'BULK_IMPORT', 'APPROVE_CORRECTION'
    entity_type TEXT NOT NULL,          -- e.g., 'institutions', 'posts', 'results'
    entity_id TEXT,
    changes_json TEXT,                  -- JSON diff of before/after
    ip_address TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);

-- 15. MEDIA LIBRARY
CREATE TABLE IF NOT EXISTS media (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL UNIQUE,     -- e.g., '/uploads/govt-college-banner.webp'
    mime_type TEXT NOT NULL,
    file_size_bytes INTEGER,
    alt_text_bn TEXT NOT NULL,
    alt_text_en TEXT,
    uploaded_by_admin_id INTEGER,
    created_at TEXT DEFAULT (datetime('now'))
);

-- 16. POST CATEGORIES
CREATE TABLE IF NOT EXISTS post_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT NOT NULL UNIQUE,
    name_bn TEXT NOT NULL,
    name_en TEXT NOT NULL,
    description_bn TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

-- 17. POST TAGS
CREATE TABLE IF NOT EXISTS post_tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT NOT NULL UNIQUE,
    name_bn TEXT NOT NULL,
    name_en TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
);

-- 18. POSTS (Supports both Legacy Markdown Sync & New DB Posts)
CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT NOT NULL UNIQUE,
    post_type TEXT CHECK(post_type IN (
        'education_news', 'institution_review', 'admission_notice',
        'education_guide', 'exam_info', 'scholarship_info',
        'academic_resource', 'result_analysis', 'education_statistics'
    )) NOT NULL DEFAULT 'education_guide',
    title_bn TEXT NOT NULL,
    title_en TEXT,
    excerpt_bn TEXT,
    content_markdown TEXT NOT NULL,
    content_html TEXT NOT NULL,
    featured_image TEXT,
    featured_image_alt TEXT,
    category_id INTEGER,
    institution_id INTEGER,             -- Optional link to an institution profile
    author_name TEXT DEFAULT 'bdresult ডেস্ক',
    status TEXT CHECK(status IN ('draft', 'scheduled', 'published', 'archived')) DEFAULT 'draft',
    is_legacy_markdown INTEGER DEFAULT 0, -- 1 if synced from content/posts/*.md
    seo_title TEXT,
    meta_description TEXT,
    canonical_url TEXT,
    og_image TEXT,
    published_at TEXT,
    updated_at TEXT DEFAULT (datetime('now')),
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (category_id) REFERENCES post_categories(id) ON DELETE SET NULL,
    FOREIGN KEY (institution_id) REFERENCES institutions(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_posts_status_pub ON posts(status, published_at DESC);

-- Junction table for Post Tags
CREATE TABLE IF NOT EXISTS post_tag_map (
    post_id INTEGER NOT NULL,
    tag_id INTEGER NOT NULL,
    PRIMARY KEY (post_id, tag_id),
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES post_tags(id) ON DELETE CASCADE
);

-- Bulk Import Jobs Tracking Table
CREATE TABLE IF NOT EXISTS import_jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_name TEXT NOT NULL,
    total_rows INTEGER NOT NULL DEFAULT 0,
    valid_rows INTEGER NOT NULL DEFAULT 0,
    duplicate_rows INTEGER NOT NULL DEFAULT 0,
    error_rows INTEGER NOT NULL DEFAULT 0,
    status TEXT CHECK(status IN ('preview', 'completed', 'rolled_back', 'failed')) DEFAULT 'preview',
    error_report_json TEXT,
    imported_by_admin_id INTEGER,
    created_at TEXT DEFAULT (datetime('now'))
);