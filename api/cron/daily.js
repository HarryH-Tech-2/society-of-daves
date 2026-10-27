// Delivers gift memberships that are due and ends ones that have run out.
// Called daily by .github/workflows/daily.yml with the CRON_SECRET.

import { handleDailyCron } from '../../lib/gift.js';

export const POST = (request) => handleDailyCron(request, process.env);
