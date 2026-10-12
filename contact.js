(function(){
  // ---------- Contact form -> /api/contact (Cloudflare Worker -> email) ----------
  const form = document.getElementById('contactForm');
  if (!form) return;
  const statusEl = document.getElementById('contactStatus');
  const submitBtn = document.getElementById('contactSubmit');
  form.addEventListener('submit', async function(e){
    e.preventDefault();
    const payload = {
      name: document.getElementById('name').value,
      org: document.getElementById('org').value,
      email: document.getElementById('email').value,
      dataType: document.getElementById('dataType').value,
      material: document.getElementById('material').value,
      question: document.getElementById('question').value,
      deadline: document.getElementById('deadline').value,
      consent: document.getElementById('consent').checked ? 'Yes — agreed to processing of the enquiry (privacy policy)' : '',
      website: document.getElementById('website').value
    };
    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending…';
    statusEl.textContent = '';
    statusEl.className = 'form-status';
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const result = await res.json();
      if (result.ok) {
        form.reset();
        statusEl.textContent = 'Thank you — your enquiry has been sent. We will reply by email as soon as we can.';
        statusEl.classList.add('success');
      } else {
        statusEl.textContent = result.error || 'Something went wrong. Please email us directly at info@analisa-data.com.';
        statusEl.classList.add('error');
      }
    } catch (err) {
      statusEl.textContent = 'Could not reach the server. Please email us directly at info@analisa-data.com.';
      statusEl.classList.add('error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Send enquiry';
    }
  });
})();
