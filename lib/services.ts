import { standardServicePrices } from './pricing.mjs';

export const customerServices = [
  { name: 'Gel polish', price: standardServicePrices['Gel polish'].display, duration: '45–75 min', details: 'Solid colour on both hands; old polish removal is not included.' },
  { name: 'Manicure', price: standardServicePrices['Manicure'].display, duration: '75 min', details: 'Advanced hand care with regular polish; gel polish is a separate add-on.' },
  { name: 'Nail extensions', price: standardServicePrices['Nail extensions'].display, duration: '2–3 hr 15 min', details: 'Basic full-hand extension set; removal and custom art are separate.' },
  { name: 'Custom nail art', price: 'Design quote', duration: 'Depends on design', details: 'Share a design and nail count. Sahaan will confirm one total including travel before payment.' },
] as const;

export type CustomerServiceName = (typeof customerServices)[number]['name'];
