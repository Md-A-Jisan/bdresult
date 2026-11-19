-- ============================================================================
-- BDRESULT.ME - MIGRATION 0003: REVISIONS, SETTINGS, ROLLBACK & 64 DISTRICTS
-- File: migrations/0003_complete_features.sql
-- ============================================================================

-- 1. Post Revision History Table (Section 10 requirement)
CREATE TABLE IF NOT EXISTS post_revisions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL,
    title_bn TEXT NOT NULL,
    content_markdown TEXT NOT NULL,
    edited_by_admin_id INTEGER,
    revision_note TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_revisions_post ON post_revisions(post_id, created_at DESC);

-- 2. System Settings Table (Module 21 & SEO/Ranking Methodology Settings)
CREATE TABLE IF NOT EXISTS system_settings (
    setting_key TEXT PRIMARY KEY,
    setting_value TEXT NOT NULL,
    updated_at TEXT DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO system_settings (setting_key, setting_value) VALUES
('site_title_suffix', '| bdresult.me'),
('min_completeness_for_index', '50'),
('ranking_methodology_bn', 'bdresult.me কখনোই শুধুমাত্র পাসের হারের ওপর ভিত্তি করে বিভ্রান্তিকর র‍্যাঙ্কিং তৈরি করে না। তুলনা করার সময় একই পরীক্ষা (যেমন SSC বা HSC), একই শিক্ষা বর্ষ, ন্যূনতম ৫০ জন পরীক্ষার্থী এবং পাসের হারের পাশাপাশি জিপিএ-৫ প্রাপ্তির হার ও ধারাবাহিকতা বিবেচনা করা হয়।'),
('public_reviews_enabled', '1'),
('rate_limit_per_hour', '30');

-- 3. Track Import Job ID on Institutions for One-Click Rollback (Section 12)
ALTER TABLE institutions ADD COLUMN import_job_id INTEGER;

-- 4. Seed Post Categories (Section 10)
INSERT OR IGNORE INTO post_categories (id, slug, name_bn, name_en, description_bn) VALUES
(1, 'result', 'রেজাল্ট ও ফলাফল', 'Results', 'বোর্ড ও বিশ্ববিদ্যালয় পরীক্ষার ফলাফল ও মার্কশিট গাইড'),
(2, 'admission', 'ভর্তি তথ্য', 'Admission', 'স্কুল, কলেজ ও বিশ্ববিদ্যালয় ভর্তি বিজ্ঞপ্তি ও আবেদন গাইড'),
(3, 'institution-review', 'প্রতিষ্ঠান রিভিউ', 'Institution Review', 'শিক্ষাপ্রতিষ্ঠানের একাডেমিক ও অবকাঠামোগত বিশ্লেষণ'),
(4, 'education-news', 'শিক্ষা সংবাদ', 'Education News', 'শিক্ষা মন্ত্রণালয় ও বোর্ডের সর্বশেষ নোটিশ ও খবর'),
(5, 'scholarship', 'উপবৃত্তি ও স্কলারশিপ', 'Scholarship', 'সরকারি ও বেসরকারি শিক্ষাবৃত্তির তথ্য'),
(6, 'academic-resources', 'একাডেমিক রিসোর্স', 'Academic Resources', 'সিলেবাস, রুটিন, জিপিএ ক্যালকুলেটর ও গাইড');

-- 5. Seed All 64 Districts of Bangladesh across 8 Divisions
INSERT OR IGNORE INTO districts (division_id, slug, name_en, name_bn) VALUES
-- Dhaka Division (1)
(1, 'dhaka', 'Dhaka', 'ঢাকা'), (1, 'gazipur', 'Gazipur', 'গাজীপুর'), (1, 'narayanganj', 'Narayanganj', 'নারায়ণগঞ্জ'),
(1, 'narsingdi', 'Narsingdi', 'নরসিংদী'), (1, 'manikganj', 'Manikganj', 'মানিকগঞ্জ'), (1, 'munshiganj', 'Munshiganj', 'মুন্সীগঞ্জ'),
(1, 'tangail', 'Tangail', 'টাঙ্গাইল'), (1, 'kishoreganj', 'Kishoreganj', 'কিশোরগঞ্জ'), (1, 'faridpur', 'Faridpur', 'ফরিদপুর'),
(1, 'gopalganj', 'Gopalganj', 'গোপালগঞ্জ'), (1, 'madaripur', 'Madaripur', 'মাদারীপুর'), (1, 'rajbari', 'Rajbari', 'রাজবাড়ী'),
(1, 'shariatpur', 'Shariatpur', 'শরীয়তপুর'),
-- Chattogram Division (2)
(2, 'chattogram', 'Chattogram', 'চট্টগ্রাম'), (2, 'coxs-bazar', 'Coxs Bazar', 'কক্সবাজার'), (2, 'cumilla', 'Cumilla', 'কুমিল্লা'),
(2, 'brahmanbaria', 'Brahmanbaria', 'ব্রাহ্মণবাড়িয়া'), (2, 'chandpur', 'Chandpur', 'চাঁদপুর'), (2, 'noakhali', 'Noakhali', 'নোয়াখালী'),
(2, 'feni', 'Feni', 'ফেনী'), (2, 'lakshmipur', 'Lakshmipur', 'লক্ষ্মীপুর'), (2, 'khagrachhari', 'Khagrachhari', 'খাগড়াছড়ি'),
(2, 'rangamati', 'Rangamati', 'রাঙ্গামাটি'), (2, 'bandarban', 'Bandarban', 'বান্দরবান'),
-- Rajshahi Division (3)
(3, 'rajshahi', 'Rajshahi', 'রাজশাহী'), (3, 'bogura', 'Bogura', 'বগুড়া'), (3, 'pabna', 'Pabna', 'পাবনা'),
(3, 'sirajganj', 'Sirajganj', 'সিরাজগঞ্জ'), (3, 'natore', 'Natore', 'নাটোর'), (3, 'naogaon', 'Naogaon', 'নওগাঁ'),
(3, 'chapainawabganj', 'Chapainawabganj', 'চাঁপাইনবাবগঞ্জ'), (3, 'joypurhat', 'Joypurhat', 'জয়পুরহাট'),
-- Khulna Division (4)
(4, 'khulna', 'Khulna', 'খুলনা'), (4, 'kushtia', 'Kushtia', 'কুষ্টিয়া'), (4, 'jashore', 'Jashore', 'যশোর'),
(4, 'jhenaidah', 'Jhenaidah', 'ঝিনাইদহ'), (4, 'chuadanga', 'Chuadanga', 'চুয়াডাঙ্গা'), (4, 'meherpur', 'Meherpur', 'মেহেরপুর'),
(4, 'magura', 'Magura', 'মাগুরা'), (4, 'narail', 'Narail', 'নড়াইল'), (4, 'bagerhat', 'Bagerhat', 'বাগেরহাট'),
(4, 'satkhira', 'Satkhira', 'সাতক্ষীরা'),
-- Barishal Division (5)
(5, 'barishal', 'Barishal', 'বরিশাল'), (5, 'patuakhali', 'Patuakhali', 'পটুয়াখালী'), (5, 'bhola', 'Bhola', 'ভোলা'),
(5, 'pirojpur', 'Pirojpur', 'পিরোজপুর'), (5, 'jhalokati', 'Jhalokati', 'ঝালকাঠি'), (5, 'barguna', 'Barguna', 'বরগুনা'),
-- Sylhet Division (6)
(6, 'sylhet', 'Sylhet', 'সিলেট'), (6, 'moulvibazar', 'Moulvibazar', 'মৌলভীবাজার'), (6, 'habiganj', 'Habiganj', 'হবিগঞ্জ'),
(6, 'sunamganj', 'Sunamganj', 'সুনামগঞ্জ'),
-- Rangpur Division (7)
(7, 'rangpur', 'Rangpur', 'রংপুর'), (7, 'dinajpur', 'Dinajpur', 'দিনাজপুর'), (7, 'kurigram', 'Kurigram', 'কুড়িগ্রাম'),
(7, 'gaibandha', 'Gaibandha', 'গাইবান্ধা'), (7, 'nilphamari', 'Nilphamari', 'নীলফামারী'), (7, 'panchagarh', 'Panchagarh', 'পঞ্চগড়'),
(7, 'thakurgaon', 'Thakurgaon', 'ঠাকুরগাঁও'), (7, 'lalmonirhat', 'Lalmonirhat', 'লালমনিরহাট'),
-- Mymensingh Division (8)
(8, 'mymensingh', 'Mymensingh', 'ময়মনসিংহ'), (8, 'jamalpur', 'Jamalpur', 'জামালপুর'), (8, 'netrokona', 'Netrokona', 'নেত্রকোনা'),
(8, 'sherpur', 'Sherpur', 'শেরপুর');