import { handleCheckout } from '../lib/checkout.js';

export const POST = (request) => handleCheckout(request, process.env);
