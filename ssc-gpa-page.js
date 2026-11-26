// ============================================================================
// ssc-gpa-page.js — SSC GPA calculator page (/ssc-gpa-calculator/)
// Built by build.js through the site's own layout(), so it gets the main
// navigation bar, search, sidebar, footer, canonical/OG tags and sitemap entry.
// ============================================================================
module.exports = function ({ w, layout, side, bc, U, S, ORG }) {
  const URL_PATH = '/ssc-gpa-calculator/';
  const TITLE = 'এসএসসি জিপিএ ক্যালকুলেটর – নম্বর বা গ্রেড দিয়ে GPA হিসাব | ' + S.name;
  const DESC = 'এসএসসি জিপিএ ক্যালকুলেটরে বিষয়ভিত্তিক নম্বর বা গ্রেড দিন, ৪র্থ বিষয়সহ GPA ও লেটার গ্রেড সঙ্গে সঙ্গে জানুন। নিয়ম, গ্রেড টেবিল ও উদাহরণ সহ।';
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  const FAQ = [
    ['এসএসসি জিপিএ কীভাবে হিসাব করা হয়?', 'প্রতিটি মূল বিষয়ের গ্রেড পয়েন্ট যোগ করুন, ৪র্থ বিষয়ের ২.০০-এর বেশি অংশ যোগ করুন, তারপর মূল বিষয়ের সংখ্যা দিয়ে ভাগ করুন। সর্বোচ্চ জিপিএ ৫.০০।'],
    ['৪র্থ বিষয়ের নম্বর জিপিএতে কীভাবে যোগ হয়?', '৪র্থ বিষয়ের গ্রেড পয়েন্ট থেকে ২ বাদ দিয়ে যা থাকে (শূন্যের কম হলে শূন্য) তা মোট পয়েন্টে যোগ হয়। ভাগ করা হয় ৪র্থ বিষয় বাদে মূল বিষয়ের সংখ্যা দিয়ে।'],
    ['কত নম্বরে A+ পাওয়া যায়?', 'প্রতিটি বিষয়ে ৮০ থেকে ১০০ নম্বর পেলে A+ এবং গ্রেড পয়েন্ট ৫.০০ হয়।'],
    ['একটি বিষয়ে ফেল করলে কি জিপিএ হবে?', 'না। কোনো মূল বিষয়ে ৩৩-এর নিচে নম্বর (গ্রেড F) পেলে ফল অকৃতকার্য ধরা হয় এবং জিপিএ ০.০০ হয়। ৪র্থ বিষয়ে F পেলে শুধু বাড়তি পয়েন্ট পাওয়া যায় না।'],
    ['নম্বর না জেনে শুধু গ্রেড দিয়ে কি জিপিএ বের করা যায়?', 'হ্যাঁ। ক্যালকুলেটরে গ্রেড বেছে নেওয়া অপশনে প্রতিটি বিষয়ের লেটার গ্রেড (A+, A, A- ইত্যাদি) বেছে নিলেই জিপিএ দেখা যাবে।'],
    ['এই ক্যালকুলেটরের ফলাফল কি চূড়ান্ত?', 'না। এটি আনুমানিক হিসাব। চূড়ান্ত ফল শিক্ষা বোর্ডের প্রকাশিত ফলাফলই।']
  ];

  const CSS = `
.gpa{--gg:#064e3b;--gg2:#0f9f6e;--gs:#e8f7ef;--gl:#c3e0d0;--gm:#456457;--gbad:#b91c1c;--gbadbg:#fdecec;min-width:0;font-family:"Noto Sans Bengali","Hind Siliguri","Segoe UI",system-ui,sans-serif;font-size:17px;line-height:1.75;font-variant-numeric:lining-nums}
.gpa h1{margin:6px 0 8px}
.gpa .lead{color:var(--gm);margin:0 0 16px}
.gpa h2{font-size:21px;line-height:1.5;margin:0 0 10px;color:var(--gg);border:0;padding:0}
.gpa .box{background:#fff;border:1px solid var(--gl);border-radius:14px;padding:16px;margin-bottom:16px}
.gpa .lbl{display:block;font-weight:600;font-size:15px;margin-bottom:6px}
.gpa select,.gpa input[type=text],.gpa input[type=number]{font:inherit;font-size:16px;color:#0b2a20;background:#fff;border:1.5px solid var(--gl);border-radius:10px;padding:10px 12px;width:100%;min-width:0;min-height:46px;margin:0;box-shadow:none}
.gpa select:focus-visible,.gpa input:focus-visible,.gpa button:focus-visible,.gpa summary:focus-visible{outline:3px solid var(--gg2);outline-offset:2px}
.gpa .seg{display:grid;grid-template-columns:1fr 1fr;gap:6px;background:var(--gs);padding:5px;border-radius:12px;margin:6px 0 4px}
.gpa .seg input{position:absolute;opacity:0;pointer-events:none}
.gpa .seg label{text-align:center;padding:10px 6px;border-radius:9px;font-weight:600;cursor:pointer;color:var(--gm);line-height:1.3}
.gpa .seg input:checked+label{background:var(--gg);color:#fff}
.gpa .seg input:focus-visible+label{outline:3px solid var(--gg2);outline-offset:2px}
.gpa .hint{font-size:14px;color:var(--gm);margin:8px 0 0}
.gpa .rows{display:grid;gap:10px;margin-top:12px}
.gpa .row{display:grid;grid-template-columns:1fr 150px 84px;gap:8px;align-items:center}
.gpa .row .nm{border-color:transparent;background:transparent;padding-left:0;font-weight:600}
.gpa .row .nm:focus{border-color:var(--gl);background:#fff;padding-left:12px}
.gpa .mk,.gpa .gs{display:none}
.gpa .mode-m .mk,.gpa .mode-g .gs{display:block}
.gpa .chip{text-align:center;border-radius:10px;padding:6px 4px;background:var(--gs);font-weight:700;font-size:18px;color:var(--gg);min-height:46px;line-height:1.2;display:flex;flex-direction:column;justify-content:center}
.gpa .chip small{font-weight:500;font-size:12px;color:var(--gm)}
.gpa .chip.f{background:var(--gbadbg);color:var(--gbad)}
.gpa .fourth{margin-top:18px;padding-top:14px;border-top:2px dashed var(--gl)}
.gpa .btns{display:flex;gap:10px;flex-wrap:wrap;margin-top:16px}
.gpa button{font:inherit;font-weight:600;border-radius:10px;padding:11px 16px;min-height:46px;border:1.5px solid var(--gl);background:#fff;color:var(--gg);cursor:pointer}
.gpa .result{text-align:center;padding:22px 14px;border:2px solid var(--gg);background:#fff;border-radius:14px;margin-bottom:16px}
.gpa .result .big{font-size:64px;font-weight:700;line-height:1.1;color:var(--gg)}
.gpa .result .gl{display:inline-block;margin:6px 0;padding:2px 18px;border-radius:999px;background:var(--gg);color:#fff;font-weight:700;font-size:22px}
.gpa .result.bad{border-color:var(--gbad)}.gpa .result.bad .big{color:var(--gbad)}.gpa .result.bad .gl{background:var(--gbad)}
.gpa .result p{margin:4px 0;color:var(--gm)}
.gpa .stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:8px;margin-top:12px}
.gpa .stats div{background:var(--gs);border-radius:10px;padding:8px 4px}
.gpa .stats b{display:block;font-size:20px;color:var(--gg)}.gpa .stats span{font-size:13px;color:var(--gm)}
.gpa .tw{overflow-x:auto}
.gpa table{width:100%;border-collapse:collapse;margin:0}
.gpa th,.gpa td{border:1px solid var(--gl);padding:8px 10px;text-align:center}
.gpa th{background:var(--gs);color:var(--gg)}
.gpa caption{text-align:left;font-weight:600;padding:0 0 6px}
.gpa .art p,.gpa .art li{margin:0 0 10px}
.gpa .art ul{padding-left:22px;margin:0 0 10px}
.gpa .ex{background:var(--gs);border-radius:10px;padding:12px 14px;margin:10px 0}
.gpa details{border-bottom:1px solid var(--gl);padding:10px 0}
.gpa summary{font-weight:600;cursor:pointer;line-height:1.5}
.gpa details p{margin:8px 0 0;color:var(--gm)}
@media(max-width:560px){
  .gpa{font-size:16.5px}
  .gpa .row{grid-template-columns:1fr 84px;gap:6px}
  .gpa .row .nm{grid-column:1/-1;padding-bottom:0;min-height:30px}
  .gpa .result .big{font-size:54px}
}`;

  const JS = String.raw`
(function(){
  var GR=[[80,'A+',5],[70,'A',4],[60,'A-',3.5],[50,'B',3],[40,'C',2],[33,'D',1],[0,'F',0]];
  var PT={'A+':5,'A':4,'A-':3.5,'B':3,'C':2,'D':1,'F':0};
  var G={
    sci:['বাংলা','ইংরেজি','গণিত','ইসলাম ও নৈতিক শিক্ষা','তথ্য ও যোগাযোগ প্রযুক্তি','পদার্থবিজ্ঞান','রসায়ন','জীববিজ্ঞান','বাংলাদেশ ও বিশ্বপরিচয়'],
    bus:['বাংলা','ইংরেজি','গণিত','ইসলাম ও নৈতিক শিক্ষা','তথ্য ও যোগাযোগ প্রযুক্তি','হিসাববিজ্ঞান','ফিন্যান্স ও ব্যাংকিং','ব্যবসায় উদ্যোগ','বাংলাদেশ ও বিশ্বপরিচয়'],
    hum:['বাংলা','ইংরেজি','গণিত','ইসলাম ও নৈতিক শিক্ষা','তথ্য ও যোগাযোগ প্রযুক্তি','ভূগোল ও পরিবেশ','অর্থনীতি','পৌরনীতি ও নাগরিকতা','বাংলাদেশ ও বিশ্বপরিচয়']
  };
  var FOURTH={sci:'উচ্চতর গণিত',bus:'৪র্থ বিষয়',hum:'৪র্থ বিষয়'};
  var tool=document.getElementById('gpa-tool'),rowsEl=document.getElementById('gpa-rows'),fourthEl=document.getElementById('gpa-fourth'),resEl=document.getElementById('gpa-result'),grp=document.getElementById('gpa-grp'),hint=document.getElementById('gpa-hint');
  if(!tool)return;
  var mode='m';
  function esc(s){return String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;')}
  function grade(m){for(var i=0;i<GR.length;i++)if(m>=GR[i][0])return GR[i]}
  function letterOf(g){return g>=5?'A+':g>=4?'A':g>=3.5?'A-':g>=3?'B':g>=2?'C':g>=1?'D':'F'}
  function rowHtml(name){
    var opts='<option value="">গ্রেড বেছে নিন</option>';
    ['A+','A','A-','B','C','D','F'].forEach(function(l){opts+='<option value="'+l+'">'+l+' ('+PT[l].toFixed(2)+')</option>'});
    return '<input class="nm" type="text" value="'+esc(name)+'" aria-label="বিষয়ের নাম">'+
      '<input class="mk" type="number" inputmode="numeric" min="0" max="100" placeholder="নম্বর (0–100)" aria-label="নম্বর">'+
      '<select class="gs" aria-label="গ্রেড">'+opts+'</select>'+
      '<div class="chip" data-chip>–</div>';
  }
  function addRow(name){var d=document.createElement('div');d.className='row';d.innerHTML=rowHtml(name||'নতুন বিষয়');rowsEl.appendChild(d)}
  function build(){rowsEl.innerHTML='';G[grp.value].forEach(addRow);fourthEl.innerHTML=rowHtml(FOURTH[grp.value]);calc()}
  function read(r){
    if(mode==='m'){
      var v=r.querySelector('.mk').value.trim();if(v==='')return null;
      var n=Math.round(Number(v));if(isNaN(n))return null;n=Math.max(0,Math.min(100,n));
      var g=grade(n);return {pt:g[2],l:g[1],marks:n};
    }
    var s=r.querySelector('.gs').value;if(!s)return null;
    return {pt:PT[s],l:s,marks:null};
  }
  function paint(r,x){
    var c=r.querySelector('[data-chip]');
    if(!x){c.className='chip';c.textContent='–';return}
    c.className='chip'+(x.l==='F'?' f':'');c.innerHTML=x.l+'<small>'+x.pt.toFixed(2)+'</small>';
  }
  function calc(){
    var rows=[].slice.call(rowsEl.children),n=rows.length,filled=0,total=0,fail=0,marks=0;
    rows.forEach(function(r){var x=read(r);paint(r,x);if(x){filled++;total+=x.pt;if(x.l==='F')fail++;if(x.marks!==null)marks+=x.marks}});
    var f=read(fourthEl);paint(fourthEl,f);
    var bonus=f?Math.max(0,f.pt-2):0;if(f&&f.marks!==null)marks+=f.marks;
    if(!n){resEl.className='result';resEl.innerHTML='<p>কমপক্ষে একটি বিষয় যোগ করুন।</p>';return}
    if(filled<n){resEl.className='result';resEl.innerHTML='<p>আর '+(n-filled)+'টি বিষয়ের '+(mode==='m'?'নম্বর':'গ্রেড')+' দিলেই জিপিএ দেখা যাবে।</p>';return}
    var gpa=fail?0:Math.min(5,(total+bonus)/n),L=fail?'F':letterOf(gpa);
    resEl.className='result'+(fail?' bad':'');
    resEl.innerHTML='<p>আপনার জিপিএ</p><div class="big">'+gpa.toFixed(2)+'</div><div class="gl">'+L+'</div>'+
      (fail?'<p>'+fail+'টি মূল বিষয়ে F থাকায় ফল অকৃতকার্য।</p>':'<p>ফল: উত্তীর্ণ</p>')+
      '<div class="stats">'+(mode==='m'?'<div><b>'+marks+'</b><span>মোট নম্বর</span></div>':'')+
      '<div><b>'+total.toFixed(2)+'</b><span>মূল বিষয়ের পয়েন্ট</span></div><div><b>'+bonus.toFixed(2)+'</b><span>৪র্থ বিষয়ের বাড়তি</span></div></div>';
  }
  function setMode(m){
    mode=m;tool.className='box mode-'+m;
    hint.textContent=m==='m'?'প্রতিটি বিষয়ে ১০০ নম্বরের মধ্যে প্রাপ্ত নম্বর লিখুন।':'নম্বর জানা না থাকলে প্রতিটি বিষয়ের লেটার গ্রেড বেছে নিন।';
    calc();
  }
  tool.addEventListener('input',function(e){if(e.target.classList.contains('mk'))calc()});
  tool.addEventListener('change',function(e){if(e.target.classList.contains('gs'))calc()});
  [].forEach.call(tool.querySelectorAll('input[name=gpa-mode]'),function(i){i.addEventListener('change',function(){setMode(i.value)})});
  grp.addEventListener('change',build);
  document.getElementById('gpa-add').addEventListener('click',function(){addRow();calc()});
  document.getElementById('gpa-reset').addEventListener('click',build);
  build();
})();`;

  const gradeRows = [['80–100', 'A+', '5.00'], ['70–79', 'A', '4.00'], ['60–69', 'A-', '3.50'], ['50–59', 'B', '3.00'], ['40–49', 'C', '2.00'], ['33–39', 'D', '1.00'], ['0–32', 'F', '0.00']];
  const finalRows = [['5.00', 'A+'], ['4.00 – 4.99', 'A'], ['3.50 – 3.99', 'A-'], ['3.00 – 3.49', 'B'], ['2.00 – 2.99', 'C'], ['1.00 – 1.99', 'D'], ['1.00-এর কম', 'F']];

  const body = `
<div class="grid"><article class="gpa">
  <h1>এসএসসি জিপিএ ক্যালকুলেটর</h1>
  <p class="lead">প্রতিটি বিষয়ের নম্বর অথবা গ্রেড দিন। ৪র্থ বিষয়সহ GPA ও লেটার গ্রেড সঙ্গে সঙ্গে দেখুন।</p>

  <section class="box mode-m" id="gpa-tool" aria-label="জিপিএ ক্যালকুলেটর">
    <label class="lbl" for="gpa-grp">বিভাগ</label>
    <select id="gpa-grp">
      <option value="sci">বিজ্ঞান</option>
      <option value="bus">ব্যবসায় শিক্ষা</option>
      <option value="hum">মানবিক</option>
    </select>
    <div class="lbl" style="margin-top:14px" id="gpa-modelbl">কীভাবে দিতে চান?</div>
    <div class="seg" role="radiogroup" aria-labelledby="gpa-modelbl">
      <input type="radio" name="gpa-mode" id="gpa-mm" value="m" checked><label for="gpa-mm">নম্বর দিয়ে</label>
      <input type="radio" name="gpa-mode" id="gpa-mg" value="g"><label for="gpa-mg">গ্রেড বেছে নিয়ে</label>
    </div>
    <p class="hint" id="gpa-hint">প্রতিটি বিষয়ে ১০০ নম্বরের মধ্যে প্রাপ্ত নম্বর লিখুন।</p>
    <div class="rows" id="gpa-rows"></div>
    <div class="fourth">
      <div class="lbl">৪র্থ বিষয় (না থাকলে খালি রাখুন)</div>
      <div class="row" id="gpa-fourth"></div>
    </div>
    <div class="btns">
      <button type="button" id="gpa-add">+ বিষয় যোগ করুন</button>
      <button type="button" id="gpa-reset">সব মুছে নতুন করে শুরু</button>
    </div>
  </section>

  <section class="result" id="gpa-result" aria-live="polite"></section>
  <noscript><p>জিপিএ হিসাব করতে JavaScript চালু থাকতে হবে।</p></noscript>

  <section class="box art">
    <h2>এসএসসি জিপিএ হিসাবের নিয়ম</h2>
    <p>এসএসসিতে প্রতিটি বিষয়ের নম্বরের জন্য একটি লেটার গ্রেড ও গ্রেড পয়েন্ট থাকে। সব বিষয়ের পয়েন্ট মিলিয়ে চূড়ান্ত জিপিএ বের হয়।</p>
    <div class="tw"><table><caption>নম্বর, লেটার গ্রেড ও গ্রেড পয়েন্ট</caption>
      <tr><th>নম্বর</th><th>গ্রেড</th><th>পয়েন্ট</th></tr>
      ${gradeRows.map((r) => `<tr><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td></tr>`).join('')}
    </table></div>
    <h2 style="margin-top:18px">জিপিএ বের করার সূত্র</h2>
    <p><strong>জিপিএ = (মূল বিষয়ের পয়েন্টের যোগফল + ৪র্থ বিষয়ের বাড়তি পয়েন্ট) ÷ মূল বিষয়ের সংখ্যা</strong></p>
    <ul>
      <li>৪র্থ বিষয়ের বাড়তি পয়েন্ট = ৪র্থ বিষয়ের গ্রেড পয়েন্ট − 2 (ঋণাত্মক হলে 0)।</li>
      <li>জিপিএ কখনো 5.00-এর বেশি হয় না।</li>
      <li>কোনো মূল বিষয়ে F পেলে জিপিএ 0.00 হয় ও ফল অকৃতকার্য ধরা হয়।</li>
    </ul>
    <div class="ex"><strong>উদাহরণ:</strong> ৯টি মূল বিষয়ের মধ্যে ৭টিতে A+ (৭×5 = 35) ও ২টিতে A (২×4 = 8), মোট 43। ৪র্থ বিষয়ে A+ পেলে বাড়তি 5 − 2 = 3। জিপিএ = (43 + 3) ÷ 9 = 5.11, তাই সর্বোচ্চ সীমা অনুযায়ী 5.00।</div>
    <h2 style="margin-top:18px">জিপিএ অনুযায়ী ফাইনাল গ্রেড</h2>
    <div class="tw"><table>
      <tr><th>জিপিএ</th><th>গ্রেড</th></tr>
      ${finalRows.map((r) => `<tr><td>${r[0]}</td><td>${r[1]}</td></tr>`).join('')}
    </table></div>
    <p style="margin-top:12px">এইচএসসি বা অনার্স সিজিপিএ হিসাবের নিয়ম জানতে পড়ুন <a href="/gpa-calculator-bangladesh-ssc-hsc-honours-gpa-hishab-niyom/">জিপিএ ও সিজিপিএ হিসাবের গাইড</a>।</p>
  </section>

  <section class="box" aria-labelledby="gpa-faqh">
    <h2 id="gpa-faqh">সাধারণ প্রশ্ন</h2>
    ${FAQ.map((f) => `<details><summary>${esc(f[0])}</summary><p>${esc(f[1])}</p></details>`).join('')}
  </section>
</article>${side()}</div>
<script>${JS}</script>`;

  const schema = [
    {
      '@context': 'https://schema.org', '@type': 'WebApplication', name: 'এসএসসি জিপিএ ক্যালকুলেটর',
      url: U + URL_PATH, applicationCategory: 'EducationalApplication', operatingSystem: 'Any', inLanguage: 'bn-BD',
      isAccessibleForFree: true, offers: { '@type': 'Offer', price: '0', priceCurrency: 'BDT' },
      description: 'বিষয়ভিত্তিক নম্বর বা গ্রেড দিয়ে ৪র্থ বিষয়সহ এসএসসি জিপিএ হিসাবের ফ্রি টুল।', publisher: ORG,
      dateModified: new Date().toISOString().slice(0, 10)
    },
    bc([['হোম', '/'], ['এসএসসি জিপিএ ক্যালকুলেটর', URL_PATH]]),
    {
      '@context': 'https://schema.org', '@type': 'FAQPage',
      mainEntity: FAQ.map((f) => ({ '@type': 'Question', name: f[0], acceptedAnswer: { '@type': 'Answer', text: f[1] } }))
    }
  ];

  const head = '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' +
    '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+Bengali:wght@400;500;600;700&display=swap">' +
    '<style>' + CSS.replace(/\s*\n\s*/g, '') + '</style>';

  w(URL_PATH.slice(1) + 'index.html', layout({ title: TITLE, desc: DESC, p: URL_PATH, schema, head, body }));
  return { path: URL_PATH };
};
