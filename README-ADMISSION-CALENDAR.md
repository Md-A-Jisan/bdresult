# bdresult.me — Admission Calendar (GitHub-based, কোনো ডাটাবেস নেই)

ডেটা থাকে GitHub repo-তে (`content/admission/*.json`)। প্রতিটি commit-এ Cloudflare বিল্ড চালিয়ে
স্ট্যাটিক পেজ বানায় → `/admission-calendar/`। D1 / Worker পরিবর্তন লাগে না।

## ফাইল (প্রজেক্টে একই পাথে কপি করুন)
| ফাইল | কাজ |
|---|---|
| `admission-build.js` | নতুন: পেজ, ডিটেইল পেজ, .ics, schema বানায় |
| `build.js` | মেনু/সাইডবারে লিংক, sitemap-admission.xml, মডিউল কল |
| `content/admission/*.json` | ৬১টি পরীক্ষা (প্রতিটির আলাদা ফাইল) |
| `content/admission-settings.json` | পেজ SEO/ইন্ট্রো/সেশন |
| `admin/config.yml` | Decap CMS-এ নতুন দুটি collection |
| `admin/cms.html` | Decap CMS-এর সরাসরি লিংক (/admin/cms.html) |
| `admin/index.html` | সাইডবারে "22. Admission Calendar (GitHub)" বাটন |

## ডেটা এডিট করার উপায়
1. **Decap CMS:** `/admin/` → "22. Admission Calendar" বাটন (বা সরাসরি `/admin/cms.html`) → "ভর্তি পরীক্ষা ক্যালেন্ডার" → ফর্ম পূরণ → Publish। CMS GitHub-এ commit করে, Cloudflare অটো বিল্ড করে।
2. **সরাসরি GitHub:** `content/admission/du-a.json` খুলে এডিট করুন। নতুন পরীক্ষার জন্য একটি ফাইল কপি করে নতুন slug দিন।

ফাইলের ফরম্যাট: `exam_date` = `2026-12-12`, `exam_time` = `11:00` (বাংলাদেশ সময়),
`date_status` = `confirmed` বা `tentative`, `second_time` = `yes` / `no` / `""`,
`published: false` দিলে সাইটে দেখাবে না।

## সতর্কতা
- `admin/config.yml`-এ এখন `publish_mode: simple` — CMS-এ Publish চাপলেই সরাসরি GitHub `main`-এ commit হয় ও Cloudflare অটো বিল্ড করে (draft/review ধাপ নেই)। আবার ধাপ চাইলে `editorial_workflow` লিখুন।
- এই ধাপে কিছুই Cloudflare ডাটাবেসে যায় না।
- `Event` schema শুধু `date_status: confirmed` পরীক্ষায় আসে।
- সিড ডেটা screenshot থেকে নেওয়া; অফিসিয়াল সার্কুলারের সাথে মিলিয়ে নিন। ফি/লিংক ফাঁকা আছে।

## লাইভ হওয়ার পর
1. Search Console → URL Inspection → `https://bdresult.me/admission-calendar/` → Request indexing
2. Sitemap: `sitemap.xml` এ নতুন `sitemap-admission.xml` অটো যোগ হয়েছে (নতুন সাবমিট লাগবে না, ইচ্ছে হলে আবার সাবমিট করুন)
3. আবেদন/পরীক্ষা শেষ হলে তারিখ ঠিক রাখুন; countdown ও আবেদনের অবস্থা (চলছে/শেষ) ব্রাউজারেই লাইভ আপডেট হয়
