(() => {
  const slides=[...document.querySelectorAll('.slide')];
  let current=0;
  let autoplay=null;
  const progress=document.querySelector('#progress span');
  const counter=document.querySelector('#counter');
  const toast=document.querySelector('#toast');
  const themeBtn=document.querySelector('#themeBtn');

  function showToast(message){
    toast.textContent=message; toast.classList.add('show');
    clearTimeout(showToast.t); showToast.t=setTimeout(()=>toast.classList.remove('show'),1800);
  }
  function render(){
    slides.forEach((s,i)=>s.classList.toggle('active',i===current));
    progress.style.width=((current+1)/slides.length*100)+'%';
    counter.textContent=String(current+1).padStart(2,'0')+' / '+String(slides.length).padStart(2,'0');
    document.title=(slides[current].dataset.title||'VMS-SAIDHARA')+' — VMS-SAIDHARA';
    window.scrollTo({top:0,behavior:'smooth'});
  }
  function go(n){
    current=(n+slides.length)%slides.length; render();
  }
  document.querySelector('#nextBtn').onclick=()=>go(current+1);
  document.querySelector('#prevBtn').onclick=()=>go(current-1);
  document.addEventListener('keydown',e=>{
    if(['ArrowRight','PageDown',' '].includes(e.key)){e.preventDefault();go(current+1)}
    if(['ArrowLeft','PageUp'].includes(e.key)){e.preventDefault();go(current-1)}
    if(e.key==='Home'){e.preventDefault();go(0)}
    if(e.key==='End'){e.preventDefault();go(slides.length-1)}
    if(e.key.toLowerCase()==='f') toggleFull();
  });
  let sx=0;
  document.addEventListener('touchstart',e=>sx=e.touches[0].clientX,{passive:true});
  document.addEventListener('touchend',e=>{const dx=e.changedTouches[0].clientX-sx;if(Math.abs(dx)>50)go(current+(dx<0?1:-1))},{passive:true});

  themeBtn.onclick=()=>{
    document.body.classList.toggle('bw');
    const bw=document.body.classList.contains('bw');
    localStorage.setItem('vms-presentation-theme',bw?'bw':'color');
    themeBtn.innerHTML=bw?'◑ <span>B&W</span>':'◐ <span>Theme</span>';
    showToast(bw?'Black & White theme enabled':'Color theme enabled');
  };
  if(localStorage.getItem('vms-presentation-theme')==='bw'){
    document.body.classList.add('bw'); themeBtn.innerHTML='◑ <span>B&W</span>';
  }

  function printAll(){
    document.body.classList.add('printing');
    showToast('Print / PDF mode: all slides set to A4 landscape');
    setTimeout(()=>window.print(),120);
  }
  document.querySelector('#printBtn').onclick=printAll;
  document.querySelector('#pdfBtn').onclick=()=>{
    showToast('Choose “Save as PDF” in the print dialog');
    document.body.classList.add('printing');
    setTimeout(()=>window.print(),120);
  };
  window.addEventListener('afterprint',()=>document.body.classList.remove('printing'));

  async function toggleFull(){
    try{
      if(!document.fullscreenElement) await document.documentElement.requestFullscreen();
      else await document.exitFullscreen();
    }catch{showToast('Fullscreen is unavailable in this browser')}
  }
  document.querySelector('#fullBtn').onclick=toggleFull;

  slides.forEach(slide=>{
    slide.addEventListener('click',e=>{
      if(e.target.closest('a,button,input,select')) return;
      const x=e.clientX/innerWidth;
      if(x>.72)go(current+1); else if(x<.28)go(current-1);
    });
  });

  // Gentle pointer depth for cards; disabled for print and touch.
  if(matchMedia('(pointer:fine)').matches){
    document.addEventListener('pointermove',e=>{
      const card=e.target.closest('.tilt');
      if(!card||document.body.classList.contains('printing')) return;
      const r=card.getBoundingClientRect();
      const x=(e.clientX-r.left)/r.width-.5, y=(e.clientY-r.top)/r.height-.5;
      card.style.transform='perspective(800px) rotateX('+(-y*6)+'deg) rotateY('+(x*8-8)+'deg) translateZ(6px)';
    });
    document.addEventListener('pointerout',e=>{
      const card=e.target.closest('.tilt'); if(card) card.style.transform='';
    });
  }

  // Pause motion during printing and restore after.
  window.addEventListener('beforeprint',()=>document.body.classList.add('printing'));
  window.addEventListener('afterprint',()=>document.body.classList.remove('printing'));

  render();
})();