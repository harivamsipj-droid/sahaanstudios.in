'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, BadgeCheck, Building2, CalendarDays, Check, ExternalLink, Home, MapPin, MessageCircle, Search, ShieldCheck, SlidersHorizontal, Sparkles, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { GooglePlaceResult, GooglePlaceSearchResponse } from '@/lib/google-place-types';
import { SAHAAN_WHATSAPP_DISPLAY, sahaanWhatsAppUrl } from '@/lib/contact';
import { getCustomerPosition, readCustomerLocation, type CustomerLocation } from '@/lib/customer-location';

const serviceOptions = ['Gel polish', 'Nail extensions', 'Custom nail art', 'Manicure'];

async function loadGooglePlaces(pinCode: string, service: string) {
  const response = await fetch(`/api/google-professionals?pin=${encodeURIComponent(pinCode)}&service=${encodeURIComponent(service)}`, { cache: 'no-store' });
  const body = await response.json() as GooglePlaceSearchResponse & { error?: string; code?: string };
  if (!response.ok) throw new Error(body.error || 'Unable to search Google Maps right now.');
  return body;
}

async function loadNearbyPlaces(location: CustomerLocation, service: string) {
  const response = await fetch('/api/google-professionals', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ latitude: location.latitude, longitude: location.longitude, service }),
    cache: 'no-store',
  });
  const body = await response.json() as GooglePlaceSearchResponse & { error?: string };
  if (!response.ok) throw new Error(body.error || 'Unable to search Google Maps right now.');
  return body;
}

export default function ProfessionalsPage() {
  const [pinCode, setPinCode] = useState('');
  const [customerLocation, setCustomerLocation] = useState<CustomerLocation | null>(null);
  const [manualArea, setManualArea] = useState(false);
  const [locating, setLocating] = useState(false);
  const [service, setService] = useState('Gel polish');
  const [requestedDate, setRequestedDate] = useState('');
  const [places, setPlaces] = useState<GooglePlaceResult[]>([]);
  const [minimumRating, setMinimumRating] = useState('0');
  const [minimumReviews, setMinimumReviews] = useState('0');
  const [sort, setSort] = useState('recommended');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState('');

  async function runSearch(nextPin = pinCode, nextService = service, nextLocation = customerLocation) {
    if (!nextLocation && !/^\d{6}$/.test(nextPin)) {
      setError('Enter a valid 6-digit Hyderabad PIN code.');
      return;
    }
    setLoading(true);
    setError('');
    setSearched(true);
    try {
      const result = nextLocation ? await loadNearbyPlaces(nextLocation, nextService) : await loadGooglePlaces(nextPin, nextService);
      setPlaces(result.places);
    } catch (reason) {
      setPlaces([]);
      setError(reason instanceof Error ? reason.message : 'Unable to search Google Maps right now.');
    } finally {
      setLoading(false);
    }
  }

  async function searchCurrentLocation(nextService = service) {
    setLocating(true);
    setError('');
    setPlaces([]);
    setSearched(false);
    try {
      const location = await getCustomerPosition();
      setCustomerLocation(location);
      setPinCode('');
      setManualArea(false);
      window.history.replaceState(null, '', `/professionals?${new URLSearchParams({ service: nextService, near: 'me', date: requestedDate })}`);
      await runSearch('', nextService, location);
    } catch (reason) {
      setManualArea(true);
      setError(reason instanceof Error ? reason.message : 'Location unavailable. Search by PIN code instead.');
    } finally { setLocating(false); }
  }

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const nextPin = query.get('pin') || query.get('area') || '';
    const nextService = query.get('service') || 'Gel polish';
    const nearMe = query.get('near') === 'me';
    setPinCode(nextPin);
    if (serviceOptions.includes(nextService)) setService(nextService);
    setRequestedDate(query.get('date') || '');
    if (nearMe) {
      const stored = readCustomerLocation();
      if (stored) { setCustomerLocation(stored); void runSearch('', serviceOptions.includes(nextService) ? nextService : 'Gel polish', stored); }
      else setError('Location access is needed to search nearby. Tap “Use my location” or choose PIN-code search.');
    } else if (/^\d{6}$/.test(nextPin)) { setManualArea(true); void runSearch(nextPin, serviceOptions.includes(nextService) ? nextService : 'Gel polish', null); }
  }, []);

  const filtered = useMemo(() => {
    const rating = Number(minimumRating);
    const reviews = Number(minimumReviews);
    return places
      .filter((place) => (place.rating || 0) >= rating && place.reviewCount >= reviews)
      .sort((a, b) => {
        if (sort === 'reviews') return b.reviewCount - a.reviewCount;
        if (sort === 'rating') return (b.rating || 0) - (a.rating || 0) || b.reviewCount - a.reviewCount;
        if (customerLocation) return (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity);
        return ((b.rating || 0) * Math.log10(b.reviewCount + 10)) - ((a.rating || 0) * Math.log10(a.reviewCount + 10));
      });
  }, [customerLocation, minimumRating, minimumReviews, places, sort]);

  function submitSearch(event: FormEvent) {
    event.preventDefault();
    if (manualArea) { setCustomerLocation(null); window.history.replaceState(null, '', `/professionals?${new URLSearchParams({ service, pin: pinCode, date: requestedDate })}`); void runSearch(pinCode, service, null); }
    else if (customerLocation) void runSearch('', service, customerLocation);
    else void searchCurrentLocation();
  }

  function requestSalon(place: GooglePlaceResult) {
    const message = `Hi Sahaan! I found ${place.name} ${customerLocation ? 'near my current area' : `near Hyderabad PIN ${pinCode}`}. I am interested in ${service}${requestedDate ? ` on ${requestedDate}` : ''}. Is this business a Sahaan partner? If not, please tell me whether you can help with a similar service. I can share my exact service address and any design photo privately here. Please send my service price, travel charge, any additional charges and final total before I decide. This is only an enquiry, not a booking.\n\nGoogle Maps profile: ${place.mapsUrl}`;
    window.open(sahaanWhatsAppUrl(message), '_blank', 'noopener,noreferrer');
  }

  const requestUrl = `/request?${new URLSearchParams({ service, ...(requestedDate ? { date: requestedDate } : {}) })}`;

  return <main className="directory-page hyderabad-directory">
    <header className="market-header inner-header"><a className="market-brand" href="/"><span className="market-monogram">S</span><span><strong>SAHAAN</strong><small>HYDERABAD LAUNCH</small></span></a><nav className="desktop-nav"><a href="/">Customer home</a><a className="active-link" href="/professionals">Nearby professionals</a><a href="/partners">Professional onboarding</a></nav><Button className="header-button" render={<a href="/partners" />}>Join Sahaan <ArrowRight /></Button></header>

    <section className="directory-hero directory-working-hero"><a href="/" className="back-link"><ArrowLeft /> Back to customer website</a><p className="eyebrow">Hyderabad-wide discovery and enquiries</p><h1><span className="desktop-directory-title">Find beauty close to you.<br /><em>Compare nearby listings.</em></span><span className="mobile-directory-title">Explore beauty<br /><em>near you.</em></span></h1><p className="desktop-directory-intro">Explore Google-listed nail and beauty businesses around your location, then ask Sahaan about a managed home-service match. Listings are not bookable or Sahaan-verified unless separately confirmed.</p><p className="mobile-directory-intro">These are public Google listings, not Sahaan partners. Ask Sahaan for a reviewed artist and a confirmed quote.</p>
      <form className={`directory-search pin-search${manualArea ? ' manual-area-active' : ''}`} onSubmit={submitSearch}>
        <div className="directory-location-choice"><button type="button" className={!manualArea ? 'selected' : ''} aria-pressed={!manualArea} onClick={() => { setManualArea(false); void searchCurrentLocation(); }} disabled={locating}><MapPin /> {locating ? 'Finding location…' : customerLocation ? 'Update my location' : 'Use my location'}</button><button type="button" className={manualArea ? 'selected' : ''} aria-pressed={manualArea} onClick={() => { setManualArea(true); setCustomerLocation(null); setPlaces([]); setSearched(false); setError(''); }}>Search by PIN code</button></div>
        {manualArea && <label><span>Hyderabad PIN code</span><div><MapPin /><Input required inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={pinCode} onChange={(event) => setPinCode(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="e.g. 500034" /></div></label>}
        <label><span>Service required</span><div><Sparkles /><select value={service} onChange={(event) => setService(event.target.value)}>{serviceOptions.map((item) => <option key={item}>{item}</option>)}</select></div></label><Button type="submit" disabled={loading || locating}><Search /> {loading ? 'Searching…' : manualArea ? 'Search this area' : 'Refresh nearby results'}</Button>
      </form>
      <p className="directory-location-note">{manualArea ? 'PIN-code search does not use your device location. Share an exact address privately only when requesting a travel quote.' : 'Your approximate location is used for this search and shared with Google Maps. It is not shown publicly; choose PIN-code search at any time.'}</p>
      <div className="manual-match-panel"><div><strong>Want Sahaan to find an artist?</strong><p>Choose a preferred time and send Sahaan your request. We’ll confirm a reviewed artist, service price, travel and total.</p><small>No booking or payment until you approve the final quote.</small></div><a href={requestUrl}><CalendarDays /> Request a preferred time</a></div>
      <a className="whatsapp-inline-link" href={sahaanWhatsAppUrl('Hi Sahaan! I have a question about finding a beauty professional in Hyderabad.')} target="_blank" rel="noopener noreferrer"><MessageCircle /> Questions? WhatsApp {SAHAAN_WHATSAPP_DISPLAY}</a>
      {requestedDate && <div className="requested-date"><Check /> Preferred appointment date: <b>{new Date(`${requestedDate}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</b></div>}
    </section>

    <section className="google-discovery-section" id="results">
      <aside className={`discovery-filters${filtersOpen ? ' filters-open' : ''}`} aria-label="Filter results"><button className="mobile-filter-toggle" type="button" aria-expanded={filtersOpen} aria-controls="mobile-discovery-filters" onClick={() => setFiltersOpen((open) => !open)}><SlidersHorizontal /> Filters &amp; sort{minimumRating !== '0' || minimumReviews !== '0' || sort !== 'recommended' ? ' · active' : ''}<span>{filtersOpen ? 'Hide' : 'Show'}</span></button><div id="mobile-discovery-filters"><p className="filter-kicker">Refine your shortlist</p><label>Minimum rating<select value={minimumRating} onChange={(event) => setMinimumRating(event.target.value)}><option value="0">Any rating</option><option value="4">4.0 and above</option><option value="4.5">4.5 and above</option></select></label><label>Minimum Google reviews<select value={minimumReviews} onChange={(event) => setMinimumReviews(event.target.value)}><option value="0">Any number</option><option value="20">20+ reviews</option><option value="50">50+ reviews</option><option value="100">100+ reviews</option><option value="250">250+ reviews</option></select></label><label>Sort results<select value={sort} onChange={(event) => setSort(event.target.value)}><option value="recommended">Recommended</option><option value="rating">Highest rated</option><option value="reviews">Most reviewed</option></select></label><Button variant="outline" onClick={() => { setMinimumRating('0'); setMinimumReviews('0'); setSort('recommended'); }}>Reset filters</Button></div><div className="verification-key"><strong>Know the difference</strong><span><BadgeCheck /> Sahaan verified</span><p>Identity, skills and service standards reviewed by Sahaan.</p><span><Building2 /> Google-listed</span><p>Public business information only; onboarding is still required.</p></div></aside>

      <div className="google-results-shell">
        <div className="results-head google-results-head"><div><strong>{error ? 'Search unavailable right now' : searched ? `${filtered.length} nearby Google listings` : 'Find beauty near you'}</strong><span>{searched ? `For ${service} ${customerLocation ? 'around your current area' : `near ${pinCode}`}` : 'Use your location or search a Hyderabad PIN code'}</span></div><span className="google-maps-attribution" translate="no">Google Maps</span></div>

        {error && <div className="connection-state"><ShieldCheck /><h2>Search unavailable right now</h2><p>{error}</p><small>You can still send Sahaan a manual match request above.</small></div>}
        {!searched && !error && <div className="connection-state"><MapPin /><h2>Start with your location</h2><p>Allow location access to discover nearby businesses, or search a Hyderabad PIN code.</p></div>}
        {loading && <div className="results-loading"><span /><p>Searching Google Maps {customerLocation ? 'near you' : `around ${pinCode}`}…</p></div>}
        {searched && !loading && !error && filtered.length === 0 && <div className="connection-state"><Search /><h2>No matches under these filters</h2><p>Reduce the rating or review requirement, or try searching another Hyderabad area.</p></div>}

        {!loading && !error && filtered.length > 0 && <div className="google-place-grid">{filtered.map((place, index) => <article className="google-place-card" key={place.placeId}>
          <div className="place-rank"><span>#{index + 1}</span><div className="google-listing-badge"><Building2 /> Google-listed</div></div>
          <h2>{place.name}</h2><p className="place-category">{place.category}</p>
          <div className="google-rating"><Star fill="currentColor" /><strong>{place.rating?.toFixed(1) || 'New'}</strong>{place.rating && <span>{place.reviewCount.toLocaleString('en-IN')} Google reviews</span>}</div>
          <p className="place-address"><MapPin /> {place.address}</p>{customerLocation && place.distanceKm !== undefined && <p className="place-distance">About {place.distanceKm.toFixed(1)} km away in a straight line · travel route may differ</p>}
          <div className="place-actions"><Button render={<a href={place.mapsUrl} target="_blank" rel="noreferrer" />}>View on Google Maps <ExternalLink /></Button><button onClick={() => requestSalon(place)}>Ask Sahaan about this listing <MessageCircle /></button></div>
          <small>Google Maps ratings are user-generated. This listing is not yet Sahaan-verified.</small>
        </article>)}</div>}
        {searched && !error && <div className="google-content-notice"><span className="google-maps-attribution" translate="no">Google Maps</span><p>Results are ordered using your selected rating and review filters. Google Maps ratings and review counts are user-generated and may change. <a href="https://support.google.com/contributionpolicy/answer/7400114" target="_blank" rel="noreferrer">Learn about Google’s review policy</a>.</p></div>}
      </div>
    </section>

    <section className="directory-trust"><div><MapPin /><strong>Local discovery</strong><p>Search around your permitted location, or choose another Hyderabad area by PIN code.</p></div><div><Star /><strong>Rating filters</strong><p>Compare average rating and the number of Google Maps reviews together.</p></div><div><BadgeCheck /><strong>Verification stays separate</strong><p>Only professionals who complete Sahaan checks receive the verified badge.</p></div></section>
    <div className="mobile-nav" aria-label="Customer shortcuts"><a href="/"><Home /><span>Home</span></a><a className="current" href="#results"><Search /><span>Results</span></a><a href={requestUrl}><CalendarDays /><span>Request</span></a></div>
  </main>;
}
