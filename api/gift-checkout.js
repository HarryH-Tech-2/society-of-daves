import { handleGiftCheckout } from '../lib/gift.js';

export const POST = (request) => handleGiftCheckout(request, process.env);
