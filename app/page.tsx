'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { ArrowRight, CalendarDays, ChevronDown, Clock3, Home, MapPin, Menu, Search, ShieldCheck, Sparkles, Users, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SAHAAN_WHATSAPP_DISPLAY, sahaanWhatsAppUrl } from '@/lib/contact';

const services = ['Gel polish', 'Nail extensions', 'Custom nail art', 'Manicure'];

export default function HomePage() {
  const [service, setService] = useState('Gel polish');
  const [pinCode, setPinCode] = useState('');
  const [date, setDate] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);

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

  function findProfessionals(event: FormEvent) {
    event.preventDefault();
    const query = new URLSearchParams({ service, pin: pinCode, date });
    window.location.href = `/professionals?${query.toString()}`;
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
        <h1>Hyderabad beauty,<br /><em>one PIN code away.</em></h1>
        <p>Explore nail and beauty businesses near your Hyderabad PIN code, then ask Sahaan to help find an available artist. Google-listed businesses are not automatically Sahaan partners.</p>
        <form className="search-panel" id="find" role="search" onSubmit={findProfessionals}>
          <label><span className="field-title"><MapPin size={15} /> Hyderabad PIN code <b>Required</b></span><Input required inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={pinCode} onChange={(e) => setPinCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="e.g. 500034" aria-describedby="location-help" /><small id="location-help">Any six-digit PIN code in Hyderabad</small></label>
          <label><span className="field-title"><Sparkles size={15} /> Service <b>Required</b></span><div className="native-select"><select required aria-label="Choose a service" value={service} onChange={(e) => setService(e.target.value)}>{services.map((item) => <option key={item}>{item}</option>)}</select><ChevronDown size={16} /></div><small>Choose the treatment you need</small></label>
          <label><span className="field-title"><CalendarDays size={15} /> Preferred date <b>Required</b></span><Input required value={date} onChange={(e) => setDate(e.target.value)} type="date" min={new Date().toISOString().split('T')[0]} /><small>For your request; not live availability</small></label>
          <Button type="submit" className="find-button"><Search /> Explore nearby</Button>
        </form>
        <div className="hero-proof"><span><MapPin size={14} /> Hyderabad-first search</span><span><ShieldCheck size={14} /> Google listings clearly labelled</span><span><Clock3 size={14} /> Requests reviewed by Sahaan</span></div>
      </div>
      <div className="market-hero-image"><div className="image-caption"><span>THE SAHAAN STANDARD</span><strong>Discover locally.<br />Verify carefully.</strong></div><div className="availability-card"><span className="status-dot" /><div><strong>Hyderabad launch</strong><small>PIN-code discovery across the city</small></div></div></div>
    </section>

    <section className="service-rail" id="services"><span>Explore services</span>{services.map((item, index) => <button key={item} onClick={() => { setService(item); document.getElementById('find')?.scrollIntoView({ behavior: 'smooth' }); }} className={service === item ? 'active' : ''}><span>0{index + 1}</span>{item}</button>)}</section>
    <section className="launch-service-note"><div className="launch-service-heading"><div><p className="eyebrow">Sahaan launch menu</p><h2>Beautiful nails, thoughtfully arranged.</h2><p>Indicative market-level starting prices for planning. Sahaan will confirm the artist, treatment details, travel charge and final price before any appointment is booked.</p></div><a href="#find">Explore nearby <ArrowRight size={18} /></a></div><div className="launch-price-grid"><article><span>01 · Colour</span><strong>Gel polish</strong><b>From ₹599</b><small>Colour application only; removal or manicure care may cost extra.</small></article><article><span>02 · Care</span><strong>Manicure</strong><b>From ₹999</b><small>Scope and finish depend on the available artist’s quote.</small></article><article><span>03 · Length</span><strong>Nail extensions</strong><b>From ₹1,399</b><small>Design, length and removal are confirmed before booking.</small></article><article><span>04 · Expression</span><strong>Custom nail art</strong><b>Quote on request</b><small>Share a reference design for a tailored estimate.</small></article></div><p className="price-disclaimer">These are indicative guides, not confirmed Sahaan prices or live availability. No payment is requested through this page.</p></section>

    <section className="customer-journey" id="how">
      <div className="section-title"><div><p className="eyebrow">A focused customer experience</p><h2>Tell us what you need.<br />See only relevant professionals.</h2></div></div>
      <div className="journey-grid"><article><span>01</span><MapPin /><strong>Share your request</strong><p>Enter your PIN code, treatment and preferred date. This is not a confirmed slot.</p></article><article><span>02</span><Search /><strong>Explore local listings</strong><p>Compare Google-listed businesses by rating and review count. A listing is not a Sahaan partner.</p></article><article><span>03</span><CalendarDays /><strong>Ask Sahaan to match you</strong><p>We check artist availability and share the exact scope and price before you decide.</p></article></div>
      <Button className="journey-button" render={<a href="#find" />}>Start your search <ArrowRight /></Button>
    </section>

    <section className="trust-band" id="trust"><div><ShieldCheck /><strong>Verification before activation</strong><p>Artists must complete portfolio, identity and service-standard checks before receiving a Sahaan verified badge.</p></div><div><Users /><strong>Listings are not partners</strong><p>Google Maps results are public business listings. Sahaan partners are identified separately after onboarding.</p></div><div><Home /><strong>Home-service planning</strong><p>We confirm service area, timing, hygiene expectations and price with you before any appointment.</p></div></section>
    <footer className="market-footer"><a className="market-footer-logo" href="/" aria-label="Sahaan Studios home"><span aria-hidden="true" /><span aria-hidden="true" /></a><div><strong>Customers</strong><a href="/professionals">Search Hyderabad</a><a href="#services">Explore services</a><a href="#how">How Sahaan works</a><a className="footer-whatsapp" href={sahaanWhatsAppUrl()} target="_blank" rel="noopener noreferrer">WhatsApp {SAHAAN_WHATSAPP_DISPLAY}</a></div><div><strong>Professionals</strong><a href="/partners">Apply to join</a><a href="/partners#earnings">Earnings calculator</a><a href="/partners#application">Application form</a></div><div><strong>Trust & legal</strong><a href="#trust">Verification standards</a><a href="/privacy">Privacy policy</a><a href="/terms">Terms of use</a></div><p className="market-footer-tagline"><img src="/brand/web/sahaan-tagline-web.png" alt="Your expression. Our essence." loading="lazy" /><span>Your expression. Our essence.</span></p><small>© 2026 Sahaan · Hyderabad launch marketplace for independent beauty professionals. Google-listed businesses are not automatically Sahaan-verified.</small></footer>
    <div className="mobile-nav"><a href="/"><Home /><span>Home</span></a><a href="#find"><Search /><span>Find</span></a><a href="/partners"><Users /><span>For pros</span></a></div>
  </main>;
}
