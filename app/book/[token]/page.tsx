'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type Quote = {
  reference: string; customerName: string; service: string; scope: string;
  serviceAddress: string; appointmentWindow: string; servicePaise: number;
  travelPaise: number; extrasPaise: number; taxPaise: number; totalPaise: number;
  status: string; expiresAt: string; artistName: string | null; testMode: boolean;
};

type RazorpayResult = { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string };
type RazorpayWindow = Window & { Razorpay?: new (options: Record<string, unknown>) => { open(): void } };

const money = (paise: number) => `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

async function loadCheckout(): Promise<void> {
  if ((window as RazorpayWindow).Razorpay) return;
  await new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Could not load secure checkout'));
    document.head.appendChild(script);
  });
}

export default function ManagedBookingPage() {
  const [quote, setQuote] = useState<Quote | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [verificationPending, setVerificationPending] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const token = typeof window === 'undefined' ? '' : window.location.pathname.split('/').pop() || '';

  useEffect(() => {
    if (!token) return;
    fetch(`/api/managed-bookings/quote?token=${encodeURIComponent(token)}`, { cache: 'no-store' })
      .then(async (response) => {
        const result = await response.json() as Quote & { error?: string };
        if (!response.ok) throw new Error(result.error || 'Quote unavailable');
        setQuote(result);
      }).catch((reason) => setError(reason.message));
  }, [token]);

  async function pay() {
    if (!quote || !accepted || busy) return;
    setBusy(true); setError('');
    try {
      const orderResponse = await fetch('/api/managed-bookings/order', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token, consent: accepted }),
      });
      const order = await orderResponse.json() as { keyId: string; amount: number; orderId: string; error?: string };
      if (!orderResponse.ok) throw new Error(order.error || 'Could not start payment');
      await loadCheckout();
      const Checkout = (window as RazorpayWindow).Razorpay;
      if (!Checkout) throw new Error('Secure checkout unavailable');
      new Checkout({
        key: order.keyId, amount: order.amount, currency: 'INR', order_id: order.orderId,
        name: 'Sahaan Studios', description: `${quote.service} · ${quote.reference.slice(0, 8).toUpperCase()}`,
        prefill: { name: quote.customerName },
        theme: { color: '#75532d' },
        modal: { ondismiss: () => setBusy(false) },
        handler: async (payment: RazorpayResult) => {
          try {
            const verifyResponse = await fetch('/api/managed-bookings/verify', {
              method: 'POST', headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ token, orderId: payment.razorpay_order_id,
                paymentId: payment.razorpay_payment_id, signature: payment.razorpay_signature }),
            });
            const result = await verifyResponse.json() as { status: string; error?: string };
            if (verifyResponse.status === 202) {
              setVerificationPending(true);
              setError('Your bank response is being verified. Please do not pay again. Contact Sahaan with this reference if it stays pending.');
            } else if (!verifyResponse.ok) {
              throw new Error(result.error || 'Payment verification pending');
            } else {
              setQuote((current) => current ? { ...current, status: result.status } : current);
            }
          } catch (reason) {
            setVerificationPending(true);
            setError(`${reason instanceof Error ? reason.message : 'Verification pending'}. Do not retry; contact Sahaan with your reference.`);
          } finally { setBusy(false); }
        },
      }).open();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not start payment');
      setBusy(false);
    }
  }

  return <main className="managed-booking-page">
    <header><Link href="/" aria-label="Sahaan Studios home">SAHAAN <span>STUDIOS</span></Link><span>{quote?.testMode ? 'Payment test · no real booking' : 'Secure booking request'}</span></header>
    <section className="managed-booking-card">
      {quote?.testMode && <output className="managed-booking-test"><strong>TEST MODE — no real payment or appointment.</strong> This checkout is for Sahaan’s internal testing only. No artist will be booked and no WhatsApp confirmation will be sent. Do not enter a real customer’s details.</output>}
      <p className="eyebrow">Sahaan managed booking</p>
      <h1>{quote?.testMode ? quote.status === 'paid_unassigned' || quote.status === 'assigned' ? 'Test payment recorded.' : 'Review a test quote.' : quote?.status === 'refunded' ? 'Your refund was processed.' : quote?.status === 'assigned' ? 'Your artist is confirmed.' : quote?.status === 'paid_unassigned' ? 'Payment received. We’re matching your artist.' : 'Review your quote.'}</h1>
      {error && <p className="managed-booking-error" role="alert">{error}</p>}
      {!quote && !error && <p>Loading your private quote…</p>}
      {quote && <>
        <p className="managed-booking-intro">Reference {quote.reference.slice(0, 8).toUpperCase()} · {quote.customerName}</p>
        <dl className="managed-booking-details">
          <div><dt>Service</dt><dd>{quote.service}</dd></div>
          <div><dt>Work included</dt><dd>{quote.scope}</dd></div>
          <div><dt>Requested appointment</dt><dd>{quote.appointmentWindow}</dd></div>
          <div><dt>Service address</dt><dd>{quote.serviceAddress}</dd></div>
          {quote.artistName && <div><dt>Assigned professional</dt><dd>{quote.artistName}</dd></div>}
        </dl>
        <div className="managed-booking-total">
          <div><span>Service including travel</span><strong>{money(quote.servicePaise + quote.travelPaise)}</strong></div>
          {quote.extrasPaise > 0 && <div><span>Agreed extras</span><strong>{money(quote.extrasPaise)}</strong></div>}
          {quote.taxPaise > 0 && <div><span>Applicable taxes</span><strong>{money(quote.taxPaise)}</strong></div>}
          <div className="final"><span>{quote.testMode ? 'Simulated total' : 'Total to pay'}</span><strong>{money(quote.totalPaise)}</strong></div>
        </div>
        {['quoted', 'payment_pending'].includes(quote.status) ? <>
          <p className="managed-booking-notice">{quote.testMode ? 'This simulated transaction checks the payment connection only. It does not reserve a professional or charge real money.' : <>Sahaan will finalise the professional <strong>after payment</strong>. Payment confirms a managed request, not a named artist or a completed service. If Sahaan cannot arrange the agreed appointment, you may choose a replacement or a full refund.</>}</p>
          <label className="managed-booking-consent"><input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} /><span>{quote.testMode ? 'I understand this is a simulated payment with no real appointment or WhatsApp notification.' : <>I approve this total and agree to receive booking updates on WhatsApp. I understand the <Link href="/cancellation-refunds" target="_blank">cancellation and refund policy</Link> and <Link href="/terms" target="_blank">terms</Link>.</>}</span></label>
          <button type="button" disabled={!accepted || busy || verificationPending || new Date(quote.expiresAt) < new Date()} onClick={pay}>{verificationPending ? 'Payment verification pending' : busy ? 'Opening secure checkout…' : quote.testMode ? `Run simulated payment · ${money(quote.totalPaise)}` : `Pay ${money(quote.totalPaise)} securely`}</button>
          <small>Quote expires {new Date(quote.expiresAt).toLocaleString('en-IN')}. {quote.testMode ? 'Use Razorpay test payment details only; do not use a real card.' : 'Payment is handled by Razorpay; Sahaan never sees your card PIN or OTP.'}</small>
        </> : <p className="managed-booking-notice">{quote.testMode ? 'The test transaction was recorded. It is not a customer booking, and no WhatsApp update was sent.' : quote.status === 'refunded' ? 'The full refund has been processed to your original payment method. Bank credit timing may vary.' : quote.status === 'assigned' ? 'Sahaan has assigned your professional. Please check your WhatsApp booking update.' : 'Sahaan has received your payment and will confirm the professional on WhatsApp. Please do not pay again.'}</p>}
      </>}
      <a className="managed-booking-help" href="https://wa.me/918143072723" target="_blank" rel="noopener noreferrer">Questions? Message Sahaan on WhatsApp</a>
    </section>
  </main>;
}
