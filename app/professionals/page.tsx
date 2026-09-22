'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, BadgeCheck, Building2, Check, ExternalLink, Home, MapPin, MessageCircle, Search, ShieldCheck, Sparkles, Star, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { GooglePlaceResult, GooglePlaceSearchResponse } from '@/lib/google-place-types';

const serviceOptions = ['Gel manicure', 'Nail extensions', 'Custom nail art', 'Classic manicure', 'Beauty salon'];

async function loadGooglePlaces(pinCode: string, service: string) {
  const response = await fetch(`/api/google-professionals?pin=${encodeURIComponent(pinCode)}&service=${encodeURIComponent(service)}`, { cache: 'no-store' });
  const body = await response.json() as GooglePlaceSearchResponse & { error?: string; code?: string };
  if (!response.ok) throw new Error(body.error || 'Unable to search Google Maps right now.');
  return body;
}

export default function ProfessionalsPage() {
  const [pinCode, setPinCode] = useState('');
  const [service, setService] = useState('Gel manicure');
  const [requestedDate, setRequestedDate] = useState('');
  const [places, setPlaces] = useState<GooglePlaceResult[]>([]);
  const [minimumRating, setMinimumRating] = useState('0');
  const [minimumReviews, setMinimumReviews] = useState('0');
  const [sort, setSort] = useState('recommended');
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState('');

  async function runSearch(nextPin = pinCode, nextService = service) {
    if (!/^\d{6}$/.test(nextPin)) {
      setError('Enter a valid 6-digit Hyderabad PIN code.');
      return;
    }
    setLoading(true);
    setError('');
    setSearched(true);
    try {
      const result = await loadGooglePlaces(nextPin, nextService);
      setPlaces(result.places);
    } catch (reason) {
      setPlaces([]);
      setError(reason instanceof Error ? reason.message : 'Unable to search Google Maps right now.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const nextPin = query.get('pin') || query.get('area') || '';
    const nextService = query.get('service') || 'Gel manicure';
    setPinCode(nextPin);
    if (serviceOptions.includes(nextService)) setService(nextService);
    setRequestedDate(query.get('date') || '');
    if (/^\d{6}$/.test(nextPin)) void runSearch(nextPin, serviceOptions.includes(nextService) ? nextService : 'Gel manicure');
  }, []);

  const filtered = useMemo(() => {
    const rating = Number(minimumRating);
    const reviews = Number(minimumReviews);
    return places
      .filter((place) => (place.rating || 0) >= rating && place.reviewCount >= reviews)
      .sort((a, b) => {
        if (sort === 'reviews') return b.reviewCount - a.reviewCount;
        if (sort === 'rating') return (b.rating || 0) - (a.rating || 0) || b.reviewCount - a.reviewCount;
        return ((b.rating || 0) * Math.log10(b.reviewCount + 10)) - ((a.rating || 0) * Math.log10(a.reviewCount + 10));
      });
  }, [minimumRating, minimumReviews, places, sort]);

  function submitSearch(event: FormEvent) {
    event.preventDefault();
    void runSearch();
  }

  function requestSalon(place: GooglePlaceResult) {
    const message = `Hi Sahaan! I found ${place.name} near Hyderabad PIN ${pinCode}. I would like to know when this salon becomes bookable on Sahaan.\n\nGoogle Maps profile: ${place.mapsUrl}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
  }

  return <main className="directory-page hyderabad-directory">
    <header className="market-header inner-header"><a className="market-brand" href="/"><span className="market-monogram">S</span><span><strong>SAHAAN</strong><small>HYDERABAD LAUNCH</small></span></a><nav className="desktop-nav"><a href="/">Customer home</a><a className="active-link" href="/professionals">Nearby professionals</a><a href="/partners">Professional onboarding</a></nav><Button className="header-button" render={<a href="/partners" />}>Join Sahaan <ArrowRight /></Button></header>

    <section className="directory-hero directory-working-hero"><a href="/" className="back-link"><ArrowLeft /> Back to customer website</a><p className="eyebrow">Launching across Hyderabad</p><h1>Search one PIN code.<br /><em>Compare nearby professionals.</em></h1><p>Discover nail salons and beauty professionals near any Hyderabad PIN code, then filter by Google Maps rating and review volume.</p>
      <form className="directory-search pin-search" onSubmit={submitSearch}><label><span>Hyderabad PIN code</span><div><MapPin /><Input required inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={pinCode} onChange={(event) => setPinCode(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="e.g. 500034" /></div></label><label><span>Service required</span><div><Sparkles /><select value={service} onChange={(event) => setService(event.target.value)}>{serviceOptions.map((item) => <option key={item}>{item}</option>)}</select></div></label><Button type="submit" disabled={loading}><Search /> {loading ? 'Searching…' : 'Search nearby'}</Button></form>
      {requestedDate && <div className="requested-date"><Check /> Preferred appointment date: <b>{new Date(`${requestedDate}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</b></div>}
    </section>

    <section className="google-discovery-section">
      <aside className="discovery-filters" aria-label="Filter results"><div><p className="filter-kicker">Refine your shortlist</p><label>Minimum rating<select value={minimumRating} onChange={(event) => setMinimumRating(event.target.value)}><option value="0">Any rating</option><option value="4">4.0 and above</option><option value="4.5">4.5 and above</option></select></label><label>Minimum Google reviews<select value={minimumReviews} onChange={(event) => setMinimumReviews(event.target.value)}><option value="0">Any number</option><option value="20">20+ reviews</option><option value="50">50+ reviews</option><option value="100">100+ reviews</option><option value="250">250+ reviews</option></select></label><label>Sort results<select value={sort} onChange={(event) => setSort(event.target.value)}><option value="recommended">Recommended</option><option value="rating">Highest rated</option><option value="reviews">Most reviewed</option></select></label><Button variant="outline" onClick={() => { setMinimumRating('0'); setMinimumReviews('0'); setSort('recommended'); }}>Reset filters</Button></div><div className="verification-key"><strong>Know the difference</strong><span><BadgeCheck /> Sahaan verified</span><p>Identity, skills and service standards reviewed by Sahaan.</p><span><Building2 /> Google-listed</span><p>Public business information only; onboarding is still required.</p></div></aside>

      <div className="google-results-shell">
        <div className="results-head google-results-head"><div><strong>{searched ? `${filtered.length} nearby results` : 'Enter a Hyderabad PIN code'}</strong><span>{searched ? `For ${service} near ${pinCode}` : 'Search all Hyderabad launch areas dynamically'}</span></div><span className="google-maps-attribution" translate="no">Google Maps</span></div>

        {error && <div className="connection-state"><ShieldCheck /><h2>Google Maps connection required</h2><p>{error}</p><small>The search interface is ready. A restricted Sahaan Google Places API key is required for live ratings and listings.</small></div>}
        {!searched && !error && <div className="connection-state"><MapPin /><h2>Start with your PIN code</h2><p>Enter any six-digit Hyderabad PIN code to discover relevant nail and beauty businesses nearby.</p></div>}
        {loading && <div className="results-loading"><span /><p>Searching Google Maps around {pinCode}…</p></div>}
        {searched && !loading && !error && filtered.length === 0 && <div className="connection-state"><Search /><h2>No matches under these filters</h2><p>Reduce the rating or review requirement, or try a nearby Hyderabad PIN code.</p></div>}

        {!loading && !error && filtered.length > 0 && <div className="google-place-grid">{filtered.map((place, index) => <article className="google-place-card" key={place.placeId}>
          <div className="place-rank"><span>#{index + 1}</span><div className="google-listing-badge"><Building2 /> Google-listed</div></div>
          <h2>{place.name}</h2><p className="place-category">{place.category}</p>
          <div className="google-rating"><Star fill="currentColor" /><strong>{place.rating?.toFixed(1) || 'New'}</strong>{place.rating && <span>{place.reviewCount.toLocaleString('en-IN')} Google reviews</span>}</div>
          <p className="place-address"><MapPin /> {place.address}</p>
          <div className="place-actions"><Button render={<a href={place.mapsUrl} target="_blank" rel="noreferrer" />}>View on Google Maps <ExternalLink /></Button><button onClick={() => requestSalon(place)}>Request on Sahaan <MessageCircle /></button></div>
          <small>Google Maps ratings are user-generated. This listing is not yet Sahaan-verified.</small>
        </article>)}</div>}
        {searched && <div className="google-content-notice"><span className="google-maps-attribution" translate="no">Google Maps</span><p>Results are ordered using your selected rating and review filters. Google Maps ratings and review counts are user-generated and may change. <a href="https://support.google.com/contributionpolicy/answer/7400114" target="_blank" rel="noreferrer">Learn about Google’s review policy</a>.</p></div>}
      </div>
    </section>

    <section className="directory-trust"><div><MapPin /><strong>PIN-code focused</strong><p>Every six-digit search is sent with Hyderabad and Telangana location context.</p></div><div><Star /><strong>Rating filters</strong><p>Compare average rating and the number of Google Maps reviews together.</p></div><div><BadgeCheck /><strong>Verification stays separate</strong><p>Only professionals who complete Sahaan checks receive the verified badge.</p></div></section>
    <div className="mobile-nav"><a href="/"><Home /><span>Home</span></a><a className="current" href="/professionals"><Search /><span>Nearby</span></a><a href="/partners"><Users /><span>For pros</span></a></div>
  </main>;
}
