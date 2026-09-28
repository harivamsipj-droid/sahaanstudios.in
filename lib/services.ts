export const customerServices = [
  { name: 'Gel polish', price: '₹499–₹699', duration: '45–75 min', details: 'Solid colour on natural nails; removal is separate.' },
  { name: 'Manicure', price: '₹699–₹1,199', duration: '45–75 min', details: 'Nail shaping and care; gel polish is separate unless quoted.' },
  { name: 'Nail extensions', price: '₹1,399–₹2,499', duration: '2–3 hr 15 min', details: 'Full-hand set; length, material, removal and art affect the quote.' },
  { name: 'Custom nail art', price: '₹75–₹250 / nail', duration: '15–30 min / nail', details: 'Design and complexity determine the work and time.' },
] as const;

export type CustomerServiceName = (typeof customerServices)[number]['name'];
