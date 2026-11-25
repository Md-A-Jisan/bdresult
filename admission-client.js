(function(){
var N=new Intl.NumberFormat('bn-BD',{minimumIntegerDigits:2,useGrouping:false});
function two(v){return N.format(v)}
function f(ms,long){
  var s=Math.floor((ms-Date.now())/1000);
  if(s<=0)return long?'পরীক্ষা শুরু / সম্পন্ন':'সম্পন্ন';
  var d=Math.floor(s/86400);s%=86400;
  var h=Math.floor(s/3600),m=Math.floor(s%3600/60),c=s%60;
  if(long)return two(d)+' দিন '+two(h)+' ঘণ্টা '+two(m)+' মিনিট '+two(c)+' সেকেন্ড';
  return '<i>'+two(d)+'দি '+two(h)+'ঘ</i> <i>'+two(m)+'মি '+two(c)+'সে</i>';
}
function tick(){
  var a=document.querySelectorAll('[data-t]');
  for(var i=0;i<a.length;i++){
    var e=a[i],ms=+e.getAttribute('data-t');
    if(e.hasAttribute('data-long'))e.textContent=f(ms,true);else e.innerHTML=f(ms,false);
  }
}
tick();setInterval(tick,1000);
var td=new Date(Date.now()+216e5).toISOString().slice(0,10);
document.querySelectorAll('[data-st]').forEach(function(e){
  var s=e.getAttribute('data-as'),x=e.getAttribute('data-ae'),c=x&&x<td?3:(s&&s>td?2:1);
  e.className='st st'+c;e.textContent=['','চলছে','শুরু হবে','শেষ'][c];
});
document.querySelectorAll('[data-ce]').forEach(function(a){
  var v=a.getAttribute('data-ce');if(v&&v<td)a.style.display='none';
});
var tabs=document.querySelectorAll('.adm-tabs [data-tab]');
if(tabs.length){
  var panels=document.querySelectorAll('.adm-panel');
  var show=function(id){
    tabs.forEach(function(b){b.setAttribute('aria-selected',b.getAttribute('data-tab')===id?'true':'false')});
    panels.forEach(function(p){p.classList.toggle('on',p.getAttribute('data-panel')===id)});
  };
  var route=function(){
    var h=decodeURIComponent(location.hash.slice(1));
    if(!h)return;
    if(h.indexOf('d-')===0){
      show('time');
      var el=document.getElementById(h);
      if(el)setTimeout(function(){el.scrollIntoView({block:'center',behavior:'smooth'})},40);
    }else if(document.querySelector('.adm-panel[data-panel="'+h+'"]')){show(h)}
  };
  tabs.forEach(function(b){
    b.addEventListener('click',function(){
      var id=b.getAttribute('data-tab');show(id);
      try{history.replaceState(null,'','#'+id)}catch(e){}
    });
  });
  document.addEventListener('click',function(ev){
    var a=ev.target.closest&&ev.target.closest('a[href^="#d-"]');
    if(!a)return;
    ev.preventDefault();
    var h=a.getAttribute('href');
    if(location.hash===h)route();else location.hash=h;
  });
  window.addEventListener('hashchange',route);
  route();
}
})();
