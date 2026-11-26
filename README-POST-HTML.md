# পোস্টে HTML ব্যবহার (CMS → Posts → Body)

Body-তে **Markdown ও HTML একসাথে** লেখা যায়। সাইটে যেমন লিখবেন তেমনই আসবে, CMS-এর ডান পাশের প্রিভিউতেও লাইভ দেখাবে।

## নিয়ম
1. Body সবসময় **Raw মোডে** রাখুন (ডিফল্ট)। HTML থাকলে **Rich Text মোডে যাবেন না** — ওখানে HTML বদলে/মুছে যেতে পারে।
2. HTML ব্লকের আগে-পরে **একটা ফাঁকা লাইন** দিন।
3. HTML ব্লকের ভেতরে Markdown (`**bold**`, `-` লিস্ট) কাজ করে না — ভেতরে HTML ট্যাগ (`<strong>`, `<li>`) ব্যবহার করুন।

## কপি-পেস্ট স্নিপেট

**ডাউনলোড বাটন**
```html
<div class="dl-wrap">
<a class="dl-btn" href="PDF_এর_লিংক" target="_blank" rel="noopener">📥 Class 8 Math Book PDF ডাউনলোড</a>
</div>
```

**নোট / সতর্কতা / টিপ বক্স** (`note` = সবুজ, `warn` = হলুদ, `tip` = নীল)
```html
<div class="note"><strong>নোট:</strong> এখানে লিখুন।</div>
<div class="warn"><strong>সতর্কতা:</strong> এখানে লিখুন।</div>
```

**PDF পেজে এম্বেড**
```html
<iframe class="pdf-embed" src="PDF_এর_লিংক" title="Class 8 Math Book"></iframe>
```

**ভাঁজ হওয়া প্রশ্ন-উত্তর**
```html
<details><summary>প্রশ্ন?</summary>উত্তর এখানে।</details>
```

টেবিল, লিংক (`<a href>`), ছবি (`<img src="/uploads/x.webp" alt="...">`) — সব সাধারণ HTML চলে।

## CMS ভার্সন
`admin/cms.html`-এ Decap CMS এখন **3.1.3-তে পিন করা**। আগে `^3.0.0` ছিল, ফলে unpkg নিজে নিজেই নতুন ভার্সন দিয়ে দিত এবং এডিটর/প্রিভিউ হঠাৎ বদলে যেত। ভার্সন বদলাতে চাইলে শুধু ওই নম্বরটা হাতে বদলান।
