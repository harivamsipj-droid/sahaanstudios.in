'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { ArrowRight, CalendarDays, ChevronDown, Clock3, Home, MapPin, Menu, MessageCircle, Search, ShieldCheck, Sparkles, Users, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SAHAAN_WHATSAPP_DISPLAY, sahaanWhatsAppUrl } from '@/lib/contact';
import { getCustomerPosition } from '@/lib/customer-location';

const services = ['Gel polish', 'Nail extensions', 'Custom nail art', 'Manicure'];
const servicePrices: Record<string, string> = {
  'Gel polish': '₹499–₹699',
  'Nail extensions': '₹1,399–₹2,499',
  'Custom nail art': '₹75–₹250 / nail',
  'Manicure': '₹699–₹1,199',
};

export default function HomePage() {
  const [service, setService] = useState('Gel polish');
  const [pinCode, setPinCode] = useState('');
  const [date, setDate] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [manualArea, setManualArea] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState('');
  const headerRef = useRef<HTMLElement>(null);
  const quoteMessage = `Hi Sahaan! I’d like a quote for ${service}.\nMy Hyderabad area or PIN code: ${pinCode || '[please share your area]'}\nPreferred date: ${date || '[please share a date if you have one]'}\nDesign or treatment details: [please describe or attach a photo]\nService address for travel: [please share privately here]\n\nPlease confirm the service, travel, any additional charges and final total before booking.`;

  useEffect(() => {
    if (!menuOpen) return;

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setMenuOpen(false);
    }

    function closeOnOutsideClick(event: PointerEvent) {
      if (headerRef.current && !headerRef.current.contains(event.target as Node)) setMenuOpen(false);
    }

    document.addEventListener('keydown', closeOnEscape);
    document.addEventListener('pointerdown', closeOnOutsideClick);
    return () => {
      document.removeEventListener('keydown', closeOnEscape);
      document.removeEventListener('pointerdown', closeOnOutsideClick);
    };
  }, [menuOpen]);

  async function findProfessionals(event: FormEvent) {
    event.preventDefault();
    if (manualArea) {
      if (!/^\d{6}$/.test(pinCode)) { setLocationError('Enter a six-digit Hyderabad PIN code.'); return; }
      window.location.href = `/professionals?${new URLSearchParams({ service, pin: pinCode, date })}`;
      return;
    }
    setLocating(true);
    setLocationError('');
    try {
      await getCustomerPosition();
      window.location.href = `/professionals?${new URLSearchParams({ service, near: 'me', date })}`;
    } catch (error) {
      setLocationError(error instanceof Error ? error.message : 'Location unavailable. Search by PIN code instead.');
    } finally { setLocating(false); }
  }

  return <main>
    <header className="market-header" ref={headerRef}>
      <a className="market-brand" href="/" aria-label="Sahaan Studios home" />
      <nav className="desktop-nav" aria-label="Customer navigation"><a href="#services">Services</a><a href="#how">How it works</a><a href="#trust">Safety & trust</a><a href={sahaanWhatsAppUrl()} target="_blank" rel="noopener noreferrer">WhatsApp</a></nav>
      <div className="header-actions"><a className="signin-link pro-portal-link" href="/partners">For professionals</a><Button className="header-button" render={<a href="#find" />}>Explore nearby <ArrowRight /></Button><button className="menu-button" type="button" aria-label={menuOpen ? 'Close menu' : 'Open menu'} aria-controls="customer-mobile-menu" aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}>{menuOpen ? <X /> : <Menu />}</button></div>
      <nav className={`customer-mobile-menu${menuOpen ? ' is-open' : ''}`} id="customer-mobile-menu" aria-label="Mobile customer navigation" inert={!menuOpen}>
        <a href="#find" onClick={() => setMenuOpen(false)}>Explore nearby <ArrowRight size={18} /></a>
        <a href="#services" onClick={() => setMenuOpen(false)}>Services <ArrowRight size={18} /></a>
        <a href="#how" onClick={() => setMenuOpen(false)}>How it works <ArrowRight size={18} /></a>
        <a href="#trust" onClick={() => setMenuOpen(false)}>Safety &amp; trust <ArrowRight size={18} /></a>
        <a href={sahaanWhatsAppUrl()} target="_blank" rel="noopener noreferrer" onClick={() => setMenuOpen(false)}>WhatsApp Sahaan · {SAHAAN_WHATSAPP_DISPLAY} <ArrowRight size={18} /></a>
        <a href="/partners" onClick={() => setMenuOpen(false)}>For professionals <ArrowRight size={18} /></a>
      </nav>
    </header>

    <section className="market-hero">
      <div className="market-hero-copy">
        <div className="trusted-pill"><ShieldCheck size={15} /> Launching first in Hyderabad</div>
        <h1><span className="desktop-hero-title">Hyderabad beauty,<br /><em>closer to you.</em></span><span className="mobile-hero-title">Beautiful nails,<br /><em>closer to home.</em></span></h1>
        <p className="desktop-hero-intro">Explore nail and beauty businesses around your current area, then ask Sahaan to help find an available artist. Google-listed businesses are not automatically Sahaan partners.</p>
        <p className="mobile-hero-intro">Choose a service. We’ll show nearby options using your location, with your permission.</p>
        <form className={`search-panel${manualArea ? ' manual-area-active' : ''}`} id="find" role="search" onSubmit={findProfessionals}>
          <fieldset className="mobile-service-picker"><legend>What would you like done?</legend><div>{services.map((item) => <button type="button" key={item} aria-pressed={service === item} onClick={() => setService(item)}><span>{item}</span><small>{servicePrices[item]}</small></button>)}</div></fieldset>
          <div className="location-choice"><MapPin size={19} /><div><strong>{manualArea ? 'Search a different area' : 'Find beauty near me'}</strong><small>{manualArea ? 'Enter a Hyderabad PIN code below' : 'Your browser will ask to use your location'}</small></div><button type="button" onClick={() => { setManualArea((value) => !value); setLocationError(''); }}>{manualArea ? 'Use my location' : 'Use PIN instead'}</button></div>
          {manualArea && <label className="manual-pin-field"><span className="field-title"><MapPin size={15} /> Hyderabad PIN code <b>Required</b></span><Input required inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={pinCode} onChange={(e) => setPinCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="e.g. 500034" aria-describedby="location-help" /><small id="location-help">Any six-digit PIN code in Hyderabad</small></label>}
          <label className="service-select-field"><span className="field-title"><Sparkles size={15} /> Service <b>Required</b></span><div className="native-select"><select required aria-label="Choose a service" value={service} onChange={(e) => setService(e.target.value)}>{services.map((item) => <option key={item}>{item}</option>)}</select><ChevronDown size={16} /></div><small>Choose the treatment you need</small></label>
          <label className="preferred-date-field"><span className="field-title"><CalendarDays size={15} /> Preferred date <i>Optional</i></span><Input value={date} onChange={(e) => setDate(e.target.value)} type="date" min={new Date().toISOString().split('T')[0]} /><small>We’ll confirm the appointment time later</small></label>
          <Button type="submit" className="find-button" disabled={locating}><Search /> {locating ? 'Finding your location…' : manualArea ? 'Explore this area' : 'Show nearby professionals'}</Button>
        </form>
        {locationError && <p className="location-error" role="alert">{locationError} <button type="button" onClick={() => setManualArea(true)}>Search by PIN code</button></p>}
        <p className="location-privacy">Location is used for this search and shared with Google Maps; it is not shown to other visitors. You can choose PIN-code search instead.</p>
        <a className="mobile-quote-cta" href={sahaanWhatsAppUrl(quoteMessage)} target="_blank" rel="noopener noreferrer"><MessageCircle size={19} /> Ask Sahaan for a quote <ArrowRight size={17} /></a>
        <p className="mobile-request-note">No payment or booking yet. Public Google listings are not automatically Sahaan partners.</p>
        <div className="hero-proof"><span><MapPin size={14} /> Hyderabad-first search</span><span><ShieldCheck size={14} /> Google listings clearly labelled</span><span><Clock3 size={14} /> Requests reviewed by Sahaan</span></div>
      </div>
      <div className="market-hero-image"><div className="image-caption"><span>THE SAHAAN STANDARD</span><strong>Discover locally.<br />Verify carefully.</strong></div><div className="availability-card"><span className="status-dot" /><div><strong>Hyderabad launch</strong><small>PIN-code discovery across the city</small></div></div></div>
    </section>

    <section className="service-rail" id="services"><span>Explore services</span>{services.map((item, index) => <button key={item} onClick={() => { setService(item); document.getElementById('find')?.scrollIntoView({ behavior: 'smooth' }); }} className={service === item ? 'active' : ''}><span>0{index + 1}</span>{item}</button>)}</section>
    <section className="launch-service-note"><div className="launch-service-heading"><div><p className="eyebrow">Hyderabad price guide</p><h2>Know the range before you enquire.</h2><p>Use these indicative market ranges to plan your treatment. They are not fixed Sahaan booking prices; your artist’s work, design and travel determine the confirmed total.</p></div><a href="#find">Explore nearby <ArrowRight size={18} /></a></div><div className="launch-price-grid"><article><span>01 · Colour</span><strong>Gel polish</strong><b>₹499–₹699</b><small>Solid-colour polish on natural nails. Existing gel removal and nail care may be extra.</small></article><article><span>02 · Care</span><strong>Manicure</strong><b>₹699–₹1,199</b><small>From essential care to extended treatments; gel polish is separate unless included in the quote.</small></article><article><span>03 · Length</span><strong>Nail extensions</strong><b>₹1,399–₹2,499</b><small>Typical full-hand extension range. Length, material, removal and art affect the price.</small></article><article><span>04 · Expression</span><strong>Custom nail art</strong><b>₹75–₹250 / nail</b><small>Art is priced per nail; detailed, 3D or bridal work needs an artist-specific estimate.</small></article></div><p className="price-disclaimer">Indicative Hyderabad service ranges, checked September 2026. Home-visit travel, removal, add-ons and applicable taxes may change the total. Sahaan confirms the complete price in writing before any payment or booking.</p></section>

    <section className="customer-journey" id="how">
      <div className="section-title"><div><p className="eyebrow">A focused customer experience</p><h2>Tell us what you need.<br />See only relevant professionals.</h2></div></div>
      <div className="journey-grid"><article><span>01</span><MapPin /><strong>Share your request</strong><p>Choose a treatment and use your location, or search another area by PIN code. Add a preferred date if you have one.</p></article><article><span>02</span><Search /><strong>Explore local listings</strong><p>Compare Google-listed businesses by rating and review count. A listing is not a Sahaan partner.</p></article><article><span>03</span><CalendarDays /><strong>Ask Sahaan to match you</strong><p>We check artist availability and share the exact scope and price before you decide.</p></article></div>
      <Button className="journey-button" render={<a href="#find" />}>Start your search <ArrowRight /></Button>
    </section>

    <section className="trust-band" id="trust"><div><ShieldCheck /><strong>Verification before activation</strong><p>Artists must complete portfolio, identity and service-standard checks before receiving a Sahaan verified badge.</p></div><div><Users /><strong>Listings are not partners</strong><p>Google Maps results are public business listings. Sahaan partners are identified separately after onboarding.</p></div><div><Home /><strong>Home-service planning</strong><p>We confirm service area, timing, hygiene expectations and price with you before any appointment.</p></div></section>
    <footer className="market-footer"><a className="market-footer-logo" href="/" aria-label="Sahaan Studios home"><span aria-hidden="true" /><span aria-hidden="true" /></a><div><strong>Customers</strong><a href="/professionals">Search Hyderabad</a><a href="#services">Explore services</a><a href="#how">How Sahaan works</a><a className="footer-whatsapp" href={sahaanWhatsAppUrl()} target="_blank" rel="noopener noreferrer">WhatsApp {SAHAAN_WHATSAPP_DISPLAY}</a></div><div><strong>Professionals</strong><a href="/partners">Apply to join</a><a href="/partners#earnings">Quote estimator</a><a href="/partners#application">Apply on WhatsApp</a></div><div><strong>Trust & legal</strong><a href="#trust">Verification standards</a><a href="/privacy">Privacy policy</a><a href="/terms">Terms of use</a></div><p className="market-footer-tagline"><img src="/brand/web/sahaan-tagline-web.png" alt="Your expression. Our essence." loading="lazy" /><span>Your expression. Our essence.</span></p><small>© 2026 Sahaan · Hyderabad launch marketplace for independent beauty professionals. Google-listed businesses are not automatically Sahaan-verified.</small></footer>
    <div className="mobile-nav" aria-label="Customer shortcuts"><a className="current" href="/"><Home /><span>Home</span></a><a href="#find"><Search /><span>Explore</span></a><a href={sahaanWhatsAppUrl(quoteMessage)} target="_blank" rel="noopener noreferrer"><MessageCircle /><span>Get quote</span></a></div>
  </main>;
}
