(function(){
var btn=document.getElementById('adm-pdf-btn'),dEl=document.getElementById('adm-cal');
if(!btn||!dEl)return;
var D;try{D=JSON.parse(dEl.textContent)}catch(e){btn.style.display='none';return}
var DIG='০১২৩৪৫৬৭৮৯';
var MN=['জানুয়ারি','ফেব্রুয়ারি','মার্চ','এপ্রিল','মে','জুন','জুলাই','আগস্ট','সেপ্টেম্বর','অক্টোবর','নভেম্বর','ডিসেম্বর'];
var WD=['রবি','সোম','মঙ্গল','বুধ','বৃহস্পতি','শুক্র','শনি'];
var FONT='"Noto Sans Bengali","Hind Siliguri","Kalpurush","Nirmala UI","Vrinda",system-ui,-apple-system,"Segoe UI",sans-serif';
var W=794,H=1123,S=2,PAD=24,PW=595.28,PH=841.89;
function bn(v){return String(v).replace(/[0-9]/g,function(d){return DIG.charAt(d)})}
function rr(c,x,y,w,h,r){c.beginPath();c.moveTo(x+r,y);c.arcTo(x+w,y,x+w,y+h,r);c.arcTo(x+w,y+h,x,y+h,r);c.arcTo(x,y+h,x,y,r);c.arcTo(x,y,x+w,y,r);c.closePath()}
function fit(c,t,w){if(c.measureText(t).width<=w)return t;while(t.length>1&&c.measureText(t+'…').width>w)t=t.slice(0,-1);return t+'…'}
function wrap(c,t,w){
  var words=String(t).split(' '),lines=[],cur='';
  function brk(x){
    while(x.length>1&&c.measureText(x).width>w){
      var k=x.length;while(k>1&&c.measureText(x.slice(0,k)).width>w)k--;
      var h=x.slice(0,k).lastIndexOf('-');if(h>2)k=h+1;
      lines.push(x.slice(0,k));x=x.slice(k);
    }
    return x;
  }
  words.forEach(function(x){
    var test=cur?cur+' '+x:x;
    if(!cur||c.measureText(test).width<=w)cur=test;else{lines.push(cur);cur=x}
    if(c.measureText(cur).width>w)cur=brk(cur);
  });
  if(cur)lines.push(cur);
  return lines;
}
var PAL=['#0f766e','#1d4ed8','#7e22ce','#b45309','#be123c','#047857','#334155','#0369a1'];
function pal(t){var w=String(t).split(' ')[0],h=0;for(var i=0;i<w.length;i++)h=(h*31+w.charCodeAt(i))%997;return PAL[h%PAL.length]}
function pageCanvas(keys,months,pg,pgs){
  var cv=document.createElement('canvas');cv.width=W*S;cv.height=H*S;
  var c=cv.getContext('2d');c.scale(S,S);
  c.fillStyle='#fff';c.fillRect(0,0,W,H);
  var HB=54;
  c.fillStyle='#064e3b';rr(c,PAD,PAD,W-2*PAD,HB,9);c.fill();
  c.textAlign='left';c.fillStyle='#fff';c.font='700 17px '+FONT;c.fillText(D.meta.title,PAD+14,PAD+24);
  c.fillStyle='#a7f3d0';c.font='400 10.5px '+FONT;c.fillText(D.meta.host,PAD+14,PAD+42);
  var f0=keys[0],f1=keys[keys.length-1];
  c.textAlign='right';c.fillStyle='#fff';c.font='700 14px '+FONT;
  c.fillText(MN[+f0.slice(5,7)-1]+' '+bn(f0.slice(0,4))+(f1!==f0?' – '+MN[+f1.slice(5,7)-1]+' '+bn(f1.slice(0,4)):''),W-PAD-14,PAD+33);
  var GAP=14,BG=10,colW=(W-2*PAD-GAP)/2,cw=colW/7,top=PAD+HB+10,bottom=H-PAD-38,avail=bottom-top;
  var WKS=['র','সো','ম','বু','বৃ','শু','শ'];
  var blocks=keys.map(function(k){
    var y=+k.slice(0,4),m=+k.slice(5,7)-1,by={};
    months[k].forEach(function(e){var d=+e.d.slice(8);(by[d]=by[d]||[]).push(e)});
    var off=new Date(Date.UTC(y,m,1)).getUTCDay(),dim=new Date(Date.UTC(y,m+1,0)).getUTCDate();
    return {y:y,m:m,by:by,off:off,dim:dim,rows:Math.ceil((off+dim)/7)};
  });
  var cols=[[],[]];blocks.forEach(function(b,i){cols[i%2].push(b)});
  var keyItems=D.k||[],tba=D.tb||[];
  function label(e){return e.n.replace(/[()]/g,'')+(e.c?'':'*')}
  function measure(sz){
    var lh=sz+1.6,dayFs=sz+1.5,kfs=Math.max(6,Math.min(9.5,sz));
    c.font='600 '+sz+'px '+FONT;
    blocks.forEach(function(b){
      b.cells={};b.rh=[];b.h=(sz+10)+(sz+6);
      for(var r=0;r<b.rows;r++){
        var need=dayFs+7;
        for(var col=0;col<7;col++){
          var d=r*7+col-b.off+1;if(d<1||d>b.dim)continue;
          var ls=[];
          (b.by[d]||[]).forEach(function(e){wrap(c,label(e),cw-5).forEach(function(l){ls.push({t:l,col:pal(e.n)})})});
          b.cells[d]=ls;
          var h=dayFs+4+(ls.length?ls.length*lh+2:0);if(h>need)need=h;
        }
        b.rh.push(need);b.h+=need;
      }
    });
    var key={h:0,kfs:kfs,notes:[]};
    if(keyItems.length||tba.length){
      c.font='500 '+kfs+'px '+FONT;
      key.notes=wrap(c,'* চিহ্নিত তারিখ কর্তৃপক্ষ সম্ভাব্য হিসেবে জানিয়েছে। পরীক্ষার সময় ও বিস্তারিত ওয়েবসাইটে দেখুন।',colW-10);
      if(tba.length)key.notes=key.notes.concat(wrap(c,'তারিখ ঘোষণার অপেক্ষায়: '+tba.join(', '),colW-10));
      key.h=kfs+12+keyItems.length*(kfs+3.6)+4+key.notes.length*(kfs+3)+8;
    }
    var heights=cols.map(function(cl,i){var t=0;cl.forEach(function(b){t+=b.h});t+=BG*Math.max(0,cl.length-1);if(i===1&&key.h)t+=BG+key.h;return t});
    return {sz:sz,lh:lh,dayFs:dayFs,key:key,heights:heights,max:Math.max(heights[0],heights[1])};
  }
  var L,sz=10.5;
  for(;sz>=4.75;sz-=.25){L=measure(sz);if(L.max<=avail)break}
  if(sz<4.75)L=measure(4.75);
  function drawBlock(b,x,y){
    var sz=L.sz,lh=L.lh,dayFs=L.dayFs,tH=sz+10;
    c.fillStyle='#ecfdf5';rr(c,x,y,colW,tH,4);c.fill();
    c.textAlign='left';c.fillStyle='#064e3b';c.font='700 '+(sz+3)+'px '+FONT;
    c.fillText(MN[b.m]+' '+bn(b.y),x+6,y+tH-4.5);
    var wy=y+tH;
    c.textAlign='center';c.fillStyle='#64748b';c.font='700 '+(sz-.5)+'px '+FONT;
    for(var i=0;i<7;i++)c.fillText(WKS[i],x+cw*i+cw/2,wy+sz+2);
    var gy=wy+sz+6;
    for(var r=0;r<b.rows;r++){
      var rh=b.rh[r];
      for(var col=0;col<7;col++){
        var d=r*7+col-b.off+1,cx=x+cw*col,inM=d>=1&&d<=b.dim,ls=inM?(b.cells[d]||[]):[];
        c.fillStyle=!inM?'#fafafa':(ls.length?'#f0fdf6':(col>=5?'#f8faf9':'#fff'));c.fillRect(cx,gy,cw,rh);
        c.strokeStyle='#d5e9df';c.lineWidth=.6;c.strokeRect(cx+.3,gy+.3,cw-.6,rh-.6);
        if(!inM)continue;
        c.textAlign='left';c.font='700 '+dayFs+'px '+FONT;c.fillStyle=col===5?'#b91c1c':'#0f172a';
        c.fillText(bn(d),cx+3,gy+dayFs+0.5);
        c.font='600 '+sz+'px '+FONT;
        var ty=gy+dayFs+4;
        ls.forEach(function(l,k){c.fillStyle=l.col;c.fillText(l.t,cx+3,ty+(k+1)*lh-1.5)});
      }
      gy+=rh;
    }
  }
  cols.forEach(function(cl,ci){
    var rowsN=0;cl.forEach(function(b){rowsN+=b.rows});
    var free=avail-L.heights[ci],add=rowsN?Math.max(0,Math.min(14,free/rowsN)):0;
    cl.forEach(function(b){b.rh=b.rh.map(function(h){return h+add});b.h+=add*b.rows});
    var x=PAD+ci*(colW+GAP),y=top;
    cl.forEach(function(b){drawBlock(b,x,y);y+=b.h+BG});
    if(ci===1&&L.key.h){
      var K=L.key,kf=K.kfs;
      c.fillStyle='#fff';c.strokeStyle='#bfe9d3';c.lineWidth=.8;rr(c,x+.4,y+.4,colW-.8,K.h-.8,5);c.fill();c.stroke();
      c.textAlign='left';c.fillStyle='#064e3b';c.font='700 '+(kf+2)+'px '+FONT;c.fillText('সংক্ষিপ্ত রূপ ও নোট',x+6,y+kf+5);
      c.font='500 '+kf+'px '+FONT;
      keyItems.forEach(function(it,i){
        c.fillStyle='#0f172a';c.fillText(fit(c,it[0]+' = '+it[1],colW-12),x+6,y+kf+16+i*(kf+3.6));
      });
      var ny=y+kf+12+keyItems.length*(kf+3.6)+4;
      c.fillStyle='#475569';
      K.notes.forEach(function(l,i){c.fillText(l,x+6,ny+(i+1)*(kf+3)-1)});
    }
  });
  var fy=H-PAD-30;
  c.fillStyle='#e2e8f0';c.fillRect(PAD,fy,W-2*PAD,1);
  c.textAlign='center';c.fillStyle='#64748b';c.font='400 8.5px '+FONT;
  c.fillText('তথ্য বিভিন্ন সূত্র থেকে সংকলিত; আবেদনের আগে অফিসিয়াল সার্কুলার যাচাই করুন।',W/2,fy+13);
  c.fillText('হালনাগাদ: '+D.meta.upd+'  ·  '+D.meta.host+(pgs>1?'  ·  পৃষ্ঠা '+bn(pg)+'/'+bn(pgs):''),W/2,fy+25);
  return cv;
}
function buildPdf(imgs,pw,ph){
  var enc=new TextEncoder(),parts=[],pos=0,offs=[0];
  function add(x){var b=typeof x==='string'?enc.encode(x):x;parts.push(b);pos+=b.length}
  function mark(n){offs[n]=pos}
  var n=imgs.length,kids=[];
  for(var i=0;i<n;i++)kids.push((3+i*3)+' 0 R');
  add('%PDF-1.4\n%\u00e2\u00e3\u00cf\u00d3\n');
  mark(1);add('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
  mark(2);add('2 0 obj\n<< /Type /Pages /Count '+n+' /Kids ['+kids.join(' ')+'] >>\nendobj\n');
  for(i=0;i<n;i++){
    var p=3+i*3,ct=p+1,im=p+2,cs='q '+PW+' 0 0 '+PH+' 0 0 cm /Im0 Do Q';
    mark(p);add(p+' 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 '+PW+' '+PH+'] /Resources << /XObject << /Im0 '+im+' 0 R >> >> /Contents '+ct+' 0 R >>\nendobj\n');
    mark(ct);add(ct+' 0 obj\n<< /Length '+cs.length+' >>\nstream\n'+cs+'\nendstream\nendobj\n');
    mark(im);add(im+' 0 obj\n<< /Type /XObject /Subtype /Image /Width '+pw+' /Height '+ph+' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length '+imgs[i].length+' >>\nstream\n');
    add(imgs[i]);add('\nendstream\nendobj\n');
  }
  var total=3+n*3,xp=pos;
  add('xref\n0 '+total+'\n0000000000 65535 f \n');
  for(var k=1;k<total;k++)add(('0000000000'+offs[k]).slice(-10)+' 00000 n \n');
  add('trailer\n<< /Size '+total+' /Root 1 0 R >>\nstartxref\n'+xp+'\n%%EOF');
  var out=new Uint8Array(pos),o=0;
  parts.forEach(function(b){out.set(b,o);o+=b.length});
  return out;
}
function toJpeg(cv){
  return new Promise(function(res,rej){
    cv.toBlob(function(b){if(!b)return rej(new Error('jpeg'));b.arrayBuffer().then(function(a){res(new Uint8Array(a))},rej)},'image/jpeg',0.92);
  });
}
async function makePdf(){
  var now=new Date(Date.now()+216e5).toISOString().slice(0,7),months={};
  D.ex.slice().sort(function(a,b){return (a.d+a.t).localeCompare(b.d+b.t)}).forEach(function(e){(months[e.d.slice(0,7)]=months[e.d.slice(0,7)]||[]).push(e)});
  var keys=Object.keys(months).sort().filter(function(k){return k>=now});
  if(!keys.length)keys=Object.keys(months).sort();
  if(!keys.length)throw new Error('empty');
  var imgs=[],chunks=[];
  for(var j=0;j<keys.length;j+=6)chunks.push(keys.slice(j,j+6));
  for(var i=0;i<chunks.length;i++){
    var cv=pageCanvas(chunks[i],months,i+1,chunks.length);
    imgs.push(await toJpeg(cv));cv.width=cv.height=0;
    await new Promise(function(r){setTimeout(r,0)});
  }
  return buildPdf(imgs,W*S,H*S);
}
window.admMakePdf=makePdf;
btn.addEventListener('click',async function(){
  if(btn.disabled)return;
  var label=btn.textContent;btn.disabled=true;btn.textContent='PDF তৈরি হচ্ছে…';
  try{
    if(document.fonts&&document.fonts.ready)await document.fonts.ready;
    var bytes=await makePdf(),url=URL.createObjectURL(new Blob([bytes],{type:'application/pdf'}));
    var a=document.createElement('a');a.href=url;a.download='bdresult-admission-calendar-'+D.meta.slug+'.pdf';
    document.body.appendChild(a);a.click();
    setTimeout(function(){URL.revokeObjectURL(url);a.remove()},5000);
  }catch(err){console.error(err);alert('PDF তৈরি করা যায়নি। পেজটি রিলোড করে আবার চেষ্টা করুন।')}
  finally{btn.disabled=false;btn.textContent=label}
});
})();
