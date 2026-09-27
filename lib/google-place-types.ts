export type GooglePlaceResult = {
  placeId: string;
  name: string;
  address: string;
  rating: number | null;
  reviewCount: number;
  category: string;
  mapsUrl: string;
  latitude: number | null;
  longitude: number | null;
  businessStatus: string;
  distanceKm?: number;
};

export type GooglePlaceSearchResponse = {
  places: GooglePlaceResult[];
  pinCode?: string;
  locationMode?: 'current' | 'pin';
  service: string;
  source: 'Google Maps';
  notice: string;
};
