import { handleGiftCheckout } from '../../lib/gift.js';

export const onRequestPost = ({ request, env }) => handleGiftCheckout(request, env);
