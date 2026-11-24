# bdresult.me — ভর্তি ক্যালেন্ডার + SEO + সরাসরি Publish (২০২৬-১১-২৪)

## ফাইল (একই পাথে replace/add; বাকি কিছু মুছবেন না)
- `build.js`, `admission-build.js`, `src/worker.js`
- `admin/config.yml`, `admin/cms.html`, `admin/index.html`
- `content/admission/*.json` (৬১টি), `content/admission-settings.json`
- `static/_headers`, `static/og-default.png`, `static/logo-512.png`
- `README-ADMISSION-CALENDAR.md`, `README-SEO-UPDATE.md`

## পরিবর্তন
1. **CMS সরাসরি publish:** `publish_mode: simple`।
2. **robots.txt:** `*` + ২৬টি AI/সার্চ বট `Allow: /` (`/admin/`, `/api/` বন্ধ); `llms.txt` যোগ।
3. **SEO (static পেজ):** meta description ≤১৬০, hreflang, OG/Twitter + ডিফল্ট OG ছবি, Organization/WebSite/Article/CollectionPage/WebPage/Event/FAQ schema, দৃশ্যমান breadcrumb, image sitemap, সত্যিকারের lastmod, খালি ক্যাটাগরি `noindex`।
4. **SEO (Worker পেজ: /institutions, /institution, /districts, /upazilas, /results):** একই meta/OG/Twitter/hreflang/robots উন্নতি `renderPublicLayout`-এ।
5. `static/_headers`: আগের নিয়ম রেখে `/admin/*` ও JSON এন্ডপয়েন্টে noindex, ক্যাশ ও ics header যোগ।
6. নতুন CMS ফিল্ড: SEO Title, Image Alt, Noindex, Bing code, Social URLs, প্রতিটি পরীক্ষার SEO Title/Description।

## লাইভের পর
- Search Console ও Bing Webmaster-এ `sitemap.xml` সাবমিট করুন।
- Cloudflare-এ Block AI bots / Managed robots.txt বন্ধ করুন।
- Rich Results Test-এ একটি পোস্ট, একটি পরীক্ষার পেজ ও একটি প্রতিষ্ঠানের পেজ দেখুন।
