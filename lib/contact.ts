/** App support only: bugs, reports, admin access. Not donations. */
export const SUPPORT_EMAIL = 'support.animals@rescue-army.com';

export function supportMailto(
  subject = 'Rescue Army app support',
  body = 'What happened (screen, what you tapped, what you expected):\n\n',
) {
  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
