'use client';

import { useEffect, useState } from 'react';

type AdminQuote = { id: string; customer_name: string; service: string; appointment_window: string; total_paise: number; status: string; paid_at: string | null; artist_name: string | null };
type Notification = { quote_id: string; kind: string; state: string; attempts: number; last_error: string | null };
const money = (paise: number) => `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

export default function BookingDeskPage() {
  const [token, setToken] = useState('');
  const [message, setMessage] = useState('');
  const [checkoutUrl, setCheckoutUrl] = useState('');
  const [mode, setMode] = useState<'disabled' | 'test' | 'live'>('disabled');
  const [quotes, setQuotes] = useState<AdminQuote[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [form, setForm] = useState({ customerName: '', customerPhone: '', service: 'Gel polish', scope: '', serviceAddress: '', appointmentWindow: '', serviceRupees: '', travelRupees: '', extrasRupees: '0', taxRupees: '0' });
  const [coverageConfirmed, setCoverageConfirmed] = useState(false);
  const [assignment, setAssignment] = useState({ reference: '', artistName: '', artistPhone: '', artistConsented: false });

  useEffect(() => {
    fetch('/api/managed-bookings/health', { cache: 'no-store' })
      .then((response) => response.json() as Promise<{ enabled: boolean; testMode: boolean }>)
      .then((health: { enabled: boolean; testMode: boolean }) => setMode(health.enabled ? health.testMode ? 'test' : 'live' : 'disabled'))
      .catch(() => setMode('disabled'));
  }, []);

  async function api<T extends { error?: string }>(path: string, options: RequestInit = {}): Promise<T> {
    const headers = new Headers(options.headers);
    headers.set('authorization', `Bearer ${token}`);
    headers.set('content-type', 'application/json');
    const response = await fetch(`/api/managed-bookings${path}`, {
      ...options, cache: 'no-store',
      headers,
    });
    const data = await response.json() as T;
    if (!response.ok) throw new Error(data.error || 'Request failed');
    return data;
  }

  async function refresh() {
    try {
      const data = await api<{ quotes: AdminQuote[]; notifications: Notification[]; error?: string }>('/admin/quotes');
      setQuotes(data.quotes); setNotifications(data.notifications); setMessage('Booking list updated.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not load bookings'); }
  }

  async function create(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault(); setMessage('');
    try {
      const toPaise = (value: string) => {
        const amount = Number(value);
        if (!Number.isFinite(amount) || amount < 0 || !Number.isInteger(amount * 100)) throw new Error('Use valid amounts with at most two decimals');
        return Math.round(amount * 100);
      };
      const data = await api<{ checkoutUrl: string; error?: string }>('/admin/quotes', { method: 'POST', body: JSON.stringify({
        customerName: form.customerName, customerPhone: form.customerPhone.replace(/\D/g, ''),
        service: form.service, scope: form.scope, serviceAddress: form.serviceAddress,
        appointmentWindow: form.appointmentWindow,
        coverageConfirmed, servicePaise: toPaise(form.serviceRupees), travelPaise: toPaise(form.travelRupees),
        extrasPaise: toPaise(form.extrasRupees), taxPaise: toPaise(form.taxRupees),
      }) });
      setCheckoutUrl(data.checkoutUrl);
      setMessage(mode === 'test' ? 'Simulated test quote created. Do not send the link to a customer.' : 'Private quote created. Review the link, then send it only to this customer.');
      await refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not create quote'); }
  }

  async function assign(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault(); setMessage('');
    try {
      await api<{ status: string; error?: string }>('/admin/assign', { method: 'POST', body: JSON.stringify({ ...assignment, artistPhone: assignment.artistPhone.replace(/\D/g, '') }) });
      setMessage(mode === 'test' ? 'Simulated test assignment saved. No WhatsApp message was sent.' : 'Artist assigned. WhatsApp submissions are queued and will retry if the API rejects them. Confirm delivery and acknowledgement manually.');
      await refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not assign artist'); }
  }

  return <main className="booking-desk">
    <h1>Sahaan booking desk</h1>
    <p>Private founder workflow. The access token stays in this tab only and is not stored by the browser. Never share it with a customer or artist.</p>
    {mode === 'test' ? <p className="managed-booking-test"><strong>TEST MODE — no real payment or appointment.</strong> Use only synthetic details: customer name and address beginning “TEST ”, customer phone 919999999999; test artist name beginning “TEST ” and phone 919999999998. No WhatsApp is sent. Never share a test quote with a real customer.</p> : mode === 'disabled' ? <p className="managed-booking-test"><strong>Payment booking is currently off.</strong> Creating quotes and taking payment are disabled until the private setup is complete.</p> : null}
    <label>Admin access token<input type="password" autoComplete="off" value={token} onChange={(event) => setToken(event.target.value)} /></label>
    <button type="button" onClick={refresh} disabled={!token}>Load requests</button>
    {message && <output>{message}</output>}
    <section><h2>{mode === 'test' ? 'Create a simulated test quote' : 'Create a final customer quote'}</h2><p>{mode === 'test' ? 'Use fictional details only. This quote tests the checkout and must not be shared with a customer.' : 'For a listed service, the service component plus travel allocation must equal Sahaan’s published price: ₹599 gel polish, ₹999 manicure or ₹1,399 extensions. Travel is included, not added on top. Check artist coverage and obtain approval for any optional extras before sharing a payment link.'}</p>
      <form onSubmit={create}>
        {([['customerName','Customer name'],['customerPhone','Customer WhatsApp, 91 + 10 digits'],['service','Service'],['scope','Included work and exclusions'],['serviceAddress','Full service address'],['appointmentWindow','Proposed date and time window'],['serviceRupees','Service component ₹'],['travelRupees','Travel allocation ₹ — inside listed price'],['extrasRupees','Customer-approved extras ₹'],['taxRupees','Applicable taxes ₹']] as const).map(([key,label]) => <label key={key}>{label}<input required value={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.value })} /></label>)}
        <label><span>Quote readiness</span><span><input type="checkbox" required checked={coverageConfirmed} onChange={(event) => setCoverageConfirmed(event.target.checked)} /> {mode === 'test' ? 'I am using fictional data for this simulation.' : 'I checked an eligible artist’s rate, travel and availability for this final total.'}</span></label>
        <button disabled={!token || mode === 'disabled'}>{mode === 'test' ? 'Create test quote' : 'Create private quote'}</button>
      </form>
      {checkoutUrl && <p className="booking-desk-link"><strong>{mode === 'test' ? 'Internal test link:' : 'Customer payment link:'}</strong> <a href={checkoutUrl} target="_blank" rel="noopener noreferrer">{checkoutUrl}</a></p>}
    </section>
    <section><h2>Paid requests awaiting an artist</h2>
      {quotes.length === 0 ? <p>Load requests to see the queue.</p> : <ul>{quotes.map((quote) => <li key={quote.id}><strong>{quote.customer_name} · {quote.service}</strong><span>{money(quote.total_paise)} · {quote.status} · {quote.appointment_window}</span><code>{quote.id}</code><small>WhatsApp updates: {notifications.filter((notice) => notice.quote_id === quote.id).map((notice) => `${notice.kind}: ${notice.state}${notice.last_error ? ' (needs attention)' : ''}`).join(' · ') || 'none yet'}</small></li>)}</ul>}
      <form onSubmit={assign}>
        <label>Paid request reference<input required value={assignment.reference} onChange={(event) => setAssignment({ ...assignment, reference: event.target.value })} /></label>
        <label>Approved professional name<input required value={assignment.artistName} onChange={(event) => setAssignment({ ...assignment, artistName: event.target.value })} /></label>
        <label>Professional WhatsApp, 91 + 10 digits<input required value={assignment.artistPhone} onChange={(event) => setAssignment({ ...assignment, artistPhone: event.target.value })} /></label>
        <label><span>Professional consent</span><span><input type="checkbox" required checked={assignment.artistConsented} onChange={(event) => setAssignment({ ...assignment, artistConsented: event.target.checked })} /> {mode === 'test' ? 'This is a fictional test artist; no WhatsApp will be sent.' : 'The professional agreed to receive this assignment and customer contact on WhatsApp.'}</span></label>
        <button disabled={!token || mode === 'disabled'}>{mode === 'test' ? 'Record test assignment' : 'Assign artist and queue WhatsApp updates'}</button>
      </form>
    </section>
  </main>;
}
