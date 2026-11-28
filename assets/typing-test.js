(function(){
/* ---- phonetic (Avro-style) converter ---- */
var V={'rri':['ঋ','ৃ'],'oi':['ঐ','ৈ'],'OI':['ঐ','ৈ'],'ou':['ঔ','ৌ'],'OU':['ঔ','ৌ'],'aa':['আ','া'],'ii':['ঈ','ী'],'ee':['ঈ','ী'],'uu':['ঊ','ূ'],'oo':['উ','ু'],'a':['আ','া'],'i':['ই','ি'],'I':['ঈ','ী'],'u':['উ','ু'],'U':['ঊ','ূ'],'e':['এ','ে'],'o':['অ',''],'O':['ও','ো']};
var C={'kkh':'ক্ষ','GG':'জ্ঞ','ngk':'ঙ্ক','ngg':'ঙ্গ','t``':'ৎ','chh':'ছ','kh':'খ','gh':'ঘ','Ng':'ঙ','ch':'ছ','jh':'ঝ','NG':'ঞ','Th':'ঠ','Dh':'ঢ','th':'থ','dh':'ধ','ph':'ফ','bh':'ভ','sh':'শ','Sh':'ষ','Rh':'ঢ়','k':'ক','g':'গ','c':'চ','j':'জ','T':'ট','D':'ড','N':'ণ','t':'ত','d':'দ','n':'ন','p':'প','f':'ফ','b':'ব','v':'ভ','m':'ম','z':'য','r':'র','l':'ল','S':'শ','s':'স','h':'হ','R':'ড়','Y':'য়','q':'ক','x':'ক্স'};
var SP={'y':1,'Z':1,'w':1};/* y, Z = য-ফলা after a consonant; w = ব-ফলা (ও when alone) */
var S={'ng':'ং','^':'ঁ',':':'ঃ','$':'৳'},DG='০১২৩৪৫৬৭৮৯';
function conv(r){
  var out='',st=0,i=0;/* st: 0 other, 1 after consonant, 2 after vowel */
  while(i<r.length){
    var ch=r.charAt(i),kind='',val=null,len=0,L,s;
    for(L=3;L>=1;L--){s=r.substr(i,L);if(s.length<L)continue;
      if(S[s]!=null){kind='s';val=S[s]}else if(V[s]){kind='v';val=V[s]}else if(C[s]){kind='c';val=C[s]}
      if(kind){len=L;break}}
    if(!kind&&SP[ch]){
      if(st===1){out+=(ch==='w'?'্ব':'্য');st=3}
      else if(ch==='y'){out+=(out===''?'ইয়':'য়');st=1}
      else{out+=(ch==='w'?'ও':'য');st=2}
      i++;continue}
    if(!kind&&ch>='A'&&ch<='Z'){r=r.slice(0,i)+ch.toLowerCase()+r.slice(i+1);continue}/* unused capitals act like small letters (as in Avro) */
    if(!kind){
      if(ch==='`'){st=0}else if(ch>='0'&&ch<='9'){out+=DG.charAt(+ch);st=0}else{out+=ch;st=0}
      i++;continue}
    if(kind==='s'){out+=val;st=0}
    else if(kind==='v'){if(s==='a'&&st===2){out+='য়া'}else{out+=(st===1||st===3?val[1]:val[0])}st=2}
    else{out+=(st===1?'্':'')+val;st=1}
    i+=len}
  return out}
if(typeof module!=='undefined'&&module.exports){module.exports={conv:conv};return}

/* ---- typing test ---- */
var $=function(i){return document.getElementById(i)};
var dataEl=$('tt-data');if(!dataEl)return;
var D=JSON.parse(dataEl.textContent);
var tgt=$('tt-target'),ta=$('tt-input'),timeSel=$('tt-time'),srcSel=$('tt-src'),res=$('tt-res'),
    timeEl=$('tt-left'),wpmEl=$('tt-wpm'),accEl=$('tt-acc'),bestEl=$('tt-best');
var kb=document.getElementsByName('tt-kb');
var words=[],pids=[],idx=0,ok=0,bad=0,chars=0,started=false,done=false,t0=0,total=300,tick=null,lock='',raw='',base='',commits=[],lastVal='';
function bn(n){return String(n).replace(/\d/g,function(d){return DG.charAt(+d)})}
function mode(){for(var i=0;i<kb.length;i++)if(kb[i].checked)return kb[i].value;return'native'}
function norm(s){return String(s).normalize('NFC').replace(/[\u200c\u200d]/g,'').trim()}
function shuffle(a){a=a.slice();for(var i=a.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1)),t=a[i];a[i]=a[j];a[j]=t}return a}
function seenGet(){try{return JSON.parse(localStorage.getItem('bdtt_seen')||'[]')}catch(e){return[]}}
function seenSet(a){try{localStorage.setItem('bdtt_seen',JSON.stringify(a.slice(-60)))}catch(e){}}
function pick(){
  var need=Math.max(200,(+timeSel.value)*110),src=srcSel.value;words=[];pids=[];
  if(src==='words'){var all=D.words.split(/\s+/);while(words.length<need){shuffle(all).forEach(function(w){words.push(w);pids.push('')})}return}
  var list=D.passages.filter(function(p){return src==='all'||p.cat===src});if(!list.length)list=D.passages;
  var seen=seenGet(),fresh=shuffle(list.filter(function(p){return seen.indexOf(p.id)<0})),old=shuffle(list.filter(function(p){return seen.indexOf(p.id)>=0}));
  var order=fresh.concat(old);
  while(words.length<need){order.forEach(function(p){p.text.split(/\s+/).forEach(function(w){words.push(w);pids.push(p.id)})});order=shuffle(list)}
}
function render(){
  tgt.textContent='';
  words.forEach(function(w,i){var s=document.createElement('span');s.className='w';s.id='w'+i;s.textContent=w;tgt.appendChild(s);tgt.appendChild(document.createTextNode(' '))});
  tgt.scrollTop=0;mark()}
function mark(){var c=$('w'+idx);if(!c)return;c.className='w cur';
  var lh=parseFloat(getComputedStyle(tgt).lineHeight)||36,row=Math.floor(c.offsetTop/lh);
  tgt.scrollTop=Math.max(0,row-1)*lh}
function fmt(s){s=Math.max(0,Math.ceil(s));return bn(Math.floor(s/60))+':'+bn(('0'+(s%60)).slice(-2))}
function elapsed(){return started?(Date.now()-t0)/1000:0}
function stats(){
  var e=Math.min(elapsed(),total),m=e/60;
  wpmEl.textContent=bn(m>0.08?Math.round(ok/m):0);
  accEl.textContent=bn(ok+bad?Math.round(ok*100/(ok+bad)):100)+'%';
  timeEl.textContent=fmt(total-e)}
function upd(){if(elapsed()>=total){finish();return}stats()}
function start(){started=true;t0=Date.now();total=(+timeSel.value)*60;tick=setInterval(upd,250)}
function commit(t){
  var w=words[idx];if(w===undefined)return;
  var good=norm(t)===norm(w),el=$('w'+idx);
  if(good){ok++;chars+=w.length+1}else bad++;
  commits.push({len:lock.length,good:good,n:w.length+1});
  el.className='w '+(good?'ok':'bad');idx++;
  if(idx>=words.length){finish();return}
  mark()}
function uncommit(){
  var c=commits.pop();if(!c)return;
  if(c.good){ok--;chars-=c.n}else bad--;
  var el=$('w'+(idx-1));if(el)el.className='w';
  idx--}
function finish(){
  if(done)return;done=true;clearInterval(tick);
  var e=Math.max(5,Math.min(elapsed(),total)),m=e/60,wpm=Math.round(ok/m),acc=ok+bad?Math.round(ok*100/(ok+bad)):0,cpm=Math.round(chars/m);
  var sn=seenGet();for(var i=0;i<idx;i++)if(pids[i]&&sn.indexOf(pids[i])<0)sn.push(pids[i]);seenSet(sn);
  var best=0;try{best=+localStorage.getItem('bdtt_best')||0;if(wpm>best){best=wpm;localStorage.setItem('bdtt_best',best)}}catch(x){}
  $('tt-r-wpm').textContent=bn(wpm);$('tt-r-acc').textContent=bn(acc)+'%';$('tt-r-ok').textContent=bn(ok);$('tt-r-bad').textContent=bn(bad);$('tt-r-cpm').textContent=bn(cpm);
  bestEl.textContent=best?bn(best):'-';
  ta.disabled=true;res.hidden=false;stats();res.scrollIntoView({block:'nearest',behavior:'smooth'})}
function reset(fresh,focus){
  clearInterval(tick);started=done=false;ok=bad=chars=idx=0;lock=raw=base=lastVal='';commits=[];ta.disabled=false;ta.value='';res.hidden=true;
  if(fresh||!words.length)pick();render();total=(+timeSel.value)*60;stats();wpmEl.textContent=bn(0);
  try{bestEl.textContent=localStorage.getItem('bdtt_best')?bn(localStorage.getItem('bdtt_best')):'-'}catch(e){}
  if(focus)ta.focus()}
function live(){
  var c=$('w'+idx);if(!c||done)return;
  var part=norm(ta.value.slice(lock.length)),w=norm(words[idx]);
  c.className='w cur'+(part&&w.indexOf(part)!==0?' err':'')}
function sync(){
  if(done)return;
  var text=ta.value;
  if(text.length<lastVal.length&&lastVal.indexOf(text)===0){
    /* deleting from the end: step back into earlier words and let the user fix them */
    var re=false;
    while(commits.length&&commits[commits.length-1].len>text.length){uncommit();re=true}
    if(re||text.length<lock.length)lock=text.slice(0,commits.length?commits[commits.length-1].len:0);
    if(re)mark();
  }else if(text.indexOf(lock)!==0){text=ta.value=lastVal;base=text;raw='';return}
  if(!started&&text.length)start();
  var rest=text.slice(lock.length),m;
  while(!done&&(m=rest.search(/\s/))>=0){var t=rest.slice(0,m);lock+=rest.slice(0,m+1);rest=rest.slice(m+1);if(t)commit(t)}
  lastVal=ta.value;live()}
function put(v){ta.value=v;ta.setSelectionRange(v.length,v.length)}
var BR=/[\s,;?!()"'‘’“”\-–—.:\/]/;
ta.addEventListener('beforeinput',function(e){
  if(mode()!=='phon'||done||e.isComposing)return;
  var t=e.inputType;
  if(t==='insertText'&&e.data){
    e.preventDefault();
    for(var i=0;i<e.data.length;i++){var c=e.data.charAt(i);
      if(BR.test(c)){base+=conv(raw)+(c==='.'?'।':c);raw=''}else raw+=c}
    put(base+conv(raw));sync()}
  else if(t==='insertLineBreak'){e.preventDefault();base+=conv(raw)+'\n';raw='';put(base);sync()}
  else if(t==='deleteContentBackward'){
    e.preventDefault();
    if(raw)raw=raw.slice(0,-1);else{base=base.slice(0,-1);if(base.slice(-1)==='্')base=base.slice(0,-1)}
    put(base+conv(raw));sync()}
});
ta.addEventListener('input',function(){base=ta.value;raw='';sync()});
['paste','drop','cut'].forEach(function(n){ta.addEventListener(n,function(e){e.preventDefault()})});
for(var i=0;i<kb.length;i++)kb[i].addEventListener('change',function(){base=ta.value;raw='';ta.focus()});
timeSel.addEventListener('change',function(){reset(true)});
srcSel.addEventListener('change',function(){reset(true)});
$('tt-new').addEventListener('click',function(){reset(true,true)});
$('tt-again').addEventListener('click',function(){reset(false,true)});
$('tt-new2').addEventListener('click',function(){reset(true,true)});
if(window.matchMedia&&matchMedia('(pointer:coarse)').matches){for(var j=0;j<kb.length;j++)kb[j].checked=kb[j].value==='native'}
reset(true,false);
})();
