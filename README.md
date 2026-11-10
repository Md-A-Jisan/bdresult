# bdresult.me - Cloudflare Pages setup

## 1. GitHub
Create a repo, upload this folder. In `admin/config.yml` set `repo:`.

## 2. Cloudflare Pages (site)
Workers & Pages -> Create -> Pages -> Connect to Git -> pick the repo.
- Build command: `npm install && npm run build`
- Output directory: `dist`
Then Custom domains -> add `bdresult.me`.

## 3. Admin login (OAuth worker)
1. GitHub -> Settings -> Developer settings -> OAuth Apps -> New.
   Homepage: https://bdresult.me  |  Callback: https://bdresult-auth.YOUR_SUBDOMAIN.workers.dev/callback
2. Cloudflare -> Workers & Pages -> Create Worker (name: `bdresult-auth`) -> paste `oauth/worker.js` -> Deploy.
3. Worker -> Settings -> Variables: add `GITHUB_CLIENT_ID` and secret `GITHUB_CLIENT_SECRET`.
4. Put the worker URL in `admin/config.yml` -> `base_url`. Commit.
5. Open https://bdresult.me/admin/

## 4. Google Analytics
Admin -> Settings & Ads -> "Google Analytics 4 Measurement ID" -> paste `G-XXXXXXXXXX` -> Publish.
(Other trackers: use "Other Tracking Code".)

## 5. Contact form
Create a free form at formspree.io, replace `YOUR_FORM_ID` in `content/pages/contact.md`.

## 6. Search Console
Submit https://bdresult.me/sitemap.xml
