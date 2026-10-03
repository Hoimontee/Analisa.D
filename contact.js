// Cloudflare Pages Function — POST /api/contact
// Receives the "Request an Analysis" form from index.html and sends it
// via Brevo's transactional email API, using a secret API key that never
// touches the browser.

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function onRequestPost(context) {
  const { request, env } = context;

  let data;
  try {
    data = await request.json();
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: 'Invalid request body.' }), {
      status: 400,
      headers: { 'content-type': 'application/json' }
    });
  }

  const name = (data.name || '').trim();
  const email = (data.email || '').trim();
  const question = (data.question || '').trim();

  if (!name || !email || !question) {
    return new Response(JSON.stringify({ ok: false, error: 'Please fill in your name, email and scientific question.' }), {
      status: 400,
      headers: { 'content-type': 'application/json' }
    });
  }

  if (!env.BREVO_API_KEY) {
    return new Response(JSON.stringify({ ok: false, error: 'Email sending is not configured yet.' }), {
      status: 500,
      headers: { 'content-type': 'application/json' }
    });
  }

  const org = (data.org || '').trim();
  const dataType = (data.dataType || '').trim();
  const material = (data.material || '').trim();
  const determine = (data.determine || '').trim();
  const deadline = (data.deadline || '').trim();

  const htmlContent = `
    <h2>New analysis request</h2>
    <p><b>Name:</b> ${escapeHtml(name)}</p>
    <p><b>Organisation:</b> ${escapeHtml(org)}</p>
    <p><b>Email:</b> ${escapeHtml(email)}</p>
    <p><b>Data type:</b> ${escapeHtml(dataType)}</p>
    <p><b>Material / sample:</b> ${escapeHtml(material)}</p>
    <p><b>What would you like to determine?:</b> ${escapeHtml(determine)}</p>
    <p><b>Expected deadline:</b> ${escapeHtml(deadline)}</p>
    <p><b>Scientific question:</b><br>${escapeHtml(question).replace(/\n/g, '<br>')}</p>
  `;

  const brevoResp = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'accept': 'application/json',
      'api-key': env.BREVO_API_KEY,
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      sender: { name: 'Analisa Website', email: 'info@analisa-data.com' },
      to: [{ email: 'info@analisa-data.com', name: 'Analisa' }],
      replyTo: { email, name },
      subject: `Analysis request — ${name}`,
      htmlContent
    })
  });

  if (!brevoResp.ok) {
    const errText = await brevoResp.text();
    return new Response(JSON.stringify({ ok: false, error: 'Could not send the message. Please try again or email us directly.' , detail: errText }), {
      status: 502,
      headers: { 'content-type': 'application/json' }
    });
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'content-type': 'application/json' }
  });
}
