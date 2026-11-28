(function(){
var h=document.querySelector('.sh');if(!h)return;
var links=h.querySelector('.sh-links'),more=h.querySelector('.sh-more'),drop=h.querySelector('.sh-drop'),mb=h.querySelector('.sh-morebtn'),bg=h.querySelector('.sh-burger');
if(!links||!more||!drop||!mb||!bg)return;
h.classList.add('sh-js');
var all=[].slice.call(links.querySelectorAll('a')),mq=window.matchMedia('(max-width:860px)');
/* current page = longest matching link path */
var path=location.pathname.replace(/\/?$/,'/'),best=null,bl=-1;
all.forEach(function(a){var p=a.getAttribute('href').replace(/\/?$/,'/'),ok=p==='/'?path==='/':path.indexOf(p)===0;if(ok&&p.length>bl){best=a;bl=p.length}});
if(best)best.setAttribute('aria-current','page');
function closeAll(){h.classList.remove('open');more.classList.remove('open');bg.setAttribute('aria-expanded','false');bg.setAttribute('aria-label','মেনু খুলুন');mb.setAttribute('aria-expanded','false')}
function layout(){
  all.forEach(function(a){links.appendChild(a)});
  mb.classList.remove('has-cur');
  if(mq.matches){more.hidden=true;return}
  h.classList.remove('open');
  more.hidden=false;
  var i=all.length;
  while(links.scrollWidth>links.clientWidth+1&&i>1){drop.insertBefore(all[--i],drop.firstChild)}
  more.hidden=!drop.children.length;
  if(best&&best.parentNode===drop)mb.classList.add('has-cur');
}
var t;function sched(){cancelAnimationFrame(t);t=requestAnimationFrame(layout)}
layout();
window.addEventListener('resize',function(){closeAll();sched()});
if(document.fonts&&document.fonts.ready)document.fonts.ready.then(sched);
window.addEventListener('load',sched);
bg.addEventListener('click',function(e){e.stopPropagation();var o=!h.classList.contains('open');h.classList.toggle('open',o);bg.setAttribute('aria-expanded',o);bg.setAttribute('aria-label',o?'মেনু বন্ধ করুন':'মেনু খুলুন')});
mb.addEventListener('click',function(e){e.stopPropagation();var o=!more.classList.contains('open');more.classList.toggle('open',o);mb.setAttribute('aria-expanded',o)});
document.addEventListener('click',function(e){if(!h.contains(e.target)||e.target.closest('a'))closeAll()});
document.addEventListener('keydown',function(e){if(e.key==='Escape'){closeAll()}});
})();
