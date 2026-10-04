'use client';

import { useEffect, useState } from 'react';

type AdminQuote = { id: string; customer_name: string; customer_phone: string; service: string; scope: string; service_address: string; appointment_window: string; total_paise: number; status: string; paid_at: string | null; confirmation_by: string | null; artist_name: string | null; artist_phone: string | null };
type Notification = { quote_id: string; kind: string; state: string; attempts: number; last_error: string | null; sent_at: string | null };
const money = (paise: number) => `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
const indiaTime = (date: string) => new Date(date).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' });

export default function BookingDeskPage() {
  const [token, setToken] = useState('');
  const [message, setMessage] = useState('');
  const [checkoutUrl, setCheckoutUrl] = useState('');
  const [mode, setMode] = useState<'disabled' | 'test' | 'live'>('disabled');
  const [manualPilot, setManualPilot] = useState(false);
  const [paymentsOpen, setPaymentsOpen] = useState(false);
  const [quotes, setQuotes] = useState<AdminQuote[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [form, setForm] = useState({ customerName: '', customerPhone: '', service: 'Gel polish', scope: '', serviceAddress: '', appointmentWindow: '', serviceRupees: '', travelRupees: '', extrasRupees: '0', taxRupees: '0' });
  const [coverageConfirmed, setCoverageConfirmed] = useState(false);
  const [assignment, setAssignment] = useState({ reference: '', artistName: '', artistPhone: '', artistConsented: false });

  useEffect(() => {
    fetch('/api/managed-bookings/health', { cache: 'no-store' })
      .then((response) => response.json() as Promise<{ enabled: boolean; testMode: boolean; manualPilot?: boolean; paymentsOpen?: boolean }>)
      .then((health) => { setMode(health.enabled ? health.testMode ? 'test' : 'live' : 'disabled'); setManualPilot(Boolean(health.manualPilot)); setPaymentsOpen(Boolean(health.paymentsOpen)); })
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

  async function checkStorage() {
    try {
      const data = await api<{ storage: string; paymentsEnabled: boolean; liveReadinessIssues: string[]; error?: string }>('/admin/storage-check');
      setMessage(data.storage === 'ready'
        ? `Booking database read/write check passed. The probe was rolled back; no quote was created. ${data.liveReadinessIssues.length ? `Live setup still needs: ${data.liveReadinessIssues.join('; ')}.` : 'Live configuration checks passed; payments remain off until explicitly enabled.'}`
        : 'Booking database check did not pass.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not check booking storage'); }
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
      await refresh();
      setMessage(mode === 'test' ? 'Simulated test quote created. Do not send the link to a customer.' : 'Private quote created. Review the link, then send it only to this customer.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not create quote'); }
  }

  async function assign(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault(); setMessage('');
    try {
      await api<{ status: string; error?: string }>('/admin/assign', { method: 'POST', body: JSON.stringify({ ...assignment, artistPhone: assignment.artistPhone.replace(/\D/g, '') }) });
      await refresh();
      setMessage(mode === 'test' ? 'Simulated test assignment saved. No WhatsApp message was sent.' : manualPilot ? 'Artist assigned. Send both WhatsApp messages yourself below, then mark each as sent.' : 'Artist assigned. WhatsApp submissions are queued and will retry if the API rejects them. Confirm delivery and acknowledgement manually.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not assign artist'); }
  }

  async function markManualSent(reference: string, kind: 'assigned_customer' | 'assigned_artist') {
    try {
      await api<{ status: string; error?: string }>('/admin/notifications/manual-sent', { method: 'POST',
        body: JSON.stringify({ reference, kind, sentConfirmed: true }) });
      await refresh();
      setMessage('Manual WhatsApp confirmation recorded.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not record confirmation'); }
  }

  async function copyMessage(value: string) {
    try { await navigator.clipboard.writeText(value); setMessage('Message copied. Paste it into the correct chat in your WhatsApp Business app, send it, then mark it sent here.'); }
    catch { setMessage('Could not copy. Please select the message text and copy it manually.'); }
  }

  function manualMessage(quote: AdminQuote, kind: 'assigned_customer' | 'assigned_artist') {
    const reference = quote.id.slice(0, 8).toUpperCase();
    return kind === 'assigned_customer'
      ? `Hi ${quote.customer_name}, your Sahaan booking ${reference} is confirmed for ${quote.service} (${quote.appointment_window}). Your professional is ${quote.artist_name}. We received your payment of ${money(quote.total_paise)}. Reply here if you need help.`
      : `Hi ${quote.artist_name}, Sahaan booking ${reference}: ${quote.service} for ${quote.customer_name}, ${quote.appointment_window}. Work: ${quote.scope}. Address: ${quote.service_address}. Customer contact: +${quote.customer_phone}. Please acknowledge this confirmed assignment.`;
  }

  return <main className="booking-desk">
    <h1>Sahaan booking desk</h1>
    <p>Private founder workflow. The access token stays in this tab only and is not stored by the browser. Never share it with a customer or artist.</p>
    {mode === 'test' ? <p className="managed-booking-test"><strong>TEST MODE — no real payment or appointment.</strong> Use only synthetic details: customer name and address beginning “TEST ”, customer phone 919999999999; test artist name beginning “TEST ” and phone 919999999998. No WhatsApp is sent. Never share a test quote with a real customer.</p> : mode === 'disabled' ? <p className="managed-booking-test"><strong>Payment booking is currently off.</strong> Creating quotes and taking payment are disabled until the private setup is complete.</p> : null}
    {manualPilot && <p className="managed-booking-operations"><strong>Manual WhatsApp pilot · 10:00 am–11:00 pm IST daily.</strong> Keep this queue staffed. Assign the artist and send the customer confirmation within two staffed hours of payment. If the agreed service cannot be arranged, contact the customer within that window and offer another time or a full refund. The website does not send WhatsApp automatically.</p>}
    {manualPilot && !paymentsOpen && <p className="managed-booking-test"><strong>Pilot end date reached.</strong> New quotes and payments are off; continue resolving existing paid requests and review the workflow before reopening.</p>}
    <label>Admin access token<input type="password" autoComplete="off" value={token} onChange={(event) => setToken(event.target.value)} /></label>
    <button type="button" onClick={refresh} disabled={!token}>Load requests</button>
    <button type="button" onClick={checkStorage} disabled={!token}>Check booking storage</button>
    {message && <output>{message}</output>}
    <section><h2>{mode === 'test' ? 'Create a simulated test quote' : 'Create a final customer quote'}</h2><p>{mode === 'test' ? 'Use fictional details only. This quote tests the checkout and must not be shared with a customer.' : 'For a listed service, the service component plus travel allocation must equal Sahaan’s published price: ₹599 gel polish, ₹999 manicure or ₹1,399 extensions. Travel is included, not added on top. Check artist coverage and obtain approval for any optional extras before sharing a payment link.'}</p>
      <form onSubmit={create}>
        {([['customerName','Customer name'],['customerPhone','Customer WhatsApp, 91 + 10 digits'],['service','Service'],['scope','Included work and exclusions'],['serviceAddress','Full service address'],['appointmentWindow','Proposed date and time window'],['serviceRupees','Service component ₹'],['travelRupees','Travel allocation ₹ — inside listed price'],['extrasRupees','Customer-approved extras ₹'],['taxRupees','Applicable taxes ₹']] as const).map(([key,label]) => <label key={key}>{label}<input required value={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.value })} /></label>)}
        <label><span>Quote readiness</span><span><input type="checkbox" required checked={coverageConfirmed} onChange={(event) => setCoverageConfirmed(event.target.checked)} /> {mode === 'test' ? 'I am using fictional data for this simulation.' : 'I checked an eligible artist’s rate, travel and availability for this final total.'}</span></label>
        <button disabled={!token || mode === 'disabled' || !paymentsOpen}>{mode === 'test' ? 'Create test quote' : 'Create private quote'}</button>
      </form>
      {checkoutUrl && <p className="booking-desk-link"><strong>{mode === 'test' ? 'Internal test link:' : 'Customer payment link:'}</strong> <a href={checkoutUrl} target="_blank" rel="noopener noreferrer">{checkoutUrl}</a></p>}
    </section>
    <section><h2>Paid requests awaiting an artist</h2>
      {quotes.length === 0 ? <p>Load requests to see the queue.</p> : <ul>{quotes.map((quote) => {
        const customerSent = notifications.some((item) => item.quote_id === quote.id && item.kind === 'assigned_customer' && item.state === 'manual_sent');
        const overdue = manualPilot && ['paid_unassigned', 'assigned'].includes(quote.status) && !customerSent
          && quote.confirmation_by && Date.now() > Date.parse(quote.confirmation_by);
        return <li key={quote.id}><strong>{quote.customer_name} · {quote.service}</strong><span>{money(quote.total_paise)} · {quote.status} · {quote.appointment_window}</span><code>{quote.id}</code>
          {manualPilot && quote.paid_at && <strong className={overdue ? 'booking-desk-overdue' : ''}>Confirmation due {quote.confirmation_by ? indiaTime(quote.confirmation_by) : 'soon'}{overdue ? ' · OVERDUE — contact the customer now' : ''}</strong>}
          {manualPilot && quote.status === 'paid_unassigned' && <span>Customer WhatsApp: +{quote.customer_phone} · Assign an artist, or contact the customer about a new time/full refund. <button type="button" onClick={() => setAssignment({ ...assignment, reference: quote.id })}>Use this reference</button></span>}
          {manualPilot && quote.status === 'assigned' && (['assigned_customer', 'assigned_artist'] as const).map((kind) => {
            const notice = notifications.find((item) => item.quote_id === quote.id && item.kind === kind);
            const text = manualMessage(quote, kind);
            return <div className="booking-desk-manual" key={kind}><strong>{kind === 'assigned_customer' ? `Customer · +${quote.customer_phone}` : `Professional · +${quote.artist_phone}`}</strong>
              <p>{text}</p><span>{notice?.state === 'manual_sent' ? `Marked sent ${notice.sent_at ? indiaTime(notice.sent_at) : ''}` : 'Not yet marked sent'}</span>
              {notice?.state === 'manual_pending' && <div className="booking-desk-manual-actions"><button type="button" onClick={() => copyMessage(text)}>Copy message</button><button type="button" onClick={() => markManualSent(quote.id, kind)}>I sent this in WhatsApp</button></div>}
            </div>;
          })}
          {!manualPilot && <small>WhatsApp updates: {notifications.filter((notice) => notice.quote_id === quote.id).map((notice) => `${notice.kind}: ${notice.state}${notice.last_error ? ' (needs attention)' : ''}`).join(' · ') || 'none yet'}</small>}
        </li>;
      })}</ul>}
      <form onSubmit={assign}>
        <label>Paid request reference<input required value={assignment.reference} onChange={(event) => setAssignment({ ...assignment, reference: event.target.value })} /></label>
        <label>Approved professional name<input required value={assignment.artistName} onChange={(event) => setAssignment({ ...assignment, artistName: event.target.value })} /></label>
        <label>Professional WhatsApp, 91 + 10 digits<input required value={assignment.artistPhone} onChange={(event) => setAssignment({ ...assignment, artistPhone: event.target.value })} /></label>
        <label><span>Professional acceptance</span><span><input type="checkbox" required checked={assignment.artistConsented} onChange={(event) => setAssignment({ ...assignment, artistConsented: event.target.checked })} /> {mode === 'test' ? 'This is a fictional test artist; no WhatsApp will be sent.' : 'The professional accepted the scope, time, rate and travel, and agreed to receive the customer’s contact and address.'}</span></label>
        <button disabled={!token || mode === 'disabled'}>{mode === 'test' ? 'Record test assignment' : manualPilot ? 'Assign artist · then send WhatsApp manually' : 'Assign artist and queue WhatsApp updates'}</button>
      </form>
    </section>
  </main>;
}
