'use client';

import { FormEvent, useState } from 'react';
import { ArrowLeft, ArrowRight, BadgeCheck, Banknote, Building2, Check, Clock3, ExternalLink, FileCheck2, Home, MessageCircle, Search, ShieldCheck, Sparkles, Star, TrendingUp, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { GooglePlaceResult, GooglePlaceSearchResponse } from '@/lib/google-place-types';
import { SAHAAN_WHATSAPP_DISPLAY, sahaanWhatsAppUrl } from '@/lib/contact';

const joinMessage = (listing?: GooglePlaceResult | null) => `Hi Sahaan Studios, I would like to join as a nail/beauty professional in Hyderabad.\n\nMy name: \nArea and PIN code: \nServices I offer: \nYears of experience: \nPortfolio link (if available): \n${listing ? `My Google Business Profile: ${listing.mapsUrl}\n` : ''}\nI will attach 3–5 clear photos of my own work here in WhatsApp. Please tell me the next steps.`;

export default function PartnersPage() {
  const [bookings, setBookings] = useState(12);
  const [averagePrice, setAveragePrice] = useState(1499);
  const [lookupPin, setLookupPin] = useState('');
  const [lookupName, setLookupName] = useState('');
  const [lookupPlaces, setLookupPlaces] = useState<GooglePlaceResult[]>([]);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState('');
  const [selectedListing, setSelectedListing] = useState<GooglePlaceResult | null>(null);
  const monthlyGross = bookings * averagePrice;
  const commission = Math.round(monthlyGross * .18);
  const partnerEarnings = monthlyGross - commission;
  const applicationUrl = sahaanWhatsAppUrl(joinMessage(selectedListing));

  async function findGoogleProfile(event: FormEvent) {
    event.preventDefault();
    if (!/^\d{6}$/.test(lookupPin)) {
      setLookupError('Enter a valid 6-digit Hyderabad PIN code.');
      return;
    }
    setLookupLoading(true);
    setLookupError('');
    try {
      const response = await fetch(`/api/google-professionals?pin=${encodeURIComponent(lookupPin)}&service=Beauty%20salon&name=${encodeURIComponent(lookupName)}`, { cache: 'no-store' });
      const body = await response.json() as GooglePlaceSearchResponse & { error?: string };
      if (!response.ok) throw new Error(body.error || 'Unable to search Google Maps right now.');
      setLookupPlaces(body.places.slice(0, 6));
    } catch (reason) {
      setLookupPlaces([]);
      setLookupError(reason instanceof Error ? reason.message : 'Unable to search Google Maps right now.');
    } finally {
      setLookupLoading(false);
    }
  }

  function useGoogleListing(place: GooglePlaceResult) {
    setSelectedListing(place);
    document.getElementById('application')?.scrollIntoView({ behavior: 'smooth' });
  }

  return <main className="partner-page">
    <header className="market-header inner-header professional-header"><a className="market-brand" href="/partners"><span className="market-monogram">S</span><span><strong>SAHAAN</strong><small>PROFESSIONAL NETWORK</small></span></a><nav className="desktop-nav"><a href="#benefits">Why Sahaan</a><a href="#earnings">Earnings</a><a href="#application">Application</a></nav><div className="header-actions"><a className="profile-back" href="/"><ArrowLeft /> Customer website</a><a className="signin-link" href="#application">Apply now</a></div></header>
    <section className="partner-hero"><div className="partner-copy"><a href="/" className="back-link"><ArrowLeft /> Back to Sahaan</a><div className="founding-badge"><Sparkles /> Hyderabad founding professional programme</div><h1>Grow your craft.<br /><em>Let’s build the client base.</em></h1><p>Sahaan welcomes nail and beauty professionals across Hyderabad. Send us your work and service area directly on WhatsApp. No account, long form or Google Business Profile is needed to apply.</p><div className="partner-actions"><Button render={<a href={applicationUrl} target="_blank" rel="noopener noreferrer" />}>Apply on WhatsApp <ArrowRight /></Button><a href="#application">What should I send?</a></div><p className="partner-quick-note">Attach 3–5 clear photos of your own work, or share a portfolio / Instagram link in the chat.</p><div className="partner-proof"><div><strong>0%</strong><span>commission on your first 10 completed bookings</span></div><div><strong>Clear terms</strong><span>confirmed before your first job</span></div><div><strong>You choose</strong><span>areas, services and availability</span></div></div></div><div className="partner-visual"><div className="partner-quote"><Star fill="currentColor" /><p>“Sahaan helps talented Hyderabad professionals be discovered for the quality of their work.”</p><span>THE FOUNDING PROFESSIONAL PROMISE</span></div></div></section>

    <section className="partner-benefits" id="benefits"><p className="eyebrow">Built for independent professionals</p><h2>Your talent. Your schedule.<br />A business that grows with you.</h2><div className="benefit-grid"><article><div><TrendingUp /></div><strong>Relevant enquiries</strong><p>As the pilot grows, Sahaan will review customer requests against your skills and service area.</p></article><article><div><Clock3 /></div><strong>Work on your terms</strong><p>Choose your service areas, working days, appointment times and minimum prices.</p></article><article><div><Banknote /></div><strong>Price clarity</strong><p>Confirm the service value, commission and payment arrangement before accepting a job.</p></article><article><div><ShieldCheck /></div><strong>Founder-led support</strong><p>During the pilot, Sahaan will coordinate requests and discuss issues directly with you.</p></article></div></section>

    <section className="partner-cta"><div><p className="eyebrow">For beauty professionals</p><h2>Your talent deserves<br /><em>the right clients.</em></h2><p>Show us your work and tell us where you can serve customers across Hyderabad. We will contact shortlisted applicants as local coverage develops; applying does not guarantee bookings.</p><Button render={<a href={applicationUrl} target="_blank" rel="noopener noreferrer" />}>Send your portfolio <ArrowRight /></Button></div><div className="partner-cta-stats"><span><strong>0%</strong><small>commission on your first 10 completed bookings</small></span><span><strong>18%</strong><small>standard commission after launch offer</small></span><span><strong>Before launch</strong><small>payment terms agreed in writing</small></span></div></section>

    <section className="earnings-section" id="earnings"><div className="earnings-copy"><p className="eyebrow">Know your numbers</p><h2>A clear commission,<br />never a surprise.</h2><p>After your first 10 commission-free completed bookings, Sahaan’s proposed standard platform commission is 18% on completed appointments. The payment method and final terms are agreed before activation.</p><ul><li><Check /> No joining or profile-listing fee</li><li><Check /> No commission on cancelled bookings</li><li><Check /> Tips remain 100% yours</li><li><Check /> Written job and payment terms before the first booking</li></ul></div><div className="calculator-card"><div className="calculator-head"><span>Monthly earnings estimator</span><TrendingUp /></div><label><span>Bookings per month <strong>{bookings}</strong></span><input type="range" min="4" max="40" step="2" value={bookings} onChange={(e) => setBookings(Number(e.target.value))} /></label><label><span>Average service price</span><select value={averagePrice} onChange={(e) => setAveragePrice(Number(e.target.value))}><option value="999">₹999</option><option value="1499">₹1,499</option><option value="1999">₹1,999</option><option value="2999">₹2,999</option></select></label><div className="earnings-breakdown"><span>Customer booking value <strong>₹{monthlyGross.toLocaleString('en-IN')}</strong></span><span>Sahaan commission · 18% <strong>− ₹{commission.toLocaleString('en-IN')}</strong></span><div><span>Your estimated earnings</span><strong>₹{partnerEarnings.toLocaleString('en-IN')}</strong></div></div><small>Illustrative estimate after the first 10 completed bookings; not a promise of bookings or earnings. Before taxes and your own material or travel costs.</small></div></section>

    <section className="google-profile-section" id="google-profile"><div className="google-profile-copy"><p className="eyebrow">Optional for salon owners</p><h2>Have a Google<br />Business Profile?</h2><p>You can include your listing in your WhatsApp introduction. This is optional; independent artists can apply without one.</p><div className="google-profile-warning"><ShieldCheck /><span><b>Important:</b> A Google listing, rating or review count does not automatically approve a Sahaan profile.</span></div></div><div className="google-profile-tool"><form onSubmit={findGoogleProfile}><label><span className="field-title">Hyderabad PIN code <b>Required for search</b></span><Input required inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={lookupPin} onChange={(event) => setLookupPin(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="e.g. 500081" /></label><label><span className="field-title">Salon or business name <i>Optional</i></span><Input value={lookupName} onChange={(event) => setLookupName(event.target.value)} placeholder="e.g. Your salon name" /></label><Button type="submit" disabled={lookupLoading}><Search /> {lookupLoading ? 'Searching…' : 'Find Google profile'}</Button></form>{lookupError && <div className="lookup-error"><ShieldCheck /><span>{lookupError}</span></div>}{lookupPlaces.length > 0 && <div className="lookup-results"><div className="lookup-results-head"><strong>Possible matches</strong><span className="google-maps-attribution" translate="no">Google Maps</span></div>{lookupPlaces.map((place) => <article key={place.placeId} className={selectedListing?.placeId === place.placeId ? 'selected' : ''}><div><Building2 /><span><strong>{place.name}</strong><small>{place.address}</small><em><Star fill="currentColor" /> {place.rating?.toFixed(1) || 'New'} · {place.reviewCount.toLocaleString('en-IN')} reviews</em></span></div><div><a href={place.mapsUrl} target="_blank" rel="noreferrer" aria-label={`View ${place.name} on Google Maps`}><ExternalLink /></a><Button type="button" onClick={() => useGoogleListing(place)}>{selectedListing?.placeId === place.placeId ? 'Selected' : 'Include in message'}</Button></div></article>)}<small>Google Maps ratings and review counts are user-generated and may change.</small></div>}</div></section>

    <section className="application-section" id="application">
      <div className="application-intro">
        <p className="eyebrow">One chat to get started</p>
        <h2>Show us your work.<br />We’ll take it from there.</h2>
        <p>No three-step application. Send the essentials in one WhatsApp chat; the Sahaan team will review your portfolio personally.</p>
        <div className="review-steps"><span><BadgeCheck /> Portfolio and experience review</span><span><MessageCircle /> Short WhatsApp conversation</span><span><FileCheck2 /> Verification if shortlisted</span><span><Sparkles /> Profile activation after approval</span></div>
      </div>
      <div className="application-card quick-application-card">
        <p className="eyebrow">What to send</p>
        <h3>Apply in one conversation</h3>
        <ol className="quick-application-list">
          <li><strong>Your basics</strong><span>Name, Hyderabad area / PIN code, services and years of experience. The chat opens with these prompts ready.</span></li>
          <li><strong>Your work</strong><span>Attach 3–5 clear photos of nail work you did yourself, or paste an Instagram / portfolio link.</span></li>
          <li><strong>Our review</strong><span>Send the message and photos in WhatsApp. We’ll contact shortlisted applicants about verification and next steps.</span></li>
        </ol>
        {selectedListing && <p className="selected-google-profile"><Building2 /><span><b>Google listing included</b>{selectedListing.name}</span></p>}
        <Button className="quick-application-button" render={<a href={applicationUrl} target="_blank" rel="noopener noreferrer" />}><MessageCircle /> Open WhatsApp to apply <ArrowRight /></Button>
        <p className="application-disclaimer">Opening WhatsApp does not submit an application. Please send your message and portfolio there. Do not send ID, bank details or other sensitive documents at this stage.</p>
        <a className="whatsapp-inline-link" href={sahaanWhatsAppUrl('Hi Sahaan! I have a question about joining as a beauty professional.')} target="_blank" rel="noopener noreferrer">Questions? WhatsApp {SAHAAN_WHATSAPP_DISPLAY}</a>
      </div>
    </section>
    <section className="partner-faq"><p className="eyebrow">Before you apply</p><h2>Good to know</h2><div><details><summary>Do I need my own salon?<span>+</span></summary><p>No. Sahaan is designed for skilled independent professionals providing services at customers’ homes. You need a clean professional kit and reliable transport.</p></details><details><summary>How does the commission work?<span>+</span></summary><p>Your first 10 completed bookings are commission-free. After that, Sahaan’s proposed standard commission is 18% of the completed service value. Final terms are agreed before activation.</p></details><details><summary>When will I receive payment?<span>+</span></summary><p>The payment method, timing and booking statement will be agreed in writing before your first job. No payment arrangement is active simply because you submit an application.</p></details><details><summary>What documents will be required?<span>+</span></summary><p>Identity, address and bank-account verification will be requested only after the initial application passes portfolio review. Never send sensitive documents through an unverified contact.</p></details></div></section>
    <div className="mobile-nav"><a href="/"><Home /><span>Home</span></a><a href="/professionals"><Search /><span>Explore</span></a><a className="current" href="/partners"><Users /><span>Join</span></a></div>
  </main>;
}
