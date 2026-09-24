// Temporary launch contact. Update this one value when Sahaan's dedicated number is ready.
export const SAHAAN_WHATSAPP_NUMBER = '918143072723';
export const SAHAAN_WHATSAPP_DISPLAY = '+91 81430 72723';

export function sahaanWhatsAppUrl(message?: string) {
  const url = `https://wa.me/${SAHAAN_WHATSAPP_NUMBER}`;
  return message ? `${url}?text=${encodeURIComponent(message)}` : url;
}
