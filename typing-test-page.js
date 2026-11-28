// typing-test-page.js - Bangla typing test page (/bangla-typing-test/)
// Built by build.js through the site's own layout(). Texts live in content/typing-texts.json
// (add more passages there: {"id":"unique","cat":"বিজ্ঞান","text":"..."}). Client logic: assets/typing-test.js
const fs = require('fs');
module.exports = ({ w, layout, bc, U, S, ORG }) => {
  const URL_PATH = '/bangla-typing-test/';
  const data = JSON.parse(fs.readFileSync('content/typing-texts.json', 'utf8'));
  const cats = [...new Set(data.passages.map((p) => p.cat))];
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const TITLE = `বাংলা টাইপিং টেস্ট অনলাইন - ফ্রি স্পিড ও নির্ভুলতা পরীক্ষা | ${S.name}`;
  const DESC = 'অনলাইনে ফ্রি বাংলা টাইপিং টেস্ট দিন। ১ থেকে ১০ মিনিটের সময়, প্রতিবার নতুন লেখা, ফোনেটিক ও নিজের কিবোর্ড সাপোর্ট; গতি ও নির্ভুলতা সাথে সাথে দেখুন।';
  const FAQ = [
    ['বাংলা টাইপিং টেস্ট কীভাবে দিতে হয়?', 'সময় ও লেখার ধরন বেছে নিন, তারপর নিচের বক্সে ওপরের লেখাটি দেখে টাইপ শুরু করুন। প্রথম অক্ষর লিখলেই সময় চলা শুরু হয়। প্রতিটি শব্দ শেষে স্পেস চাপুন; শব্দ সঠিক হলে সবুজ, ভুল হলে লাল হবে। সময় শেষ হলে গতি ও নির্ভুলতা দেখাবে।'],
    ['কোন কিবোর্ড নির্বাচন করব: "নিজের কিবোর্ড" নাকি "অভ্র"?', 'আপনার কম্পিউটার বা ফোনে বাংলা (ইউনিকোড) কিবোর্ড চালু থাকলে "নিজের কিবোর্ড" বেছে নিন; তখন আপনি যা চাপবেন তাই লেখা হবে, কোনো রূপান্তর হবে না। ইংরেজি কিবোর্ডে ami লিখলে আমি পেতে চাইলে "অভ্র (ফোনেটিক)" বেছে নিন।'],
    ['"আ" লিখলে আগের শব্দের সাথে লেগে যাচ্ছে, কী করব?', 'প্রতিটি শব্দ শেষে স্পেস চাপলে নতুন শব্দ আলাদাভাবে শুরু হয়, তাই শব্দের শুরুতে a লিখলে স্বতন্ত্র "আ" আসে (যেমন: ami = আমি, amar = আমার)। এরপরও সমস্যা হলে "নিজের কিবোর্ড" বেছে নিয়ে আপনার ডিভাইসের বাংলা কিবোর্ড দিয়ে লিখুন।'],
    ['"উ" ও "আ" একসাথে লেগে যায়, আলাদা লিখব কীভাবে?', 'অভ্র ফোনেটিকের নিয়মে স্বরবর্ণের পর একটি a লিখলে "য়া" হয় (যেমন samia = সামিয়া)। তাই স্বতন্ত্র "আ" চাইলে দুইবার aa লিখুন, যেমন uaa = উআ। চাইলে মাঝে ব্যাকটিক ( ` ) দিয়েও আলাদা করা যায়: u`a = উআ।'],
    ['ইউনিকোড/ফোনেটিক নির্বাচন করলে সমস্যা হচ্ছে, কী করব?', 'সবচেয়ে সহজ উপায়: "নিজের কিবোর্ড" নির্বাচন করে আপনার কম্পিউটারের বা ফোনের বাংলা ইউনিকোড কিবোর্ড (যেমন Windows-এর Bangla, Gboard) দিয়ে লিখুন। এতে আমাদের কোনো রূপান্তর কাজ করে না, তাই অক্ষর ভাঙার ঝামেলা হয় না।'],
    ['একই লেখা বারবার আসছে কেন?', 'প্রতিবার লেখা এলোমেলোভাবে সাজানো হয় এবং আপনি যে অনুচ্ছেদগুলো আগে টাইপ করেছেন সেগুলো সব শেষে রাখা হয়। আরও বৈচিত্র্য চাইলে "এলোমেলো শব্দ" নির্বাচন করুন; সেখানে প্রতিবার আলাদা শব্দের সাজানো তালিকা আসে।'],
    ['টাইপিং স্পিড কীভাবে হিসাব করা হয়?', 'গতি = মিনিটে সঠিকভাবে টাইপ করা শব্দের সংখ্যা। নির্ভুলতা = সঠিক শব্দ ÷ (সঠিক + ভুল শব্দ) × ১০০। একটি শব্দে এক অক্ষর ভুল হলেও পুরো শব্দটি ভুল ধরা হয়।'],
    ['মোবাইলে কি টাইপিং টেস্ট দেওয়া যায়?', 'হ্যাঁ। মোবাইলে সাধারণত "নিজের কিবোর্ড" মোড আপনাআপনি নির্বাচিত হয়; ফোনের বাংলা কিবোর্ড (যেমন Gboard) চালু করে টাইপ করুন। কপি-পেস্ট বন্ধ থাকে যাতে ফলাফল সঠিক থাকে।']
  ];
  const sheet = [['আ','a / aa'],['অ','o'],['ই / ঈ','i / I (বা ii, ee)'],['উ / ঊ','u, oo / U, uu'],['ঋ','rri'],['এ','e'],['ঐ','OI'],['ও','O'],['ঔ','OU'],['ক খ গ ঘ ঙ','k kh g gh Ng'],['চ ছ জ ঝ ঞ','c ch j jh NG'],['ট ঠ ড ঢ ণ','T Th D Dh N'],['ত থ দ ধ ন','t th d dh n'],['প ফ ব ভ ম','p ph b bh m'],['য র ল','z r l'],['শ ষ স হ','sh Sh s h'],['ড় ঢ় য়','R Rh y (স্বরের পরে jay = জায়; জোর করে য় = Y)'],['ং ঁ ঃ ৎ','ng ^ : t``'],['স্বরের পর a','য়া হয় (samia = সামিয়া); আ চাইলে aa বা `'],['শব্দের শুরুতে y','ইয় (yahoo = ইয়াহু)'],['য-ফলা (্য)','y বা Z (যেমন kya = ক্যা, byobohar = ব্যবহার)'],['ব-ফলা (্ব)','w (যেমন swadhIn = স্বাধীন, bishwo = বিশ্ব)'],['ক্ষ / জ্ঞ','kkh / GG'],['আলাদা করা','` (যেমন u`a = উআ, uaa = উআ)'],['দাঁড়ি','. (ডট)']];
  const CSS = `.tt h1{color:var(--g);line-height:1.4;font-size:27px;margin:6px 0 8px}.tt .lead{margin:0 0 14px}
.tt-card{background:#fff;border:2px solid var(--g);border-radius:16px;padding:14px;box-shadow:0 5px 0 var(--g),0 14px 26px -10px rgba(6,78,59,.4);margin-bottom:26px}
.tt-opts{display:flex;flex-wrap:wrap;gap:10px 16px;align-items:center;margin-bottom:10px;font-size:15px}
.tt-opts label{display:flex;gap:6px;align-items:center}.tt select{font:inherit;font-size:15px;padding:5px 8px;border:1px solid #9ca3af;border-radius:8px;background:#fff}
.tt-bar{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:10px}.tt-bar div{background:var(--l);border-radius:10px;padding:6px 8px;text-align:center;font-size:13px;line-height:1.4}.tt-bar b{display:block;font-size:22px;color:var(--g)}
#tt-target{position:relative;box-sizing:border-box;height:calc(4*1.9em + 2px);overflow:hidden;border:1px solid #d1d5db;border-radius:10px;padding:0 12px;font-size:21px;line-height:1.9;background:#fafafa;scroll-behavior:smooth}
.w{padding:1px 3px;border-radius:5px}.w.cur{background:#fde68a;box-shadow:0 0 0 1px #f59e0b}.w.cur.err{background:#fecaca;box-shadow:0 0 0 1px #ef4444}.w.ok{background:#bbf7d0}.w.bad{background:#fecaca;color:#991b1b}
#tt-input{display:block;width:100%;height:120px;margin:10px 0;padding:10px 12px;border:2px solid #9ca3af;border-radius:10px;font:inherit;font-size:21px;line-height:1.7;resize:vertical}#tt-input:focus{outline:0;border-color:var(--g2);box-shadow:0 0 0 3px rgba(16,185,129,.3)}
.tt-btn{background:var(--g);color:#fff;border:0;border-radius:10px;padding:9px 18px;font:inherit;font-weight:600;cursor:pointer}.tt-btn.alt{background:#fff;color:var(--g);border:1.5px solid var(--g)}
#tt-res{background:var(--l);border:2px solid var(--g2);border-radius:14px;padding:14px;margin-top:12px}#tt-res h2{margin:0 0 8px;color:var(--g);font-size:20px}
.tt-rg{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:8px;margin:8px 0 12px}.tt-rg div{background:#fff;border-radius:10px;padding:8px;text-align:center;font-size:13px}.tt-rg b{display:block;font-size:24px;color:var(--g)}
.tt-sheet{border-collapse:collapse;width:100%;font-size:15px}.tt-sheet td{border:1px solid #d1d5db;padding:5px 10px}.tt-sheet td:last-child{font-family:ui-monospace,Consolas,monospace}
.tt details{border:1px solid #d1fae5;border-radius:8px;padding:8px 12px;margin:8px 0}.tt summary{cursor:pointer;font-weight:600}.tt h2{color:var(--g);font-size:21px;line-height:1.5;margin:26px 0 8px}
@media(max-width:560px){.tt h1{font-size:23px}#tt-target{font-size:18px}#tt-input{font-size:18px}.tt-bar b{font-size:19px}}`;
  const opts = (a) => a.map((x) => `<option value="${esc(x[0])}"${x[2] ? ' selected' : ''}>${esc(x[1])}</option>`).join('');
  const jsonData = JSON.stringify(data).replace(/</g, '\\u003c');
  const body = `<article class="tt">
<nav class="crumbs" aria-label="Breadcrumb" style="font-size:13.5px;color:#475569;margin:6px 0"><a href="/">হোম</a> › <span aria-current="page">বাংলা টাইপিং টেস্ট</span></nav>
<h1>বাংলা টাইপিং টেস্ট - অনলাইনে ফ্রি স্পিড ও নির্ভুলতা পরীক্ষা</h1>
<p class="lead">দেখে দেখে বাংলা টাইপ করুন, সময় শেষে আপনার গতি (শব্দ/মিনিট) ও নির্ভুলতা জেনে নিন। প্রতিবার নতুন লেখা, অভ্র ফোনেটিক ও নিজের কিবোর্ড - দুইভাবেই লেখা যাবে।</p>
<section class="tt-card" aria-label="টাইপিং টেস্ট">
<div class="tt-opts">
<label>সময়: <select id="tt-time"><option value="1">১ মিনিট</option><option value="2">২ মিনিট</option><option value="3">৩ মিনিট</option><option value="5" selected>৫ মিনিট</option><option value="10">১০ মিনিট</option></select></label>
<label>লেখা: <select id="tt-src"><option value="all">সব অনুচ্ছেদ</option>${cats.map((c) => `<option value="${esc(c)}">${esc(c)}</option>`).join('')}<option value="words">এলোমেলো শব্দ</option></select></label>
<span><label style="display:inline-flex;gap:5px;margin-right:12px"><input type="radio" name="tt-kb" value="native"> নিজের কিবোর্ড (ইউনিকোড)</label><label style="display:inline-flex;gap:5px"><input type="radio" name="tt-kb" value="phon" checked> অভ্র (ফোনেটিক)</label></span>
</div>
<p class="tt-hint" style="font-size:13.5px;color:#475569;margin:0 0 10px">অভ্র মোডে বড় হাতের অক্ষর (T, D, N, S, R ইত্যাদি) আলাদা বর্ণের জন্য। যুক্তবর্ণ আলাদা করতে o দিন (koksobajar = কক্সবাজার) আর চন্দ্রবিন্দুর জন্য ^ (ha^Ta = হাঁটা)।</p>
<div class="tt-bar" aria-live="off"><div><b id="tt-left">৫:০০</b>সময় বাকি</div><div><b id="tt-wpm">০</b>শব্দ/মিনিট</div><div><b id="tt-acc">১০০%</b>নির্ভুলতা</div><div><b id="tt-best">-</b>সেরা গতি</div></div>
<div id="tt-target" aria-label="টাইপ করার লেখা"><noscript>টাইপিং টেস্ট চালাতে JavaScript চালু করুন।</noscript></div>
<textarea id="tt-input" lang="bn" placeholder="এখানে টাইপ শুরু করুন..." autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" aria-label="টাইপ করার ঘর"></textarea>
<div style="display:flex;gap:10px;flex-wrap:wrap"><button type="button" class="tt-btn" id="tt-new">নতুন লেখা</button></div>
<div id="tt-res" hidden aria-live="polite"><h2>আপনার ফলাফল</h2><div class="tt-rg"><div><b id="tt-r-wpm">০</b>শব্দ/মিনিট</div><div><b id="tt-r-acc">০%</b>নির্ভুলতা</div><div><b id="tt-r-ok">০</b>সঠিক শব্দ</div><div><b id="tt-r-bad">০</b>ভুল শব্দ</div><div><b id="tt-r-cpm">০</b>অক্ষর/মিনিট</div></div><div style="display:flex;gap:10px;flex-wrap:wrap"><button type="button" class="tt-btn" id="tt-again">একই লেখা আবার</button><button type="button" class="tt-btn alt" id="tt-new2">নতুন লেখা দিয়ে চেষ্টা</button></div></div>
</section>
<details><summary>অভ্র ফোনেটিকের নিয়ম (ইংরেজি কিবোর্ডে বাংলা লেখা)</summary><table class="tt-sheet"><tbody>${sheet.map((r) => `<tr><td>${esc(r[0])}</td><td>${esc(r[1])}</td></tr>`).join('')}</tbody></table><p>বড় হাতের (Capital) অক্ষর ঠিক যেভাবে লেখা আছে সেভাবেই চাপুন। এটি অভ্র ফোনেটিকের নিয়মে কাজ করে, তবে OmicronLab-এর অভ্র কিবোর্ড সফটওয়্যারের অংশ নয়।</p><p>প্রতিটি শব্দ শেষে স্পেস চাপুন। যুক্তবর্ণ আলাদা করতে o বা ব্যাকটিক চিহ্ন ব্যবহার করুন। কিছু লিখে ভুল হলে ব্যাকস্পেস চেপে ঠিক করতে পারবেন; আগের শব্দ ভুল হলে ব্যাকস্পেস চেপে পেছনে গিয়ে ঠিক করুন; স্পেস মুছলেই শব্দটি আবার লেখা যাবে এবং আবার স্পেস দিলে নতুন করে মিলিয়ে দেখা হবে।</p></details>
<h2>বাংলা টাইপিং প্র্যাকটিস কেন দরকার</h2>
<p>অফিস, আবেদনপত্র, প্রতিবেদন ও অনলাইন কাজে দ্রুত ও নির্ভুল বাংলা টাইপ এখন প্রয়োজনীয় দক্ষতা। এই টেস্টে আপনি নিজের বর্তমান গতি মাপতে পারবেন এবং প্রতিদিন অল্প সময় অনুশীলন করে ধাপে ধাপে উন্নতি করতে পারবেন। যুক্তবর্ণ, দাঁড়ি ও সংখ্যাসহ নানা ধরনের লেখা থাকায় বাস্তব টাইপিংয়ের মতোই অনুশীলন হয়।</p>
<h2>টেস্টের নিয়ম</h2>
<ol><li>সময় ও লেখার ধরন (অনুচ্ছেদ বা এলোমেলো শব্দ) বেছে নিন।</li><li>কিবোর্ড মোড ঠিক করুন: নিজের কিবোর্ড অথবা অভ্র (ফোনেটিক)।</li><li>হলুদ চিহ্নিত শব্দটি দেখে টাইপ করুন, শব্দ শেষে স্পেস চাপুন।</li><li>ভুল হলে ব্যাকস্পেস চেপে আগের শব্দে ফিরে ঠিক করে নিন।</li><li>সময় শেষে গতি, নির্ভুলতা ও সঠিক-ভুল শব্দের হিসাব দেখুন।</li></ol>
<h2>সচরাচর জিজ্ঞাসা</h2>
<div class="faq">${FAQ.map((f) => `<details><summary>${esc(f[0])}</summary><p>${esc(f[1])}</p></details>`).join('')}</div>
<p style="margin-top:20px">আরও দেখুন: <a href="/ssc-gpa-calculator/">এসএসসি জিপিএ ক্যালকুলেটর</a> · <a href="/admission-calendar/">ভর্তি ক্যালেন্ডার</a> · <a href="/institutions/">শিক্ষাপ্রতিষ্ঠান ডিরেক্টরি</a></p>
<script type="application/json" id="tt-data">${jsonData}</script>
<script src="/assets/typing-test.js?v=20261128" defer></script>
</article>`;
  const schema = [
    { '@context': 'https://schema.org', '@type': 'WebApplication', name: 'বাংলা টাইপিং টেস্ট', url: U + URL_PATH, applicationCategory: 'EducationalApplication', operatingSystem: 'Any', inLanguage: 'bn-BD', isAccessibleForFree: true, offers: { '@type': 'Offer', price: '0', priceCurrency: 'BDT' }, description: DESC, publisher: ORG, dateModified: new Date().toISOString().slice(0, 10) },
    bc([['হোম', '/'], ['বাংলা টাইপিং টেস্ট', URL_PATH]]),
    { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: FAQ.map((f) => ({ '@type': 'Question', name: f[0], acceptedAnswer: { '@type': 'Answer', text: f[1] } })) }
  ];
  w(URL_PATH.slice(1) + 'index.html', layout({ title: TITLE, desc: DESC, p: URL_PATH, schema, head: '<style>' + CSS.replace(/\s*\n\s*/g, '') + '</style>', body }));
  return { path: URL_PATH };
};
