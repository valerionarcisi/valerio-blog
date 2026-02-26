const RESEND_API = "https://api.resend.com/emails";
const NOTIFY_TO = "valerio.narcisi@gmail.com";

interface CommentNotification {
  pageId: string;
  name: string;
  email: string;
  text: string;
}

export async function notifyNewComment(comment: CommentNotification): Promise<void> {
  const apiKey = import.meta.env.RESEND_API_KEY;
  if (!apiKey) return;

  const adminUrl = `https://valerionarcisi.me/admin/comments?token=${import.meta.env.COMMENTS_ADMIN_TOKEN}`;

  try {
    await fetch(RESEND_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: "Blog <onboarding@resend.dev>",
        to: NOTIFY_TO,
        subject: `Nuovo commento da ${comment.name} su ${comment.pageId}`,
        html: `
          <div style="font-family:system-ui,sans-serif;max-width:500px">
            <h2 style="color:#c9a84c;margin:0 0 16px">Nuovo commento sul blog</h2>
            <p><strong>Pagina:</strong> ${escapeHtml(comment.pageId)}</p>
            <p><strong>Nome:</strong> ${escapeHtml(comment.name)}</p>
            <p><strong>Email:</strong> ${escapeHtml(comment.email)}</p>
            <hr style="border:none;border-top:1px solid #ddd;margin:16px 0"/>
            <p style="white-space:pre-wrap">${escapeHtml(comment.text)}</p>
            <hr style="border:none;border-top:1px solid #ddd;margin:16px 0"/>
            <p><a href="${adminUrl}" style="color:#4ecdc4">Modera commenti</a></p>
          </div>
        `,
      }),
    });
  } catch {
    // non bloccare il flusso se l'email fallisce
  }
}

interface ContactMessage {
  name: string;
  email: string;
  message: string;
}

export async function sendContactEmail(contact: ContactMessage): Promise<boolean> {
  const apiKey = import.meta.env.RESEND_API_KEY;
  if (!apiKey) return false;

  try {
    const res = await fetch(RESEND_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: "Blog <onboarding@resend.dev>",
        to: NOTIFY_TO,
        reply_to: contact.email,
        subject: `Nuovo messaggio da ${contact.name}`,
        html: `
          <div style="font-family:system-ui,sans-serif;max-width:500px">
            <h2 style="color:#c9a84c;margin:0 0 16px">Messaggio dal modulo contatti</h2>
            <p><strong>Nome:</strong> ${escapeHtml(contact.name)}</p>
            <p><strong>Email:</strong> ${escapeHtml(contact.email)}</p>
            <hr style="border:none;border-top:1px solid #ddd;margin:16px 0"/>
            <p style="white-space:pre-wrap">${escapeHtml(contact.message)}</p>
          </div>
        `,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
