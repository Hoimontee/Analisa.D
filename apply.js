// Cloudflare Pages Function — POST /api/apply
// Receives the application form from careers.html and sends it via
// Brevo's transactional email API.

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
  const expertise = (data.expertise || '').trim();

  if (!name || !email || !expertise) {
    return new Response(JSON.stringify({ ok: false, error: 'Please fill in your name, email and areas of expertise.' }), {
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

  const position = (data.position || '').trim();
  const engagement = (data.engagement || '').trim();
  const availability = (data.availability || '').trim();
  const profile = (data.profile || '').trim();
  const notes = (data.notes || '').trim();

  const htmlContent = `
    <h2>New application</h2>
    <p><b>Name:</b> ${escapeHtml(name)}</p>
    <p><b>Email:</b> ${escapeHtml(email)}</p>
    <p><b>Current position:</b> ${escapeHtml(position)}</p>
    <p><b>Type of engagement:</b> ${escapeHtml(engagement)}</p>
    <p><b>Availability:</b> ${escapeHtml(availability)}</p>
    <p><b>CV / profile link:</b> ${escapeHtml(profile)}</p>
    <p><b>Areas of expertise:</b><br>${escapeHtml(expertise).replace(/\n/g, '<br>')}</p>
    <p><b>Anything else:</b><br>${escapeHtml(notes).replace(/\n/g, '<br>')}</p>
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
      subject: `Application — ${engagement} — ${name}`,
      htmlContent
    })
  });

  if (!brevoResp.ok) {
    const errText = await brevoResp.text();
    return new Response(JSON.stringify({ ok: false, error: 'Could not send the message. Please try again or email us directly.', detail: errText }), {
      status: 502,
      headers: { 'content-type': 'application/json' }
    });
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'content-type': 'application/json' }
  });
}
