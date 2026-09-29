import type { Metadata } from 'next';
import { SAHAAN_WHATSAPP_DISPLAY, sahaanWhatsAppUrl } from '@/lib/contact';

export const metadata: Metadata = { title: 'Privacy Policy | Sahaan', description: 'How Sahaan handles customer and professional information.' };

export default function PrivacyPage() {
  return <main className="legal-page">
    <header className="market-header inner-header"><a className="market-brand" href="/"><span className="market-monogram">S</span><span><strong>SAHAAN</strong><small>HYDERABAD LAUNCH</small></span></a><a className="profile-back" href="/">Back to website</a></header>
    <article>
      <p className="eyebrow">Last updated 29 September 2026</p><h1>Privacy Policy</h1>
      <p>Sahaan is preparing a managed marketplace for beauty services in Hyderabad. This policy explains information used during customer searches, service enquiries, paid booking requests, professional assignment and professional applications.</p>
      <h2>Information you provide</h2>
      <p>If you submit a service request on this website, Sahaan stores your name, WhatsApp number, selected service, Hyderabad area, preferred date and time window, and any work notes you enter so our team can respond. A request is not a confirmed appointment. We may also receive an email address if provided elsewhere, service address, payment reference and professional application details. Sahaan does not store your card number, PIN or OTP. Opening the WhatsApp handoff sends its prefilled message text to WhatsApp; you must still tap Send to deliver it to Sahaan.</p>
      <h2>Location and Google Maps information</h2>
      <p>If you choose “Use my location,” your browser asks for permission. We round the coordinates to approximately 100-metre precision and keep them in your browser session for up to 10 minutes so the results page can search nearby. Sahaan sends those approximate coordinates and your chosen service to Google Maps Platform to retrieve public business listings. If you choose manual search instead, Sahaan sends your Hyderabad PIN code and service. Your coordinates are not placed in the page URL or shown to other visitors. Google processes search requests under the <a href="https://policies.google.com/privacy" target="_blank" rel="noreferrer">Google Privacy Policy</a>. A Google listing does not mean the business is verified or partnered with Sahaan.</p>
      <h2>How we use information</h2>
      <p>We use submitted information to respond to match requests, prepare a final quote, verify payment, assign a professional, send booking updates, process refunds, review professional applications, prevent misuse and improve the Sahaan experience. We do not sell personal information.</p>
      <h2>Data sharing and retention</h2>
      <p>Sahaan stores website enquiries in a private request inbox accessible only to its team. If you open the prepared WhatsApp link, Meta also receives its prefilled text; you then choose whether to send that message to Sahaan. If automated request updates are available and you separately opt in, Sahaan shares your number and the minimum request details needed for an acknowledgement with Meta’s WhatsApp Business Platform. For a paid Sahaan-managed request, the assigned professional receives the service scope, appointment window, address and customer contact needed to perform the job. Razorpay processes the payment and, once enabled, Meta’s WhatsApp Business Platform delivers opted-in booking notifications. These providers process information under their own policies. We may also share information as required by law or to protect users. We retain information only as long as reasonably needed for these purposes.</p>
      <h2>Your choices</h2>
      <p>You can decline browser location permission and search by PIN code instead. You may choose not to submit a request or application. Automated WhatsApp enquiry updates are optional; you can ask Sahaan to stop them at any time. The checkout separately asks for your agreement to receive booking updates on WhatsApp before payment. Contact Sahaan to request correction or deletion where applicable; transaction records may need to be retained under law. To request access, correction or deletion, contact Sahaan on <a href={sahaanWhatsAppUrl()} target="_blank" rel="noopener noreferrer">WhatsApp at {SAHAAN_WHATSAPP_DISPLAY}</a>.</p>
      <p className="legal-note">This launch policy should be reviewed with qualified Indian legal counsel before accepting payments or processing identity and bank documents.</p>
    </article>
  </main>;
}
