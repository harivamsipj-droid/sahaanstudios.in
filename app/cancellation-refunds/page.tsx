import { SAHAAN_WHATSAPP_DISPLAY, sahaanWhatsAppUrl } from '@/lib/contact';
import Link from 'next/link';

export default function CancellationRefundsPage() {
  return <main className="legal-page"><header className="market-header inner-header"><Link className="market-brand" href="/"><span className="market-monogram">S</span><span><strong>SAHAAN</strong><small>HYDERABAD LAUNCH</small></span></Link><Link className="profile-back" href="/">Back to website</Link></header><article>
    <p className="eyebrow">Last updated 28 September 2026</p>
    <h1>Cancellation & Refund Policy</h1>
    <p>This policy applies to appointments arranged and paid for through Sahaan Studios. Browsing listings or sending an enquiry is free and does not confirm a booking or create a payment obligation.</p>
    <h2>Before payment</h2>
    <p>Sahaan shares the treatment scope, appointment window, service address, service and travel charges, agreed extras, applicable taxes and final total before asking you to pay. Your payment confirms a managed booking request. Sahaan then finalises the professional and sends you their details. We will not change the agreed treatment, price or appointment without your consent.</p>
    <h2>Cancel or reschedule before service starts</h2>
    <p>Message Sahaan on <a href={sahaanWhatsAppUrl()} target="_blank" rel="noopener noreferrer">WhatsApp at {SAHAAN_WHATSAPP_DISPLAY}</a> with your booking reference. If you cancel before the professional starts the service, you will receive a full refund of the amount you paid. Sahaan charges no cancellation fee or non-refundable deposit during the launch pilot. You may instead request a different time, subject to availability; we will confirm any changed price with you before proceeding.</p>
    <h2>If Sahaan cannot assign a professional</h2>
    <p>If we cannot arrange the agreed service, you may choose a replacement appointment at an agreed time or a full refund. If Sahaan or the assigned professional cancels, the same choice applies. We will not silently substitute a professional.</p>
    <h2>After service has started</h2>
    <p>If work has begun, tell Sahaan immediately about a cancellation, quality, hygiene, safety or conduct concern. We will review the work completed and any unused portion before deciding an appropriate refund or adjustment. This does not limit your rights under applicable law.</p>
    <h2>How refunds are handled</h2>
    <p>For an approved online-payment refund, Sahaan will initiate the refund to the original payment method within two business days of approval and share the refund reference. The bank or payment provider determines when the credit appears in your account, so arrival times vary. If you were charged twice or a payment failed, contact us with the payment reference; never share your card PIN, password or OTP.</p>
    <h2>Questions or complaints</h2>
    <p>Contact Sahaan at <a href="mailto:sahaanstudios@gmail.com">sahaanstudios@gmail.com</a> or <a href={sahaanWhatsAppUrl()} target="_blank" rel="noopener noreferrer">WhatsApp {SAHAAN_WHATSAPP_DISPLAY}</a>. Include your booking reference. We aim to acknowledge complaints within 48 hours and resolve them promptly in line with applicable law.</p>
    <p className="legal-note">A public Google-listed business that has not joined Sahaan may have its own policy. Sahaan cannot cancel or refund a booking you made directly with that business.</p>
  </article></main>;
}
