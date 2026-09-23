'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { ArrowRight, CalendarDays, ChevronDown, Clock3, Home, MapPin, Menu, Search, ShieldCheck, Sparkles, Star, Users, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const services = ['Gel manicure', 'Nail extensions', 'Custom nail art', 'Classic manicure'];

export default function HomePage() {
  const [service, setService] = useState('Gel manicure');
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
      <nav className="desktop-nav" aria-label="Customer navigation"><a href="#services">Services</a><a href="#how">How it works</a><a href="#trust">Safety & trust</a></nav>
      <div className="header-actions"><a className="signin-link pro-portal-link" href="/partners">For professionals</a><Button className="header-button" render={<a href="#find" />}>Find a professional <ArrowRight /></Button><button className="menu-button" type="button" aria-label={menuOpen ? 'Close menu' : 'Open menu'} aria-controls="customer-mobile-menu" aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}>{menuOpen ? <X /> : <Menu />}</button></div>
      <nav className={`customer-mobile-menu${menuOpen ? ' is-open' : ''}`} id="customer-mobile-menu" aria-label="Mobile customer navigation" inert={!menuOpen}>
        <a href="#find" onClick={() => setMenuOpen(false)}>Find a professional <ArrowRight size={18} /></a>
        <a href="#services" onClick={() => setMenuOpen(false)}>Services <ArrowRight size={18} /></a>
        <a href="#how" onClick={() => setMenuOpen(false)}>How it works <ArrowRight size={18} /></a>
        <a href="#trust" onClick={() => setMenuOpen(false)}>Safety &amp; trust <ArrowRight size={18} /></a>
        <a href="/partners" onClick={() => setMenuOpen(false)}>For professionals <ArrowRight size={18} /></a>
      </nav>
    </header>

    <section className="market-hero">
      <div className="market-hero-copy">
        <div className="trusted-pill"><ShieldCheck size={15} /> Launching first in Hyderabad</div>
        <h1>Hyderabad beauty,<br /><em>one PIN code away.</em></h1>
        <p>Enter your Hyderabad PIN code to discover nearby nail salons and beauty professionals. Compare Google Maps ratings and review volume, with Sahaan verification shown separately.</p>
        <form className="search-panel" id="find" role="search" onSubmit={findProfessionals}>
          <label><span className="field-title"><MapPin size={15} /> Hyderabad PIN code <b>Required</b></span><Input required inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={pinCode} onChange={(e) => setPinCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="e.g. 500034" aria-describedby="location-help" /><small id="location-help">Any six-digit PIN code in Hyderabad</small></label>
          <label><span className="field-title"><Sparkles size={15} /> Service <b>Required</b></span><div className="native-select"><select required aria-label="Choose a service" value={service} onChange={(e) => setService(e.target.value)}>{services.map((item) => <option key={item}>{item}</option>)}</select><ChevronDown size={16} /></div><small>Choose the treatment you need</small></label>
          <label><span className="field-title"><CalendarDays size={15} /> Preferred date <b>Required</b></span><Input required value={date} onChange={(e) => setDate(e.target.value)} type="date" min={new Date().toISOString().split('T')[0]} /><small>We’ll show relevant availability</small></label>
          <Button type="submit" className="find-button"><Search /> Show my matches</Button>
        </form>
        <div className="hero-proof"><span><strong>4.9</strong><Star size={13} fill="currentColor" /> average rating</span><span><strong>100%</strong> independently verified</span><span><Clock3 size={14} /> support on every booking</span></div>
      </div>
      <div className="market-hero-image"><div className="image-caption"><span>THE SAHAAN STANDARD</span><strong>Discover locally.<br />Verify carefully.</strong></div><div className="availability-card"><span className="status-dot" /><div><strong>Hyderabad launch</strong><small>PIN-code discovery across the city</small></div></div></div>
    </section>

    <section className="service-rail" id="services"><span>Popular now</span>{services.map((item, index) => <button key={item} onClick={() => setService(item)} className={service === item ? 'active' : ''}><span>0{index + 1}</span>{item}</button>)}</section>

    <section className="customer-journey" id="how">
      <div className="section-title"><div><p className="eyebrow">A focused customer experience</p><h2>Tell us what you need.<br />See only relevant professionals.</h2></div></div>
      <div className="journey-grid"><article><span>01</span><MapPin /><strong>Enter your Hyderabad PIN</strong><p>Tell us the six-digit PIN code, treatment and preferred date.</p></article><article><span>02</span><Search /><strong>Compare a local shortlist</strong><p>Filter Google-listed businesses by rating and review count on a separate page.</p></article><article><span>03</span><CalendarDays /><strong>Choose with confidence</strong><p>Google listings remain clearly separate from professionals verified by Sahaan.</p></article></div>
      <Button className="journey-button" render={<a href="#find" />}>Start your search <ArrowRight /></Button>
    </section>

    <section className="trust-band" id="trust"><div><ShieldCheck /><strong>Skill verified</strong><p>Portfolios and practical ability reviewed before activation.</p></div><div><Users /><strong>Real professionals</strong><p>Identity and contact details checked by the Sahaan team.</p></div><div><Home /><strong>Made for home</strong><p>Clear service areas, punctuality standards and hygiene protocols.</p></div></section>
    <footer className="market-footer"><a className="market-footer-logo" href="/" aria-label="Sahaan Studios home"><img src="/brand/three-parts/sahaan-logo-symbol-4k.webp" alt="" loading="lazy" /><img src="/brand/three-parts/sahaan-studios-wordmark-4k.webp" alt="Sahaan Studios" loading="lazy" /></a><div><strong>Customers</strong><a href="/professionals">Search Hyderabad</a><a href="#services">Services & pricing</a><a href="#how">How Sahaan works</a></div><div><strong>Professionals</strong><a href="/partners">Apply to join</a><a href="/partners#earnings">Earnings calculator</a><a href="/partners#application">Application form</a></div><div><strong>Trust & legal</strong><a href="#trust">Verification standards</a><a href="/privacy">Privacy policy</a><a href="/terms">Terms of use</a></div><p className="market-footer-tagline"><img src="/brand/three-parts/sahaan-tagline-4k.webp" alt="Your expression. Our essence." loading="lazy" /><span>Your expression. Our essence.</span></p><small>© 2026 Sahaan · Hyderabad launch marketplace for independent beauty professionals. Google-listed businesses are not automatically Sahaan-verified.</small></footer>
    <div className="mobile-nav"><a href="/"><Home /><span>Home</span></a><a href="#find"><Search /><span>Find</span></a><a href="/partners"><Users /><span>For pros</span></a></div>
  </main>;
}
