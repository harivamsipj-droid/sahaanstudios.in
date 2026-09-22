import type { GooglePlaceResult } from '@/lib/google-place-types';

const serviceQueries: Record<string, string> = {
  'Gel manicure': 'gel manicure nail salon',
  'Nail extensions': 'nail extensions salon',
  'Custom nail art': 'nail art salon',
  'Classic manicure': 'manicure nail salon',
  'Beauty salon': 'beauty salon',
};

type GooglePlace = {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  rating?: number;
  userRatingCount?: number;
  primaryTypeDisplayName?: { text?: string };
  googleMapsUri?: string;
  location?: { latitude?: number; longitude?: number };
  businessStatus?: string;
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const pinCode = (url.searchParams.get('pin') || '').trim();
  const service = (url.searchParams.get('service') || 'Gel manicure').trim();
  const businessName = (url.searchParams.get('name') || '').trim().slice(0, 80);

  if (!/^\d{6}$/.test(pinCode)) {
    return Response.json({ error: 'Enter a valid 6-digit Hyderabad PIN code.', code: 'INVALID_PIN' }, { status: 400 });
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    return Response.json({
      error: 'Live Google Maps results are ready to connect. The Sahaan Google Places API key has not been added yet.',
      code: 'GOOGLE_NOT_CONNECTED',
    }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }

  const query = serviceQueries[service] || serviceQueries['Beauty salon'];
  const googleResponse = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.primaryTypeDisplayName,places.googleMapsUri,places.location,places.businessStatus',
    },
    body: JSON.stringify({
      textQuery: businessName
        ? `${businessName} ${query} near ${pinCode}, Hyderabad, Telangana, India`
        : `${query} near ${pinCode}, Hyderabad, Telangana, India`,
      maxResultCount: 20,
      includePureServiceAreaBusinesses: true,
      languageCode: 'en',
      regionCode: 'IN',
      rankPreference: 'RELEVANCE',
    }),
    cache: 'no-store',
  });

  if (!googleResponse.ok) {
    const message = googleResponse.status === 403
      ? 'Google Places access is not active for this key. Enable Places API (New), billing, and API restrictions in Google Cloud.'
      : 'Google Maps could not complete this search. Please try again shortly.';
    return Response.json({ error: message, code: 'GOOGLE_REQUEST_FAILED' }, { status: 502, headers: { 'Cache-Control': 'no-store' } });
  }

  const payload = await googleResponse.json() as { places?: GooglePlace[] };
  const unique = new Map<string, GooglePlaceResult>();
  for (const place of payload.places || []) {
    if (!place.id || !place.displayName?.text || place.businessStatus === 'CLOSED_PERMANENTLY') continue;
    unique.set(place.id, {
      placeId: place.id,
      name: place.displayName.text,
      address: place.formattedAddress || `Near ${pinCode}, Hyderabad`,
      rating: typeof place.rating === 'number' ? place.rating : null,
      reviewCount: place.userRatingCount || 0,
      category: place.primaryTypeDisplayName?.text || 'Beauty professional',
      mapsUrl: place.googleMapsUri || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.displayName.text)}`,
      latitude: place.location?.latitude ?? null,
      longitude: place.location?.longitude ?? null,
      businessStatus: place.businessStatus || 'OPERATIONAL',
    });
  }

  return Response.json({
    places: [...unique.values()],
    pinCode,
    service,
    source: 'Google Maps',
    notice: 'Google Maps ratings and review counts are user-generated and do not mean the business is Sahaan-verified.',
  }, { headers: { 'Cache-Control': 'no-store' } });
}
