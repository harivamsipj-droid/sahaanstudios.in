'use client';

import { useState } from 'react';

type CustomerRequest = {
  reference: string; customer_name: string; customer_phone: string; service: string;
  area: string; preferred_date: string; preferred_time: string; notes: string;
  status: string; created_at: string; whatsapp_status: string | null; whatsapp_error: string | null;
};

export default function CustomerRequestsPage() {
  const [token, setToken] = useState('');
  const [requests, setRequests] = useState<CustomerRequest[]>([]);
  const [message, setMessage] = useState('');

  async function load() {
    setMessage('');
    try {
      const response = await fetch('/api/customer-requests/admin', {
        headers: { authorization: `Bearer ${token}` }, cache: 'no-store',
      });
      const result = await response.json() as { requests?: CustomerRequest[]; error?: string };
      if (!response.ok) throw new Error(result.error || 'Could not load requests');
      setRequests(result.requests || []);
      setMessage(`${result.requests?.length || 0} recent requests loaded. Confirm WhatsApp contact and artist availability manually.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not load requests'); }
  }

  return <main className="booking-desk"><h1>Customer requests</h1><p>Private Sahaan inbox. These are enquiries, not confirmed appointments or payments. The access token remains only in this tab.</p><label>Admin access token<input type="password" autoComplete="off" value={token} onChange={(event) => setToken(event.target.value)} /></label><button disabled={!token} onClick={load}>Load recent requests</button>{message && <output>{message}</output>}<section><h2>Website enquiries</h2>{requests.length === 0 ? <p>No requests loaded.</p> : <ul>{requests.map((item) => <li key={item.reference}><strong>{item.reference} · {item.customer_name} · {item.service}</strong><span>+{item.customer_phone} · {item.area}</span><span>{item.preferred_date} · {item.preferred_time}</span>{item.notes && <span>Work: {item.notes}</span>}{item.whatsapp_status && <small>WhatsApp: {item.whatsapp_status === 'submitted' ? 'submitted to Meta; delivery not yet verified' : item.whatsapp_status}{item.whatsapp_error ? ` · ${item.whatsapp_error}` : ''}</small>}<small>{item.status} · received {new Date(item.created_at).toLocaleString('en-IN')}</small></li>)}</ul>}</section></main>;
}
