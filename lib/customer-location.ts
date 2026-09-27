export type CustomerLocation = { latitude: number; longitude: number; savedAt: number };

const storageKey = 'sahaan-customer-location';
const maxAgeMs = 10 * 60 * 1000;

export function saveCustomerLocation(latitude: number, longitude: number) {
  // Around 100 m precision is enough to find nearby businesses without retaining exact GPS coordinates.
  const location: CustomerLocation = {
    latitude: Number(latitude.toFixed(3)),
    longitude: Number(longitude.toFixed(3)),
    savedAt: Date.now(),
  };
  sessionStorage.setItem(storageKey, JSON.stringify(location));
  return location;
}

export function readCustomerLocation(): CustomerLocation | null {
  try {
    const raw = sessionStorage.getItem(storageKey);
    if (!raw) return null;
    const value = JSON.parse(raw) as CustomerLocation;
    if (!Number.isFinite(value.latitude) || !Number.isFinite(value.longitude) || !Number.isFinite(value.savedAt)
      || value.savedAt > Date.now() || Date.now() - value.savedAt > maxAgeMs) {
      sessionStorage.removeItem(storageKey);
      return null;
    }
    return value;
  } catch {
    return null;
  }
}

export function getCustomerPosition(): Promise<CustomerLocation> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Your browser cannot detect your location. Search by PIN code instead.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        try { resolve(saveCustomerLocation(coords.latitude, coords.longitude)); }
        catch { reject(new Error('Could not keep your location for the results page. Please search by PIN code instead.')); }
      },
      (error) => reject(new Error(error.code === 1
        ? 'Location access was declined. You can search by PIN code instead.'
        : 'We could not detect your location. Please try again or search by PIN code.')),
      { enableHighAccuracy: false, timeout: 12000, maximumAge: 60000 },
    );
  });
}
