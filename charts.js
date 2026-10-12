(function(){
  const NS = "http://www.w3.org/2000/svg";
  function el(name, attrs){
    const e = document.createElementNS(NS, name);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  }
  function mulberry32(seed){
    return function(){
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  const rng = mulberry32(42);

  function gaussian(x, x0, s){ return Math.exp(-((x-x0)*(x-x0))/(2*s*s)); }

  // ---------- Reciprocal-space profile generator ----------
  const profilePeaks = [
    {x:12.4,i:0.35,w:0.16},{x:17.6,i:0.92,w:0.14},{x:21.8,i:1.0,w:0.15},
    {x:25.3,i:0.55,w:0.14},{x:28.9,i:0.78,w:0.16},{x:31.4,i:0.32,w:0.14},
    {x:35.0,i:0.44,w:0.17},{x:38.2,i:0.24,w:0.15},{x:41.6,i:0.19,w:0.16},
    {x:44.9,i:0.30,w:0.17},{x:48.1,i:0.16,w:0.16},{x:53.6,i:0.13,w:0.18},
    {x:58.0,i:0.11,w:0.19}
  ];
  function profileY(x){
    let y = 0.04;
    for (const p of profilePeaks) y += p.i * gaussian(x, p.x, p.w);
    return y;
  }

  // ---------- Real-space G(r) generator ----------
  const rPeaks = [
    {r:1.98,a:0.95,s:0.055},{r:2.45,a:0.42,s:0.06},{r:2.83,a:0.8,s:0.07},
    {r:3.46,a:0.28,s:0.08},{r:3.99,a:0.58,s:0.09},{r:4.62,a:0.22,s:0.10},
    {r:4.90,a:0.4,s:0.10},{r:5.63,a:0.18,s:0.11}
  ];
  function grY(r){
    const envelope = Math.exp(-(r-1.0)/9.5);
    let y = 0;
    for (const p of rPeaks){
      y += p.a * envelope * gaussian(r, p.r, p.s);
      y -= 0.32 * p.a * envelope * gaussian(r, p.r + 0.42, p.s*1.3);
    }
    y += 0.02 * Math.sin(r*5.5) * envelope;
    return y;
  }

  function buildSeries(fn, xmin, xmax, n, noiseAmp, seedOffset){
    const localRng = mulberry32(1000 + seedOffset);
    const pts = [];
    for (let k=0;k<=n;k++){
      const x = xmin + (xmax-xmin)*k/n;
      let y = fn(x);
      if (noiseAmp) y += (localRng()-0.5)*noiseAmp;
      pts.push([x,y]);
    }
    return pts;
  }

  function toPixels(pts, xmin, xmax, ymin, ymax, W, H, padL, padR, padT, padB){
    return pts.map(([x,y])=>{
      const px = padL + (x-xmin)/(xmax-xmin) * (W-padL-padR);
      const py = H - padB - (y-ymin)/(ymax-ymin) * (H-padT-padB);
      return [px,py];
    });
  }
  function pointsAttr(pxPts){ return pxPts.map(p=>p[0].toFixed(2)+","+p[1].toFixed(2)).join(" "); }

  // ---------- Simple line-chart renderer (used by carousel slides) ----------
  function renderSimple(svgId, series, xmin, xmax, ymin, ymax, color, opacity){
    const svg = document.getElementById(svgId);
    if (!svg) return;
    const W=420,H=220,padL=8,padR=8,padT=14,padB=14;
    const px = toPixels(series, xmin, xmax, ymin, ymax, W,H,padL,padR,padT,padB);
    svg.appendChild(el('line',{x1:padL,y1:H-padB,x2:W-padR,y2:H-padB,stroke:'var(--line)','stroke-width':1}));
    svg.appendChild(el('polyline',{points:pointsAttr(px),fill:'none',stroke:color,'stroke-width':1.8,'stroke-linejoin':'round',opacity: opacity||1}));
  }

  // Battery: pristine vs. cycled electrode, overlaid
  renderSimple('slideBattery', buildSeries(profileY,10,62,320,0.006,104), 10,62,0,1.05,'var(--blue)', 0.85);
  function cycledY(x){
    let y = 0.04;
    profilePeaks.forEach(p=>{ y += (p.i*0.65) * gaussian(x, p.x+0.35, p.w*1.9); });
    return y;
  }
  renderSimple('slideBattery', buildSeries(cycledY,10,62,320,0.006,105), 10,62,0,1.05,'var(--accent)');

  // Single crystal: discrete reflection spots on a lattice grid
  (function(){
    const svg = document.getElementById('slideSpots');
    if (!svg) return;
    const spotRng = mulberry32(9);
    const size = 260, cx = size/2, cy = size/2, step = 30;
    for (let i=-4;i<=4;i++){
      for (let j=-4;j<=4;j++){
        const x = cx + i*step, y = cy + j*step;
        if (x < 6 || x > size-6 || y < 6 || y > size-6) continue;
        const isCenter = (i===0 && j===0);
        const intensity = isCenter ? 1 : spotRng();
        if (intensity < 0.22 && !isCenter) continue; // systematic absence
        const r = isCenter ? 5 : 1.3 + intensity*3.4;
        svg.appendChild(el('circle',{
          cx:x.toFixed(1), cy:y.toFixed(1), r:r.toFixed(2),
          fill: isCenter ? 'var(--text)' : 'var(--accent)',
          opacity: isCenter ? 0.55 : (0.35 + intensity*0.6).toFixed(2)
        }));
      }
    }
  })();

  // ---------- Carousel controls ----------
  (function(){
    const car = document.getElementById('carousel');
    if (!car) return;
    const slides = Array.from(car.querySelectorAll('.slide'));
    const dotsWrap = document.getElementById('carDots');
    const dots = slides.map((_, i) => {
      const b = document.createElement('button');
      b.className = 'carousel-dot' + (i===0 ? ' active' : '');
      b.setAttribute('aria-label', 'Go to slide ' + (i+1));
      b.addEventListener('click', () => slides[i].scrollIntoView({behavior:'smooth', inline:'start', block:'nearest'}));
      dotsWrap.appendChild(b);
      return b;
    });

    const dotIO = new IntersectionObserver((entries)=>{
      entries.forEach(entry=>{
        if (entry.isIntersecting){
          const idx = slides.indexOf(entry.target);
          dots.forEach((d,i)=> d.classList.toggle('active', i===idx));
        }
      });
    }, {root: car, threshold: 0.6});
    slides.forEach(s => dotIO.observe(s));

    document.getElementById('carPrev').addEventListener('click', ()=> car.scrollBy({left: -car.clientWidth, behavior:'smooth'}));
    document.getElementById('carNext').addEventListener('click', ()=> car.scrollBy({left: car.clientWidth, behavior:'smooth'}));

    car.setAttribute('tabindex','0');
    car.addEventListener('keydown', (e)=>{
      if (e.key === 'ArrowRight') car.scrollBy({left: car.clientWidth, behavior:'smooth'});
      if (e.key === 'ArrowLeft') car.scrollBy({left: -car.clientWidth, behavior:'smooth'});
    });

    // ---- automatic slideshow ----
    // Moves on every few seconds; pauses while the visitor hovers, touches or focuses the carousel,
    // while it is off-screen or the tab is hidden, and can be switched off with the pause button.
    // Not used at all for visitors whose system asks for reduced motion (they can still press play).
    const INTERVAL = 6500;
    const wrap = car.closest('.carousel-wrap');
    const playBtn = document.getElementById('carPlay');
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let userPaused = reduced, hoverPaused = false, inView = false, timer = null;

    function advance(){
      if (userPaused || hoverPaused || !inView || document.hidden) return;
      const atEnd = car.scrollLeft + car.clientWidth >= car.scrollWidth - 4;
      if (atEnd) car.scrollTo({left: 0, behavior: 'smooth'});
      else car.scrollBy({left: car.clientWidth, behavior: 'smooth'});
    }
    function restart(){ clearInterval(timer); timer = setInterval(advance, INTERVAL); }   // a fresh full interval after any interaction
    function paintButton(){
      playBtn.classList.toggle('is-paused', userPaused);
      const label = userPaused ? 'Play automatic slideshow' : 'Pause automatic slideshow';
      playBtn.setAttribute('aria-label', label); playBtn.setAttribute('title', label);
    }
    playBtn.addEventListener('click', ()=>{ userPaused = !userPaused; paintButton(); restart(); });
    paintButton();

    new IntersectionObserver((entries)=>{ inView = entries[0].isIntersecting; if (inView) restart(); }, {threshold: 0.35}).observe(car);
    wrap.addEventListener('mouseenter', ()=>{ hoverPaused = true; });
    wrap.addEventListener('mouseleave', ()=>{ hoverPaused = false; restart(); });
    wrap.addEventListener('focusin',   ()=>{ hoverPaused = true; });
    wrap.addEventListener('focusout',  ()=>{ hoverPaused = false; restart(); });
    wrap.addEventListener('touchstart', ()=>{ hoverPaused = true; }, {passive: true});
    wrap.addEventListener('touchend',   ()=>{ setTimeout(()=>{ hoverPaused = false; restart(); }, 4000); }, {passive: true});
    document.addEventListener('visibilitychange', restart);
    ['carPrev','carNext'].forEach(id => document.getElementById(id).addEventListener('click', restart));
    dots.forEach(d => d.addEventListener('click', restart));
    restart();
  })();

  // ---------- Output card: Rietveld ----------
  (function(){
    const svg = document.getElementById('rietveldChart');
    const W=620,H=300,padL=10,padR=10,padT=16,padB=30;
    const xmin=10,xmax=62,ymin=-0.30,ymax=1.08;

    const calc = buildSeries(profileY,xmin,xmax,500,0,10);
    const calcPx = toPixels(calc,xmin,xmax,ymin,ymax,W,H,padL,padR,padT,padB);

    // baseline
    svg.appendChild(el('line',{x1:padL,y1:H-padB,x2:W-padR,y2:H-padB,stroke:'var(--line)','stroke-width':1}));

    // reflection tick marks
    profilePeaks.forEach(p=>{
      const px = padL + (p.x-xmin)/(xmax-xmin)*(W-padL-padR);
      const yBase = H - padB + 8;
      svg.appendChild(el('line',{x1:px,y1:yBase,x2:px,y2:yBase+7,stroke:'var(--text-faint)','stroke-width':1.4}));
    });

    // difference curve (offset below)
    const diffOffset = -0.16;
    const diffRng = mulberry32(77);
    const diffPts = calc.map(([x,y])=>{
      const noise = (diffRng()-0.5)*0.03;
      return [x, diffOffset + noise];
    });
    const diffPx = toPixels(diffPts,xmin,xmax,ymin,ymax,W,H,padL,padR,padT,padB);
    svg.appendChild(el('polyline',{points:pointsAttr(diffPx),fill:'none',stroke:'var(--rose)','stroke-width':1,opacity:'0.85'}));

    // calculated line
    svg.appendChild(el('polyline',{points:pointsAttr(calcPx),fill:'none',stroke:'var(--accent)','stroke-width':1.8}));

    // observed points (sparser, jittered)
    const obsRng = mulberry32(21);
    for (let k=0;k<=110;k++){
      const x = xmin + (xmax-xmin)*k/110;
      const y = profileY(x) + (obsRng()-0.5)*0.035;
      const px = padL + (x-xmin)/(xmax-xmin)*(W-padL-padR);
      const py = H - padB - (y-ymin)/(ymax-ymin)*(H-padT-padB);
      svg.appendChild(el('circle',{cx:px.toFixed(2),cy:py.toFixed(2),r:1.6,fill:'var(--blue)',opacity:'0.8'}));
    }

    // axis labels
    const lbl1 = el('text',{x:padL,y:H-8,'font-family':'JetBrains Mono, monospace','font-size':'10','fill':'var(--text-faint)'});
    lbl1.textContent = '2θ (°) →'; svg.appendChild(lbl1);
  })();

  // ---------- Output card: G(r) with shell labels ----------
  (function(){
    const svg = document.getElementById('gChart');
    const W=620,H=300,padL=14,padR=14,padT=20,padB=34;
    const xmin=1.0,xmax=8.0,ymin=-0.5,ymax=1.05;

    const exp = buildSeries(grY,xmin,xmax,480,0.018,33);
    const expPx = toPixels(exp,xmin,xmax,ymin,ymax,W,H,padL,padR,padT,padB);
    const model = buildSeries(grY,xmin,xmax,480,0,44);
    const modelPx = toPixels(model,xmin,xmax,ymin,ymax,W,H,padL,padR,padT,padB);

    // zero line
    const zeroPy = H - padB - (0-ymin)/(ymax-ymin)*(H-padT-padB);
    svg.appendChild(el('line',{x1:padL,y1:zeroPy,x2:W-padR,y2:zeroPy,stroke:'var(--line)','stroke-width':1}));

    svg.appendChild(el('polyline',{points:pointsAttr(expPx),fill:'none',stroke:'var(--blue)','stroke-width':1.3,opacity:'0.75'}));
    svg.appendChild(el('polyline',{points:pointsAttr(modelPx),fill:'none',stroke:'var(--accent)','stroke-width':1.8}));

    // shell labels on first three peaks
    const labeled = [
      {r:1.98, txt:'1.98 Å'},
      {r:2.83, txt:'2.83 Å'},
      {r:3.99, txt:'3.99 Å'}
    ];
    labeled.forEach(item=>{
      const px = padL + (item.r-xmin)/(xmax-xmin)*(W-padL-padR);
      const y = grY(item.r);
      const py = H - padB - (y-ymin)/(ymax-ymin)*(H-padT-padB);
      svg.appendChild(el('line',{x1:px,y1:py-4,x2:px,y2:padT-4,stroke:'var(--line-strong)','stroke-width':1,'stroke-dasharray':'2 3'}));
      const t = el('text',{x:px,y:padT-8,'text-anchor':'middle','font-family':'JetBrains Mono, monospace','font-size':'10','fill':'var(--text-dim)'});
      t.textContent = item.txt;
      svg.appendChild(t);
    });

    const lbl = el('text',{x:padL,y:H-10,'font-family':'JetBrains Mono, monospace','font-size':'10','fill':'var(--text-faint)'});
    lbl.textContent = 'r (Å) →'; svg.appendChild(lbl);
  })();

})();
