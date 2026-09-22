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
};

export type GooglePlaceSearchResponse = {
  places: GooglePlaceResult[];
  pinCode: string;
  service: string;
  source: 'Google Maps';
  notice: string;
};
