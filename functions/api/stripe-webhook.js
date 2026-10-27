import { handleStripeWebhook } from '../../lib/webhook.js';

export const onRequestPost = ({ request, env }) => handleStripeWebhook(request, env);
