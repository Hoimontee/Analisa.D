// Cloudflare Worker for analisa-data.com
//
// Static files (index.html, science.html, images, sitemap ...) are served directly by Cloudflare.
// Only requests to /api/* reach this script (see "run_worker_first" in wrangler.jsonc).
// It receives the two website forms and sends them to info@analisa-data.com through Brevo.
// The Brevo API key is a runtime SECRET called BREVO_API_KEY (Settings -> Variables and secrets).

const TO   = { email: 'info@analisa-data.com', name: 'Analisa' };
const FROM = { email: 'info@analisa-data.com', name: 'Analisa Website' };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers }
  });

const clip = (v, max) => String(v ?? '').trim().slice(0, max);
const esc  = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const multi = (v) => esc(v).replace(/\n/g, '<br>');
const row = (label, value) => `<p><b>${label}:</b> ${esc(value)}</p>`;

// field name -> max length
const FORMS = {
  '/api/contact': {
    fields: { name: 200, org: 200, email: 200, dataType: 100, material: 300, determine: 400, question: 5000, deadline: 200 },
    required: { name: 'your name', email: 'your email', question: 'your scientific question' },
    subject: (d) => `Analysis request — ${d.name}`,
    html: (d) => `<h2>New analysis request</h2>
      ${row('Name', d.name)}${row('Organisation', d.org)}${row('Email', d.email)}
      ${row('Data type', d.dataType)}${row('Material / sample', d.material)}
      ${row('What would you like to determine?', d.determine)}${row('Expected deadline', d.deadline)}
      <p><b>Scientific question:</b><br>${multi(d.question)}</p>`
  },
  '/api/apply': {
    fields: { name: 200, email: 200, position: 100, engagement: 100, availability: 200, profile: 400, expertise: 5000, notes: 5000 },
    required: { name: 'your name', email: 'your email', expertise: 'your areas of expertise' },
    subject: (d) => `Application — ${d.engagement || 'n/a'} — ${d.name}`,
    html: (d) => `<h2>New application</h2>
      ${row('Name', d.name)}${row('Email', d.email)}${row('Current position', d.position)}
      ${row('Type of engagement', d.engagement)}${row('Availability', d.availability)}${row('CV / profile link', d.profile)}
      <p><b>Areas of expertise:</b><br>${multi(d.expertise)}</p>
      <p><b>Anything else:</b><br>${multi(d.notes)}</p>`
  }
};

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    const form = FORMS[pathname];

    if (!form) return json({ ok: false, error: 'Not found.' }, 404);
    if (request.method !== 'POST') return json({ ok: false, error: 'Method not allowed.' }, 405, { allow: 'POST' });

    let raw;
    try { raw = await request.json(); }
    catch { return json({ ok: false, error: 'Invalid request.' }, 400); }
    if (!raw || typeof raw !== 'object') return json({ ok: false, error: 'Invalid request.' }, 400);

    // Honeypot: real visitors never see or fill this hidden field, bots usually do.
    if (raw.website) return json({ ok: true });

    const d = {};
    for (const [key, max] of Object.entries(form.fields)) d[key] = clip(raw[key], max);

    for (const [key, label] of Object.entries(form.required)) {
      if (!d[key]) return json({ ok: false, error: `Please fill in ${label}.` }, 400);
    }
    if (!EMAIL_RE.test(d.email)) return json({ ok: false, error: 'Please enter a valid email address.' }, 400);

    if (!env.BREVO_API_KEY) {
      console.error('BREVO_API_KEY is not set');
      return json({ ok: false, error: 'Email sending is not configured yet. Please email us directly at info@analisa-data.com.' }, 500);
    }

    try {
      const resp = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { accept: 'application/json', 'api-key': env.BREVO_API_KEY, 'content-type': 'application/json' },
        body: JSON.stringify({
          sender: FROM,
          to: [TO],
          replyTo: { email: d.email, name: d.name },
          subject: form.subject(d),
          htmlContent: form.html(d)
        })
      });
      if (!resp.ok) {
        console.error('Brevo error', resp.status, await resp.text());   // visible in Cloudflare logs only
        return json({ ok: false, error: 'Could not send the message. Please email us directly at info@analisa-data.com.' }, 502);
      }
    } catch (err) {
      console.error('Brevo request failed', String(err));
      return json({ ok: false, error: 'Could not send the message. Please email us directly at info@analisa-data.com.' }, 502);
    }

    return json({ ok: true });
  }
};
