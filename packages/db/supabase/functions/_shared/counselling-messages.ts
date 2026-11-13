// Notification content for the counsellor platform (ADR-015). Pure: used by the
// counselling-notify edge function and tested in Vitest.

export type NotificationTemplate = 'booking_confirmed' | 'booking_cancelled' | 'reminder_24h';
export type RecipientRole = 'client' | 'counsellor';

export interface MessageInput {
  template: NotificationTemplate;
  role: RecipientRole;
  recipientName: string;
  otherPartyName: string;
  startsAt: string; // ISO
  meetingLink: string | null;
  bookingId: string;
  baseUrl: string;
  cancelReason?: string | null;
}

export interface Message {
  subject: string;
  text: string;
  html: string;
  /** Body parameters for the approved WhatsApp template ({{1}}..{{4}}). */
  whatsappParams: [string, string, string, string];
}

export function formatIst(iso: string): string {
  const date = new Date(iso);
  const day = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(date);
  const time = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date);
  return `${day}, ${time} IST`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function buildMessage(input: MessageInput): Message {
  const when = formatIst(input.startsAt);
  const base = input.baseUrl.replace(/\/$/, '');
  const pageUrl =
    input.role === 'client' ? `${base}/my-sessions/${input.bookingId}` : `${base}/counsellor/sessions/${input.bookingId}`;
  const withWhom = input.role === 'client' ? `with ${input.otherPartyName}` : `with ${input.otherPartyName} (client)`;
  const greeting = `Hi ${input.recipientName || 'there'},`;

  let subject: string;
  const lines: string[] = [greeting, ''];

  switch (input.template) {
    case 'booking_confirmed':
      subject = `Session confirmed: ${when}`;
      lines.push(`Your Career Diya session ${withWhom} is confirmed for ${when}.`);
      break;
    case 'reminder_24h':
      subject = `Reminder: session tomorrow, ${when}`;
      lines.push(`A reminder that your Career Diya session ${withWhom} is on ${when}.`);
      break;
    case 'booking_cancelled':
      subject = `Session cancelled: ${when}`;
      lines.push(`Your Career Diya session ${withWhom} on ${when} has been cancelled.`);
      if (input.cancelReason) lines.push(`Reason: ${input.cancelReason}`);
      if (input.role === 'client') {
        lines.push('If you paid for this session, Career Diya will arrange your refund.');
      }
      break;
  }

  if (input.template !== 'booking_cancelled') {
    lines.push(input.meetingLink ? `Join here: ${input.meetingLink}` : 'The meeting link will be shared before the session.');
  }
  lines.push('', `Details: ${pageUrl}`, '', '— Career Diya');

  const text = lines.join('\n');
  const html = lines
    .map((line) => {
      if (!line) return '<br>';
      const safe = escapeHtml(line).replace(
        /(https:\/\/[^\s<]+)/g,
        (url) => `<a href="${url}">${url}</a>`,
      );
      return `<p style="margin:0 0 8px">${safe}</p>`;
    })
    .join('');

  return {
    subject,
    text,
    html: `<div style="font-family:Arial,sans-serif;font-size:15px;color:#151827">${html}</div>`,
    whatsappParams: [input.recipientName || 'there', input.otherPartyName, when, pageUrl],
  };
}
