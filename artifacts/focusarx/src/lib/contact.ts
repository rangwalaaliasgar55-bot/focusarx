/**
 * Centralized contact details — single source of truth so the support email and
 * phone number stay consistent across the whole app (contact page, footer,
 * legal pages, support FAQ, JSON-LD, and API email senders).
 */
export const CONTACT_EMAIL = "focusarx@gmail.com";

/** Human-friendly display format. */
export const CONTACT_PHONE_DISPLAY = "+91 77250 04639";

/** E.164 format for `tel:` / `https://wa.me` links (no spaces/dashes). */
export const CONTACT_PHONE_TEL = "+917725004639";

/** Bare digits — useful for WhatsApp deep links. */
export const CONTACT_PHONE_DIGITS = "917725004639";

/** Opens the device's default mail client with a prefilled subject/body. */
export function mailTo(subject: string, body: string): string {
  return `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/** WhatsApp deep link with a prefilled message. */
export function whatsApp(message: string): string {
  return `https://wa.me/${CONTACT_PHONE_DIGITS}?text=${encodeURIComponent(message)}`;
}
