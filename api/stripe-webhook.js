import { handleStripeWebhook } from '../lib/webhook.js';

export const POST = (request) => handleStripeWebhook(request, process.env);
