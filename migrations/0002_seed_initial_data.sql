-- ============================================================================
-- BDRESULT.ME - SEED DATA (Types, Locations, Categories & Pilot Institutions)
-- Migration: 0002_seed_initial_data.sql
-- ============================================================================

INSERT OR IGNORE INTO institution_types (id, slug, name_en, name_bn, description_bn, display_order) VALUES
(1, 'schools', 'School', 'স্কুল ও মাধ্যমিক বিদ্যালয়', 'বাংলাদেশের সরকারি ও বেসরকারি মাধ্যমিক ও নিম্ন-মাধ্যমিক বিদ্যালয়সমূহ।', 1),
(2, 'colleges', 'College', 'কলেজ ও মহাবিদ্যালয়', 'উচ্চ মাধ্যমিক, ডিগ্রি ও অনার্স পর্যায়ের সরকারি ও বেসরকারি কলেজসমূহ।', 2),
(3, 'madrasas', 'Madrasa', 'মাদ্রাসা', 'দাখিল, আলিম, ফাজিল ও কামিল পর্যায়ের আলিয়া ও কওমি মাদ্রাসাসমূহ।', 3),
(4, 'technical', 'Technical & Vocational', 'কারিগরি ও ভোকেশনাল', 'পলিটেকনিক ইনস্টিটিউট, টেকনিক্যাল স্কুল ও কলেজ এবং ভোকেশনাল প্রতিষ্ঠানসমূহ।', 4),
(5, 'universities', 'University', 'বিশ্ববিদ্যালয়', 'পাবলিক, প্রাইভেট ও আন্তর্জাতিক বিশ্ববিদ্যালয়সমূহ।', 5);

INSERT OR IGNORE INTO divisions (id, slug, name_en, name_bn, bbs_code) VALUES
(1, 'dhaka', 'Dhaka', 'ঢাকা', '30'),
(2, 'chattogram', 'Chattogram', 'চট্টগ্রাম', '20'),
(3, 'rajshahi', 'Rajshahi', 'রাজশাহী', '50'),
(4, 'khulna', 'Khulna', 'খুলনা', '40'),
(5, 'barishal', 'Barishal', 'বরিশাল', '10'),
(6, 'sylhet', 'Sylhet', 'সিলেট', '60'),
(7, 'rangpur', 'Rangpur', 'রংপুর', '55'),
(8, 'mymensingh', 'Mymensingh', 'ময়মনসিংহ', '45');

INSERT OR IGNORE INTO districts (id, division_id, slug, name_en, name_bn, bbs_code, intro_bn) VALUES
(1, 1, 'dhaka', 'Dhaka', 'ঢাকা', '26', 'ঢাকা জেলার সকল ভেরিফাইড স্কুল, কলেজ, মাদ্রাসা ও বিশ্ববিদ্যালয়ের তালিকা ও ফলাফল।'),
(2, 1, 'narayanganj', 'Narayanganj', 'নারায়ণগঞ্জ', '67', 'নারায়ণগঞ্জ জেলার সকল শিক্ষাপ্রতিষ্ঠানের EIIN, ভর্তি ও বোর্ড ফলাফলের তথ্য।'),
(3, 4, 'kushtia', 'Kushtia', 'কুষ্টিয়া', '50', 'কুষ্টিয়া জেলার সকল উপজেলা ভিত্তিক স্কুল, কলেজ, মাদ্রাসা ও কারিগরি শিক্ষাপ্রতিষ্ঠানের তালিকা।'),
(4, 2, 'chattogram', 'Chattogram', 'চট্টগ্রাম', '15', 'চট্টগ্রাম জেলার শিক্ষাপ্রতিষ্ঠান ডিরেক্টরি।'),
(5, 3, 'rajshahi', 'Rajshahi', 'রাজশাহী', '81', 'রাজশাহী জেলার শিক্ষাপ্রতিষ্ঠান ডিরেক্টরি।');

INSERT OR IGNORE INTO upazilas (id, district_id, slug, name_en, name_bn, bbs_code, intro_bn) VALUES
(1, 2, 'bandar', 'Bandar', 'বন্দর', '01', 'নারায়ণগঞ্জ জেলার বন্দর উপজেলার সকল শিক্ষাপ্রতিষ্ঠানের তালিকা।'),
(2, 3, 'daulatpur-kushtia', 'Daulatpur', 'দৌলতপুর (কুষ্টিয়া)', '02', 'কুষ্টিয়া জেলার দৌলতপুর উপজেলার সকল স্কুল, কলেজ ও মাদ্রাসার তালিকা।'),
(3, 3, 'kushtia-sadar', 'Kushtia Sadar', 'কুষ্টিয়া সদর', '01', 'কুষ্টিয়া সদর উপজেলার শিক্ষাপ্রতিষ্ঠানসমূহ।'),
(4, 1, 'dhanmondi', 'Dhanmondi', 'ধানমন্ডি', '01', 'ঢাকা মহানগরের ধানমন্ডি থানার শিক্ষাপ্রতিষ্ঠানসমূহ।');

-- Default Super Admin (Your GitHub Username from config.yml)
INSERT OR IGNORE INTO admin_users (id, github_username, display_name, role, is_active) VALUES
(1, 'Md-A-Jisan', 'Md. A. Jisan (Super Admin)', 'super_admin', 1);

-- Pilot Verified Institution 1: Philipnagar Secondary School (Matches existing post)
INSERT OR IGNORE INTO institutions (
    id, internal_code, eiin, slug, name_en, name_bn, normalized_name,
    institution_type_id, division_id, district_id, upazila_id,
    address_bn, address_en, postal_code, established_year, management_type,
    education_board, education_levels, academic_groups, gender_type,
    overview_bn, history_bn, admission_info_bn,
    verification_status, is_published, completeness_score, last_verified_at
) VALUES (
    1, 'BDR-10001', '117534', 'philipnagar-high-school-kushtia',
    'Philipnagar Secondary School', 'ফিলিপনগর মাধ্যমিক বিদ্যালয়', 'philipnagarsecondaryschool',
    1, 4, 3, 2,
    'ফিলিপনগর ইউনিয়ন, দৌলতপুর, কুষ্টিয়া', 'Philipnagar Union, Daulatpur, Kushtia', '7052',
    1965, 'mpo', 'Jashore',
    '["মাধ্যমিক (৬ষ্ঠ - ১০ম শ্রেণী)"]',
    '["বিজ্ঞান", "মানবিক", "ব্যবসায় শিক্ষা"]',
    'co-education',
    'ফিলিপনগর মাধ্যমিক বিদ্যালয় কুষ্টিয়া জেলার দৌলতপুর উপজেলার ফিলিপনগর ইউনিয়নের একটি ঐতিহ্যবাহী মাধ্যমিক শিক্ষাপ্রতিষ্ঠান। বিদ্যালয়টি যশোর শিক্ষা বোর্ডের অধীনে পরিচালিত।',
    'পদ্মা নদী তীরবর্তী ফিলিপনগর অঞ্চলের শিক্ষার্থীদের মাধ্যমিক শিক্ষার সুযোগ সম্প্রসারণের লক্ষ্যে স্থানীয় শিক্ষানুরাগীদের উদ্যোগে বিদ্যালয়টি প্রতিষ্ঠিত হয়।',
    'প্রতি বছর সরকারি নীতিমালা অনুযায়ী ৬ষ্ঠ থেকে ৯ম শ্রেণীতে ভর্তি কার্যক্রম পরিচালিত হয়। বিস্তারিত তথ্যের জন্য আমাদের ফিলিপনগর হাই স্কুল রিভিউ আর্টিকেলটি পড়ুন: /philipnagar-high-school/',
    'verified', 1, 90, datetime('now')
);

-- Pilot Verified Institution 2: Govt. Kadam Rasul College (Matches existing post)
INSERT OR IGNORE INTO institutions (
    id, internal_code, eiin, slug, name_en, name_bn, normalized_name,
    institution_type_id, division_id, district_id, upazila_id,
    address_bn, address_en, postal_code, established_year, management_type,
    education_board, education_levels, academic_groups, programs_offered, gender_type,
    overview_bn, history_bn, admission_info_bn,
    verification_status, is_published, completeness_score, last_verified_at
) VALUES (
    2, 'BDR-10002', '112385', 'govt-kadam-rasul-college-narayanganj',
    'Govt. Kadam Rasul College', 'সরকারি কদম রসুল কলেজ', 'govtkadamrasulcollege',
    2, 1, 2, 1,
    'বন্দর, নারায়ণগঞ্জ', 'Bandar, Narayanganj', '1411',
    1991, 'government', 'Dhaka',
    '["উচ্চ মাধ্যমিক (HSC)", "স্নাতক (পাস)", "স্নাতক (সম্মান)"]',
    '["বিজ্ঞান", "মানবিক", "ব্যবসায় শিক্ষা"]',
    '["HSC", "BA (Pass)", "BSS (Pass)", "BBS (Pass)", "Honours (National University)"]',
    'co-education',
    'সরকারি কদম রসুল কলেজ নারায়ণগঞ্জ জেলার বন্দর উপজেলার অন্যতম প্রধান সরকারি উচ্চশিক্ষা প্রতিষ্ঠান। এটি ঢাকা শিক্ষা বোর্ড এবং জাতীয় বিশ্ববিদ্যালয়ের অধিভুক্ত।',
    '১৯৯১ সালে প্রতিষ্ঠিত হওয়ার পর বন্দর অঞ্চলের উচ্চশিক্ষা বিস্তারে কলেজটি গুরুত্বপূর্ণ ভূমিকা পালন করে আসছে এবং পরবর্তীতে সরকারিকরণ করা হয়।',
    'একাদশ শ্রেণীতে কেন্দ্রীয় XI Class Admission সিস্টেমের মাধ্যমে এবং স্নাতক পর্যায়ে জাতীয় বিশ্ববিদ্যালয়ের ভর্তি পোর্টালের মাধ্যমে ভর্তি সম্পন্ন হয়। আমাদের বিস্তারিত গাইড দেখুন: /govt-kadam-rasul-college-narayanganj/',
    'verified', 1, 95, datetime('now')
);

-- Seed Provenance Sources for Pilot Institutions
INSERT OR IGNORE INTO institution_sources (institution_id, source_name, source_url, covered_fields, accessed_date, verification_status) VALUES
(1, 'যশোর শিক্ষা বোর্ড ও EMIS পোর্টাল', 'https://emis.gov.bd', 'EIIN, ঠিকানা, শিক্ষা স্তর ও এমপিও স্ট্যাটাস', date('now'), 'verified'),
(2, 'ঢাকা শিক্ষা বোর্ড ও জাতীয় বিশ্ববিদ্যালয়', 'https://dhakaeducationboard.gov.bd', 'EIIN, সরকারি স্ট্যাটাস, এইচএসসি ও অনার্স কোর্স', date('now'), 'verified');

-- Seed Sample Verified Board Results
INSERT OR IGNORE INTO institution_results (
    institution_id, exam_type, exam_year, education_board, academic_group,
    total_students, appeared_students, passed_students, failed_students, gpa5_students,
    pass_rate, gpa5_rate, source_name, verification_status
) VALUES
(1, 'SSC', 2025, 'Jashore', 'All', 145, 142, 128, 14, 18, 90.14, 12.68, 'Jashore Education Board Result Archive', 'verified'),
(1, 'SSC', 2024, 'Jashore', 'All', 138, 136, 121, 15, 14, 88.97, 10.29, 'Jashore Education Board Result Archive', 'verified'),
(2, 'HSC', 2025, 'Dhaka', 'All', 620, 612, 534, 78, 42, 87.25, 6.86, 'Dhaka Education Board Institutional Result', 'verified'),
(2, 'HSC', 2024, 'Dhaka', 'All', 590, 585, 502, 83, 35, 85.81, 5.98, 'Dhaka Education Board Institutional Result', 'verified');

-- Seed Editorial Review
INSERT OR IGNORE INTO institution_reviews (
    institution_id, review_type, author_name, author_role, title_bn,
    academic_analysis_bn, facilities_analysis_bn, accessibility_notes_bn,
    strengths_json, limitations_json, overall_assessment_bn, moderation_status, published_at
) VALUES
(2, 'editorial_analysis', 'bdresult সম্পাদনা পর্ষদ', 'Editorial Review Desk', 'সরকারি কদম রসুল কলেজের একাডেমিক ও অবকাঠামোগত মূল্যায়ন',
'বিগত ২ বছরের ঢাকা বোর্ডের এইচএসসি ফলাফল বিশ্লেষণে দেখা যায় কলেজটির গড় পাসের হার ৮৫% থেকে ৮৭%-এর মধ্যে স্থিতিশীল রয়েছে।',
'সরকারি কলেজ হিসেবে একাডেমিক ভবন, বিজ্ঞানাগার ও লাইব্রেরি সুবিধা রয়েছে।',
'নারায়ণগঞ্জ বন্দর এলাকা থেকে সড়ক ও নদীপথে সহজ যোগাযোগ ব্যবস্থা রয়েছে।',
'["সরকারি ব্যবস্থাপনায় কম খরচে উচ্চশিক্ষার সুযোগ", "উচ্চ মাধ্যমিক ও জাতীয় বিশ্ববিদ্যালয়ের অধীনে স্নাতক কোর্সের সমন্বয়", "ধারাবাহিক ৮৫%+ বোর্ড পাসের হার"]',
'["শিক্ষার্থী সংখ্যার তুলনায় আবাসিক হোস্টেল সুবিধার সীমাবদ্ধতা"]',
'নারায়ণগঞ্জের বন্দর উপজেলার শিক্ষার্থীদের জন্য সরকারি কদম রসুল কলেজ একটি নির্ভরযোগ্য ও সাশ্রয়ী উচ্চশিক্ষা প্রতিষ্ঠান।',
'approved', datetime('now'));