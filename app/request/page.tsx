'use client';

import { FormEvent, useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Clock3, MessageCircle, ShieldCheck } from 'lucide-react';
import { sahaanWhatsAppUrl } from '@/lib/contact';
import { customerServices } from '@/lib/services';

const windows = ['9:00 am–12:00 pm', '12:00 pm–3:00 pm', '3:00 pm–6:00 pm', '6:00 pm–9:00 pm'];
const todayInHyderabad = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

export default function RequestPage() {
  const [service, setService] = useState<string>(customerServices[0].name);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [area, setArea] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [notes, setNotes] = useState('');
  const [consent, setConsent] = useState(false);
  const [whatsappConsent, setWhatsappConsent] = useState(false);
  const [whatsappAvailable, setWhatsappAvailable] = useState(false);
  const [whatsappUpdate, setWhatsappUpdate] = useState('');
  const [busy, setBusy] = useState(false);
  const [storageReady, setStorageReady] = useState<boolean | null>(null);
  const [error, setError] = useState('');
  const [reference, setReference] = useState('');
  const [reviewing, setReviewing] = useState(false);
  const selected = customerServices.find((item) => item.name === service) || customerServices[0];
  const formattedDate = date ? new Date(`${date}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Not selected';
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requested = params.get('service');
    const match = customerServices.find((item) => item.name === requested);
    if (match) setService(match.name);
    const requestedDate = params.get('date');
    if (requestedDate && /^\d{4}-\d{2}-\d{2}$/.test(requestedDate) && requestedDate >= todayInHyderabad()) setDate(requestedDate);
  }, []);
  useEffect(() => {
    let active = true;
    fetch('/api/customer-requests/health', { cache: 'no-store' })
      .then(async (response) => {
        const result = response.ok ? await response.json() as { whatsappAvailable?: boolean } : null;
        if (active) { setStorageReady(response.ok); setWhatsappAvailable(result?.whatsappAvailable === true); }
      })
      .catch(() => { if (active) setStorageReady(false); });
    return () => { active = false; };
  }, []);
  const whatsappMessage = reference
    ? `Hi Sahaan! My website request reference is ${reference}. Service: ${service}. Preferred date: ${date}, time: ${time}. Please check my request and confirm the artist, exact work, travel and final price before booking.`
    : `Hi Sahaan! I could not save a website request. Service: ${service}. Name: ${name}. WhatsApp: +91 ${phone}. Hyderabad area: ${area}. Preferred date: ${date}. Preferred time: ${time}. Work/design: ${notes || 'I will describe or share a photo here.'} Please confirm the final quote before booking.`;

  function review(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setReviewing(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function confirmRequest() {
    if (busy) return;
    setError('');
    if (storageReady === false) {
      window.location.href = sahaanWhatsAppUrl(whatsappMessage);
      return;
    }
    setBusy(true);
    try {
      const response = await fetch('/api/customer-requests/', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name, phone: `91${phone.replace(/\D/g, '')}`, service, area, date, time, notes,
          consent, whatsappConsent: whatsappAvailable && whatsappConsent, website: '' }),
      });
      const result = await response.json() as { reference?: string; error?: string; whatsappUpdate?: string };
      if (!response.ok || !result.reference) throw new Error(result.error || 'Could not save your request.');
      setReference(result.reference);
      setWhatsappUpdate(result.whatsappUpdate || 'not_queued');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save your request.');
    } finally { setBusy(false); }
  }

  const requestSummary = <dl className="request-summary">
    <div><dt>Service</dt><dd>{service}</dd></div>
    <div><dt>Guide price · not final</dt><dd>{selected.price}</dd></div>
    <div><dt>Typical work time</dt><dd>{selected.duration}</dd></div>
    <div><dt>Name</dt><dd>{name}</dd></div>
    <div><dt>WhatsApp</dt><dd>+91 {phone}</dd></div>
    <div><dt>Service area</dt><dd>{area}</dd></div>
    <div><dt>Preferred visit</dt><dd>{formattedDate} · {time}</dd></div>
    {notes && <div className="wide"><dt>Design or special request</dt><dd>{notes}</dd></div>}
  </dl>;

  return <main className="customer-request-page">
    <header><a href="/"><ArrowLeft size={19} /> Back to Sahaan</a><span>SAHAAN STUDIOS</span></header>
    <div className="customer-request-layout">
      <section className="request-intro"><p className="eyebrow">Hyderabad · home beauty</p><h1>{reference ? 'Request received.' : reviewing ? 'Review your request.' : 'Plan your nail appointment.'}</h1><p>{reference ? 'Your details are saved. Sahaan will check the work, travel and available artists before sending a final quote.' : reviewing ? 'Check every detail before you send your request. The price shown is a guide, not the amount you will pay.' : 'See a price and time guide, tell us when you prefer, and let Sahaan check an artist before you pay. A request is not a reserved slot.'}</p><div className="request-promise"><ShieldCheck size={19} /><span>No charge now · you approve the final total before payment</span></div></section>
      {reference ? <section className="request-card request-success" role="status"><span className="eyebrow">Request saved on Sahaan</span><h2>Your request is in review.</h2><p className="request-reference">Sahaan request ID <strong>{reference}</strong></p>{requestSummary}<div className="request-next"><strong>What happens next?</strong><ol><li>Sahaan checks the service, artist coverage, travel and final amount.</li><li>We share a private itemised payment link for you to review. No payment is due until you accept that quote.</li><li>After payment is verified, Sahaan finalises your professional and sends the booking update.</li></ol></div><p className="request-small">Your preferred time is not yet a reserved slot. {whatsappUpdate === 'queued' ? 'A WhatsApp acknowledgement was requested; you do not need to send these details again.' : 'Your request is saved on the website; you do not need to send it again on WhatsApp.'}</p><a className="request-secondary" href={sahaanWhatsAppUrl(whatsappMessage)} target="_blank" rel="noopener noreferrer"><MessageCircle size={18} /> Questions? Message Sahaan <ArrowRight size={16} /></a></section> : reviewing ? <section className="request-card request-review"><span className="eyebrow">2 · Confirm your details</span><h2>Is everything correct?</h2>{requestSummary}<p className="request-small">This is an enquiry, not a confirmed appointment or payment. Sahaan will contact you with the exact quote before you pay.</p>{error && <div className="request-error" role="alert">{error}</div>}<div className="request-review-actions"><button className="request-secondary" type="button" onClick={() => setReviewing(false)}>Edit details</button><button className="request-primary" type="button" disabled={busy} onClick={confirmRequest}>{busy ? 'Saving your request…' : storageReady === false ? 'Confirm and open WhatsApp' : 'Confirm and send request'} <ArrowRight size={18} /></button></div></section> : <form className="request-card" onSubmit={review}>
        {storageReady === false && <div className="request-guide" role="status"><strong>WhatsApp requests are available now.</strong><p>Website request saving is being set up. Complete the details below and continue to WhatsApp, then tap Send. No website reference will be created yet.</p></div>}
        <p className="eyebrow">1 · Choose the work</p><fieldset className="request-services"><legend>Service and guide price</legend>{customerServices.map((item) => <button type="button" key={item.name} className={service === item.name ? 'selected' : ''} aria-pressed={service === item.name} onClick={() => setService(item.name)}><strong>{item.name}</strong><b>{item.price}</b><small><Clock3 size={14} /> {item.duration}</small></button>)}</fieldset>
        <div className="request-guide"><strong>{selected.name}: {selected.price}</strong><span>Typical work time: {selected.duration}</span><p>{selected.details} These are planning guides, not a confirmed Sahaan quote. Travel, removal, extras and applicable taxes may change the total.</p></div>
        <p className="eyebrow">2 · Your preferred visit</p><div className="request-fields"><label>Your name <input value={name} onChange={(event) => setName(event.target.value)} required maxLength={100} autoComplete="name" placeholder="Full name" /></label><label>WhatsApp number <input value={phone} onChange={(event) => setPhone(event.target.value.replace(/\D/g, '').slice(0, 10))} required pattern="[6-9][0-9]{9}" inputMode="tel" autoComplete="tel-national" placeholder="10-digit mobile number" /></label><label className="wide">Hyderabad service area <input value={area} onChange={(event) => setArea(event.target.value)} required maxLength={200} placeholder="Area / landmark; share exact address privately later" /></label><label>Preferred date <input value={date} onChange={(event) => setDate(event.target.value)} required min={todayInHyderabad()} type="date" /></label><label>Preferred time window <select value={time} onChange={(event) => setTime(event.target.value)} required><option value="">Choose a window</option>{windows.map((window) => <option key={window}>{window}</option>)}</select></label><label className="wide">Design or special request <textarea value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={1000} rows={3} placeholder="Colour, length, removal, nail art or anything the artist should know" /></label></div>
        <label className="request-consent"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} required /><span>I agree Sahaan may use these details to respond to this request. I have read the <a href="/privacy" target="_blank">privacy policy</a>. This does not reserve a slot or authorize payment.</span></label>
        {whatsappAvailable && <label className="request-consent request-whatsapp-consent"><input type="checkbox" checked={whatsappConsent} onChange={(event) => setWhatsappConsent(event.target.checked)} /><span>Optional: I agree to receive WhatsApp updates about this request from Sahaan Studios at the number above. I can ask Sahaan to stop these updates at any time.</span></label>}
        {error && <div className="request-error" role="alert"><strong>{error}</strong><p>Your details were not confirmed as saved on the website. You can still send this request directly to Sahaan on WhatsApp.</p><a href={sahaanWhatsAppUrl(whatsappMessage)} target="_blank" rel="noopener noreferrer">Open WhatsApp and tap Send <ArrowRight size={16} /></a></div>}
        <button className="request-primary" disabled={storageReady === null} type="submit">{storageReady === null ? 'Checking request options…' : 'Review my details'} <ArrowRight size={18} /></button><p className="request-small">No payment now. Sahaan will check artist availability, service scope, travel and the final total with you.</p>
      </form>}
    </div>
  </main>;
}
