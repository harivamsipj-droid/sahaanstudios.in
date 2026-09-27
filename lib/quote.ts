/** Illustrative, whole-rupee quote arithmetic. Final quotes require artist approval. */
export function calculateQuote(baseWork: number, extraWork: number, travel: number, introductoryBooking = false) {
  const rupees = (value: number) => Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
  const artistService = rupees(baseWork) + rupees(extraWork);
  const artistTravel = rupees(travel);
  const sahaanFee = introductoryBooking ? 0 : Math.round(artistService * 0.2);
  return {
    artistService,
    artistTravel,
    sahaanFee,
    artistPayout: artistService + artistTravel,
    customerTotal: artistService + artistTravel + sahaanFee,
  };
}
