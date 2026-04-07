import { env } from "~/lib/env";

const RESEND_API = "https://api.resend.com/emails";
const NOTIFY_TO = "valerio.narcisi@gmail.com";
const FROM = "Blog <onboarding@resend.dev>";
const SITE_URL = "https://valerionarcisi.me";

interface CommentNotification {
  pageId: string;
  name: string;
  email: string;
  text: string;
  parentId?: number | null;
  parentName?: string | null;
  lang?: string;
}

function postLink(pageId: string, lang: string): string {
  const clean = pageId.replace(/^\/+|\/+$/g, "");
  // pageId arriva nel formato "{lang}/{section}/{slug}", es "it/blog/foo".
  // Per il locale di default IT non c'e' prefix; per EN c'e' "/en".
  const withoutLang = clean.replace(/^(it|en)\//, "");
  if (lang === "en") return `${SITE_URL}/en/${withoutLang}/`;
  return `${SITE_URL}/${withoutLang}/`;
}

async function sendEmail(payload: {
  to: string;
  subject: string;
  html: string;
  reply_to?: string;
}): Promise<boolean> {
  const apiKey = env("RESEND_API_KEY");
  if (!apiKey) return false;
  try {
    const res = await fetch(RESEND_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ from: FROM, ...payload }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function notifyNewComment(
  comment: CommentNotification,
): Promise<void> {
  const adminUrl = `${SITE_URL}/admin/comments?token=${env("ADMIN_TOKEN")}`;
  const isReply = !!comment.parentId;
  const subject = isReply
    ? `Reply da ${comment.name} a ${comment.parentName ?? "#" + comment.parentId} su ${comment.pageId}`
    : `Nuovo commento da ${comment.name} su ${comment.pageId}`;

  await sendEmail({
    to: NOTIFY_TO,
    subject,
    html: `
      <div style="font-family:system-ui,sans-serif;max-width:500px">
        <h2 style="color:#c9a84c;margin:0 0 16px">${isReply ? "Nuova risposta sul blog" : "Nuovo commento sul blog"}</h2>
        <p><strong>Pagina:</strong> ${escapeHtml(comment.pageId)}</p>
        <p><strong>Nome:</strong> ${escapeHtml(comment.name)}</p>
        <p><strong>Email:</strong> ${escapeHtml(comment.email)}</p>
        ${isReply ? `<p><strong>In risposta a:</strong> ${escapeHtml(comment.parentName ?? "#" + comment.parentId)}</p>` : ""}
        <hr style="border:none;border-top:1px solid #ddd;margin:16px 0"/>
        <p style="white-space:pre-wrap">${escapeHtml(comment.text)}</p>
        <hr style="border:none;border-top:1px solid #ddd;margin:16px 0"/>
        <p><a href="${adminUrl}" style="color:#4ecdc4">Modera commenti</a></p>
      </div>
    `,
  });
}

interface ApprovedNotification {
  pageId: string;
  name: string;
  email: string;
  text: string;
  lang: string;
}

export async function notifyCommentApproved(
  comment: ApprovedNotification,
): Promise<void> {
  const link = postLink(comment.pageId, comment.lang);
  const isEn = comment.lang === "en";
  const subject = isEn
    ? "Your comment has been published"
    : "Il tuo commento è stato pubblicato";
  const heading = isEn
    ? "Your comment is now live"
    : "Il tuo commento è ora online";
  const intro = isEn
    ? "Thanks for joining the conversation. Your comment has been approved and is now visible:"
    : "Grazie per aver partecipato. Il tuo commento è stato approvato e ora è visibile:";
  const cta = isEn ? "View the post" : "Vai al post";

  await sendEmail({
    to: comment.email,
    subject,
    html: `
      <div style="font-family:system-ui,sans-serif;max-width:500px">
        <h2 style="color:#c9a84c;margin:0 0 16px">${heading}</h2>
        <p>${escapeHtml(intro)}</p>
        <blockquote style="border-left:3px solid #c9a84c;padding-left:12px;color:#555;white-space:pre-wrap">${escapeHtml(comment.text)}</blockquote>
        <p><a href="${link}" style="color:#4ecdc4">${cta} →</a></p>
      </div>
    `,
  });
}

interface RejectedNotification {
  pageId: string;
  name: string;
  email: string;
  lang: string;
}

export async function notifyCommentRejected(
  comment: RejectedNotification,
): Promise<void> {
  const isEn = comment.lang === "en";
  const subject = isEn
    ? "About your recent comment"
    : "Sul tuo recente commento";
  const heading = isEn
    ? "Your comment was not approved"
    : "Il tuo commento non è stato approvato";
  const body = isEn
    ? `Hi ${comment.name}, thanks for taking the time to comment on the blog. Unfortunately your recent comment on "${comment.pageId}" did not pass moderation and has been removed. You're welcome to share another thought any time.`
    : `Ciao ${comment.name}, grazie per aver lasciato un commento sul blog. Purtroppo il tuo recente commento su "${comment.pageId}" non ha superato la moderazione ed è stato rimosso. Sei sempre il benvenuto a condividere un nuovo pensiero.`;

  await sendEmail({
    to: comment.email,
    subject,
    html: `
      <div style="font-family:system-ui,sans-serif;max-width:500px">
        <h2 style="color:#c9a84c;margin:0 0 16px">${heading}</h2>
        <p>${escapeHtml(body)}</p>
      </div>
    `,
  });
}

interface ReplyNotification {
  pageId: string;
  parentName: string;
  parentEmail: string;
  replyName: string;
  replyText: string;
  lang: string;
}

export async function notifyReplyToYourComment(
  data: ReplyNotification,
): Promise<void> {
  const link = postLink(data.pageId, data.lang);
  const isEn = data.lang === "en";
  const subject = isEn
    ? `${data.replyName} replied to your comment`
    : `${data.replyName} ha risposto al tuo commento`;
  const heading = isEn
    ? "You have a new reply"
    : "Hai una nuova risposta";
  const intro = isEn
    ? `${data.replyName} replied to your comment on the post "${data.pageId}":`
    : `${data.replyName} ha risposto al tuo commento sul post "${data.pageId}":`;
  const cta = isEn ? "Read the conversation" : "Leggi la conversazione";

  await sendEmail({
    to: data.parentEmail,
    subject,
    html: `
      <div style="font-family:system-ui,sans-serif;max-width:500px">
        <h2 style="color:#c9a84c;margin:0 0 16px">${heading}</h2>
        <p>${escapeHtml(intro)}</p>
        <blockquote style="border-left:3px solid #4ecdc4;padding-left:12px;color:#555;white-space:pre-wrap">${escapeHtml(data.replyText)}</blockquote>
        <p><a href="${link}" style="color:#4ecdc4">${cta} →</a></p>
      </div>
    `,
  });
}

interface ContactMessage {
  name: string;
  email: string;
  message: string;
}

export async function sendContactEmail(
  contact: ContactMessage,
): Promise<boolean> {
  return sendEmail({
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
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
