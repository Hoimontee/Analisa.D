/* Shared by every page: theme switch, mobile menu, scroll reveal */
(function(){
  /* theme */
  var root = document.documentElement, btn = document.getElementById('themeToggle');
  var meta = document.querySelector('meta[name="theme-color"]');
  function paint(t){
    root.setAttribute('data-theme', t);
    var next = (t === 'light') ? 'dark' : 'light';
    if (btn){ btn.setAttribute('aria-label', 'Switch to ' + next + ' theme'); btn.setAttribute('title', 'Switch to ' + next + ' theme'); }
    if (meta) meta.setAttribute('content', t === 'light' ? '#F6F4EF' : '#1A1B1D');
  }
  paint(root.getAttribute('data-theme') === 'light' ? 'light' : 'dark');
  if (btn) btn.addEventListener('click', function(){
    var t = root.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    root.classList.add('theme-anim');
    paint(t);
    try { localStorage.setItem('theme', t); } catch(e) {}
    setTimeout(function(){ root.classList.remove('theme-anim'); }, 400);
  });

  /* mobile menu */
  var header = document.querySelector('header.nav'), tgl = document.getElementById('navToggle');
  if (header && tgl){
    function setOpen(o){ header.classList.toggle('menu-open', o); tgl.setAttribute('aria-expanded', o ? 'true' : 'false'); tgl.setAttribute('aria-label', o ? 'Close menu' : 'Open menu'); }
    tgl.addEventListener('click', function(){ setOpen(!header.classList.contains('menu-open')); });
    header.querySelectorAll('nav.links a').forEach(function(a){ a.addEventListener('click', function(){ setOpen(false); }); });
    document.addEventListener('keydown', function(e){ if (e.key === 'Escape') setOpen(false); });
    window.addEventListener('resize', function(){ if (window.innerWidth >= 1180) setOpen(false); });
  }

  /* scroll reveal */
  var els = document.querySelectorAll('.reveal');
  if (!('IntersectionObserver' in window)){ els.forEach(function(e){ e.classList.add('in'); }); return; }
  var io = new IntersectionObserver(function(entries){
    entries.forEach(function(e){ if (e.isIntersecting){ e.target.classList.add('in'); io.unobserve(e.target); } });
  }, {threshold: 0.12});
  els.forEach(function(e){ io.observe(e); });
})();
