import type { GooglePlaceResult } from '@/lib/google-place-types';

const serviceQueries: Record<string, string> = {
  'Gel polish': 'gel polish nail salon',
  'Gel manicure': 'gel manicure nail salon',
  'Nail extensions': 'nail extensions salon',
  'Custom nail art': 'nail art salon',
  'Manicure': 'manicure nail salon',
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

type SearchInput = { service: string; pinCode?: string; latitude?: number; longitude?: number; businessName?: string };

function distanceKm(latA: number, lngA: number, latB: number, lngB: number) {
  const toRadians = (value: number) => value * Math.PI / 180;
  const latDelta = toRadians(latB - latA);
  const lngDelta = toRadians(lngB - lngA);
  const a = Math.sin(latDelta / 2) ** 2 + Math.cos(toRadians(latA)) * Math.cos(toRadians(latB)) * Math.sin(lngDelta / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function searchPlaces({ service, pinCode, latitude, longitude, businessName = '' }: SearchInput) {
  const byLocation = latitude !== undefined && longitude !== undefined;

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    return Response.json({
      error: 'Nearby listings are temporarily unavailable. Please send Sahaan a manual match request.',
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
      textQuery: byLocation ? query : businessName
        ? `${businessName} ${query} near ${pinCode}, Hyderabad, Telangana, India`
        : `${query} near ${pinCode}, Hyderabad, Telangana, India`,
      maxResultCount: 20,
      includePureServiceAreaBusinesses: true,
      languageCode: 'en',
      regionCode: 'IN',
      rankPreference: byLocation ? 'DISTANCE' : 'RELEVANCE',
      ...(byLocation ? { locationBias: { circle: { center: { latitude, longitude }, radius: 12000 } } } : {}),
    }),
    cache: 'no-store',
  });

  if (!googleResponse.ok) {
    const message = googleResponse.status === 403
      ? 'Nearby listings are temporarily unavailable. Please send Sahaan a manual match request.'
      : 'Google Maps could not complete this search. Please try again shortly.';
    return Response.json({ error: message, code: 'GOOGLE_REQUEST_FAILED' }, { status: 502, headers: { 'Cache-Control': 'no-store' } });
  }

  const payload = await googleResponse.json() as { places?: GooglePlace[] };
  const unique = new Map<string, GooglePlaceResult>();
  for (const place of payload.places || []) {
    if (!place.id || !place.displayName?.text || place.businessStatus === 'CLOSED_PERMANENTLY') continue;
    const distance = byLocation && typeof place.location?.latitude === 'number' && typeof place.location?.longitude === 'number'
      ? distanceKm(latitude, longitude, place.location.latitude, place.location.longitude) : undefined;
    if (byLocation && distance !== undefined && distance > 25) continue;
    unique.set(place.id, {
      placeId: place.id,
      name: place.displayName.text,
      address: place.formattedAddress || (byLocation ? 'Near your current area' : `Near ${pinCode}, Hyderabad`),
      rating: typeof place.rating === 'number' ? place.rating : null,
      reviewCount: place.userRatingCount || 0,
      category: place.primaryTypeDisplayName?.text || 'Beauty professional',
      mapsUrl: place.googleMapsUri || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.displayName.text)}`,
      latitude: place.location?.latitude ?? null,
      longitude: place.location?.longitude ?? null,
      businessStatus: place.businessStatus || 'OPERATIONAL',
      ...(distance !== undefined ? { distanceKm: Math.round(distance * 10) / 10 } : {}),
    });
  }

  return Response.json({
    places: [...unique.values()],
    pinCode,
    locationMode: byLocation ? 'current' : 'pin',
    service,
    source: 'Google Maps',
    notice: 'Google Maps ratings and review counts are user-generated and do not mean the business is Sahaan-verified.',
  }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const pinCode = (url.searchParams.get('pin') || '').trim();
  if (!/^\d{6}$/.test(pinCode)) {
    return Response.json({ error: 'Enter a valid 6-digit Hyderabad PIN code.', code: 'INVALID_PIN' }, { status: 400 });
  }
  return searchPlaces({ pinCode, service: (url.searchParams.get('service') || 'Gel polish').trim(), businessName: (url.searchParams.get('name') || '').trim().slice(0, 80) });
}

export async function POST(request: Request) {
  let body: { latitude?: unknown; longitude?: unknown; service?: unknown };
  try { body = await request.json(); } catch {
    return Response.json({ error: 'Invalid location request.', code: 'INVALID_LOCATION' }, { status: 400 });
  }
  const latitude = body.latitude;
  const longitude = body.longitude;
  if (typeof latitude !== 'number' || typeof longitude !== 'number' || !Number.isFinite(latitude) || !Number.isFinite(longitude)
    || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return Response.json({ error: 'Could not read your location. Try PIN-code search instead.', code: 'INVALID_LOCATION' }, { status: 400 });
  }
  if (distanceKm(latitude, longitude, 17.385, 78.487) > 70) {
    return Response.json({ error: 'Sahaan is launching in Hyderabad. Search a Hyderabad PIN code or contact us for help.', code: 'OUTSIDE_LAUNCH_AREA' }, { status: 400 });
  }
  const service = typeof body.service === 'string' ? body.service.trim() : 'Gel polish';
  return searchPlaces({ latitude, longitude, service: serviceQueries[service] ? service : 'Gel polish' });
}
