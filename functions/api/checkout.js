import { handleCheckout } from '../../lib/checkout.js';

export const onRequestPost = ({ request, env }) => handleCheckout(request, env);
