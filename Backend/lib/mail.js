// Sends email through Resend. If it is not set up, nothing is sent and the app carries on.
async function sendMail({ to, subject, text, html }) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.MAIL_FROM;
  if (!key || !from) return { sent: false, reason: 'not_configured' };

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [to], subject, text, html })
    });
    if (!res.ok) {
      // Only the status is logged, never the message or the reset link
      console.error('Email was refused with status', res.status);
      return { sent: false, reason: 'rejected' };
    }
    return { sent: true };
  } catch (e) {
    console.error('Email could not be sent');
    return { sent: false, reason: 'error' };
  }
}

module.exports = { sendMail };