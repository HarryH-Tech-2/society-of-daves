// Delivers gift memberships that are due and ends ones that have run out.
// Called daily by .github/workflows/daily.yml with the CRON_SECRET.

import { handleDailyCron } from '../../../lib/gift.js';

export const onRequestPost = ({ request, env }) => handleDailyCron(request, env);
