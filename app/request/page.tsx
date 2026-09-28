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
  const [busy, setBusy] = useState(false);
  const [storageReady, setStorageReady] = useState<boolean | null>(null);
  const [error, setError] = useState('');
  const [reference, setReference] = useState('');
  const selected = customerServices.find((item) => item.name === service) || customerServices[0];
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
      .then((response) => { if (active) setStorageReady(response.ok); })
      .catch(() => { if (active) setStorageReady(false); });
    return () => { active = false; };
  }, []);
  const whatsappMessage = reference
    ? `Hi Sahaan! My website request reference is ${reference}. Service: ${service}. Preferred date: ${date}, time: ${time}. Please check my request and confirm the artist, exact work, travel and final price before booking.`
    : `Hi Sahaan! I could not save a website request. Service: ${service}. Name: ${name}. WhatsApp: +91 ${phone}. Hyderabad area: ${area}. Preferred date: ${date}. Preferred time: ${time}. Work/design: ${notes || 'I will describe or share a photo here.'} Please confirm the final quote before booking.`;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    if (storageReady === false) {
      window.location.href = sahaanWhatsAppUrl(whatsappMessage);
      return;
    }
    setBusy(true);
    try {
      const response = await fetch('/api/customer-requests/', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name, phone: `91${phone.replace(/\D/g, '')}`, service, area, date, time, notes, consent, website: '' }),
      });
      const result = await response.json() as { reference?: string; error?: string };
      if (!response.ok || !result.reference) throw new Error(result.error || 'Could not save your request.');
      setReference(result.reference);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save your request.');
    } finally { setBusy(false); }
  }

  return <main className="customer-request-page">
    <header><a href="/"><ArrowLeft size={19} /> Back to Sahaan</a><span>SAHAAN STUDIOS</span></header>
    <div className="customer-request-layout">
      <section className="request-intro"><p className="eyebrow">Hyderabad · home beauty</p><h1>Plan your nail appointment.</h1><p>See a price and time guide, tell us when you prefer, and let Sahaan check an artist before you pay. A request is not a reserved slot.</p><div className="request-promise"><ShieldCheck size={19} /><span>No charge now · final total and artist confirmed before booking</span></div></section>
      {reference ? <section className="request-card request-success" role="status"><span className="eyebrow">Request saved on Sahaan</span><h2>We have your details.</h2><p>Your reference is <strong>{reference}</strong>. Please open WhatsApp and tap Send so our team has the same details in the active conversation. Opening WhatsApp alone does not send the message.</p><a className="request-primary" href={sahaanWhatsAppUrl(whatsappMessage)} target="_blank" rel="noopener noreferrer"><MessageCircle size={19} /> Continue in WhatsApp <ArrowRight size={18} /></a><p className="request-small">Preferred time is a request, not confirmed availability. We’ll confirm the full price before asking you to pay.</p></section> : <form className="request-card" onSubmit={submit}>
        {storageReady === false && <div className="request-guide" role="status"><strong>WhatsApp requests are available now.</strong><p>Website request saving is being set up. Complete the details below and continue to WhatsApp, then tap Send. No website reference will be created yet.</p></div>}
        <p className="eyebrow">1 · Choose the work</p><fieldset className="request-services"><legend>Service and guide price</legend>{customerServices.map((item) => <button type="button" key={item.name} className={service === item.name ? 'selected' : ''} aria-pressed={service === item.name} onClick={() => setService(item.name)}><strong>{item.name}</strong><b>{item.price}</b><small><Clock3 size={14} /> {item.duration}</small></button>)}</fieldset>
        <div className="request-guide"><strong>{selected.name}: {selected.price}</strong><span>Typical work time: {selected.duration}</span><p>{selected.details} These are planning guides, not a confirmed Sahaan quote. Travel, removal, extras and applicable taxes may change the total.</p></div>
        <p className="eyebrow">2 · Your preferred visit</p><div className="request-fields"><label>Your name <input value={name} onChange={(event) => setName(event.target.value)} required maxLength={100} autoComplete="name" placeholder="Full name" /></label><label>WhatsApp number <input value={phone} onChange={(event) => setPhone(event.target.value.replace(/\D/g, '').slice(0, 10))} required pattern="[6-9][0-9]{9}" inputMode="tel" autoComplete="tel-national" placeholder="10-digit mobile number" /></label><label className="wide">Hyderabad service area <input value={area} onChange={(event) => setArea(event.target.value)} required maxLength={200} placeholder="Area / landmark; share exact address privately later" /></label><label>Preferred date <input value={date} onChange={(event) => setDate(event.target.value)} required min={todayInHyderabad()} type="date" /></label><label>Preferred time window <select value={time} onChange={(event) => setTime(event.target.value)} required><option value="">Choose a window</option>{windows.map((window) => <option key={window}>{window}</option>)}</select></label><label className="wide">Design or special request <textarea value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={1000} rows={3} placeholder="Colour, length, removal, nail art or anything the artist should know" /></label></div>
        <label className="request-consent"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} required /><span>I agree Sahaan may use these details to respond to this request. I have read the <a href="/privacy" target="_blank">privacy policy</a>. This does not reserve a slot or authorize payment.</span></label>
        {error && <div className="request-error" role="alert"><strong>{error}</strong><p>Your details were not confirmed as saved on the website. You can still send this request directly to Sahaan on WhatsApp.</p><a href={sahaanWhatsAppUrl(whatsappMessage)} target="_blank" rel="noopener noreferrer">Open WhatsApp and tap Send <ArrowRight size={16} /></a></div>}
        <button className="request-primary" disabled={busy || storageReady === null} type="submit">{storageReady === null ? 'Checking request options…' : busy ? 'Saving your request…' : storageReady ? 'Save request on Sahaan' : 'Continue to WhatsApp'} <ArrowRight size={18} /></button><p className="request-small">No payment now. Sahaan will check artist availability, service scope, travel and the final total with you.</p>
      </form>}
    </div>
  </main>;
}
