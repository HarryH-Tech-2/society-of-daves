# The Society of Daves

societyofdaves.com is a parody members' club for people called Dave. Visitors pay $1 a month through Stripe and get The Dave Dispatch, a monthly newsletter sent with Resend.

## How it fits together

```
content/posts.mjs       Blog posts (edit these, then `npm run build`)
scripts/build.mjs       Generates the blog, sitemap, RSS, llms.txt and parts of index.html
scripts/site.mjs        Shared header/footer/chart templates for generated pages
scripts/og.html         Source for public/og.png (the social share image)
public/                 Static site (Vercel serves this; vercel.json sets the build)
  index.html            Landing page (regions marked <!-- build:... --> are generated)
  blog/                 Generated: blog index + one folder per post
  sitemap.xml, rss.xml, llms.txt   Generated
  robots.txt            Allows search engines and AI crawlers, points to the sitemap
  welcome.html          Shown after a successful payment (/welcome)
  privacy.html, terms.html
api/                    Vercel Functions (server side)
  checkout.js           POST /api/checkout      -> creates a Stripe Checkout session, redirects to Stripe
  gift-checkout.js      POST /api/gift-checkout -> creates a one-off gift payment
  stripe-webhook.js     POST /api/stripe-webhook -> Stripe events -> Resend list + welcome email
  manage.js             GET  /api/manage        -> redirects to Stripe's customer portal
  cron/daily.js         POST /api/cron/daily    -> delivers and ends gift memberships
lib/                    The logic behind those functions (tested in test/)
```

Flow: **Join button** → `/api/checkout` → Stripe's hosted payment page → `/welcome`.
Separately, Stripe calls `/api/stripe-webhook`:
- `checkout.session.completed` → contact added to Resend (or re-subscribed) and welcome email sent
- `customer.subscription.deleted` → contact marked unsubscribed in Resend

## Setup checklist

### 1. Domain (Namecheap)
Register `societyofdaves.com` on Namecheap. Point it at Vercel in step 4. The Resend DNS records also go in Namecheap (**Domain List → Manage → Advanced DNS**).

### 2. Stripe
1. Create a Stripe account and finish activation (business details, bank account).
2. **Developers → API keys**: copy the secret key into `.env.local` as `STRIPE_SECRET_KEY` (copy `.env.example` first). Use the test-mode key (`sk_test_`) until everything works.
3. Run **`npm run stripe:setup`**. It creates the $1/month membership price, the $6 and $12 gift prices and the customer portal, then prints `STRIPE_PRICE_ID`, `STRIPE_GIFT_PRICE_6`, `STRIPE_GIFT_PRICE_12` and `STRIPE_PORTAL_URL`. Running it again is safe.
4. Once the site is live, run **`npm run stripe:setup -- --webhook`** to create the webhook for `https://societyofdaves.com/api/stripe-webhook` and print `STRIPE_WEBHOOK_SECRET`.
5. When you switch to live mode, put the `sk_live_` key in `.env.local` and run steps 3 and 4 again. Live mode has its own prices, portal and webhook.
6. Optional: under **Settings → Payments**, turn on Apple Pay and Google Pay. They make a $1 impulse purchase much easier on phones.

### 3. Resend
1. **Domains → Add domain**: `societyofdaves.com`. Add the DNS records it gives you in Namecheap's Advanced DNS. The free plan allows 3 domains.
2. **API keys → Create**: full access (the key needs contacts as well as sending) → `RESEND_API_KEY`.
3. Optional: create a segment called "Members" and put its ID in `RESEND_SEGMENT_ID`, so Broadcasts can target paying members only.
4. Send The Dave Dispatch each month from **Broadcasts**. Resend adds the unsubscribe link for you.

Free plan limits to keep an eye on: 1,000 marketing contacts and 100 transactional emails a day. That's fine until a campaign brings in more than about 100 sign-ups in a day, or the list passes 1,000 members. Pro is $20/month.

### 4. Vercel
1. In Vercel, **Add New → Project** and import the GitHub repo. `vercel.json` already sets the build command (`npm run build`), the output directory (`public`) and clean URLs (`/welcome` serves `welcome.html`). Leave the framework preset as "Other".
   Or deploy straight from your machine: `npx vercel login`, then `npm run deploy`.
2. **Settings → Environment Variables**: add `SITE_URL` (`https://societyofdaves.com`), `EMAIL_FROM`, `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID`, `STRIPE_GIFT_PRICE_6`, `STRIPE_GIFT_PRICE_12`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PORTAL_URL`, `RESEND_API_KEY`, `RESEND_SEGMENT_ID` (optional) and `CRON_SECRET`. Redeploy after changing them, because a deployment only sees the variables that existed when it was built.
3. **Settings → Domains**: add `societyofdaves.com` and `www.societyofdaves.com`, with one redirecting to the other. Then in Namecheap **Advanced DNS**, delete the parking records and add:
   - `A` record, host `@`, value `76.76.21.21`
   - `CNAME` record, host `www`, value `cname.vercel-dns.com.`

   If Vercel shows different values, use those. HTTPS turns on by itself once Vercel shows "Valid Configuration".

### 5. Test it end to end (Stripe test mode)
1. Pay with card `4242 4242 4242 4242`, any future expiry date and any CVC.
2. Check that you land on `/welcome`, the welcome email arrives, and the contact appears in Resend.
3. Cancel in the customer portal. The contact should show as unsubscribed in Resend.
4. Switch to live keys, live price ID and a live webhook secret.

## Local development

```
npm install
cp .env.example .env.local        # fill in test keys
npm run dev                       # http://localhost:3000 (Vercel CLI; asks you to log in and link the project the first time)
npm test
```

To get webhooks on your machine: `stripe listen --forward-to localhost:3000/api/stripe-webhook` (Stripe CLI). Put the `whsec_` it prints in `.env.local`.

## Gift memberships (Christmas)

`/gift` sells one-off gift memberships: **$6 for 6 months** or **$12 for 12 months**. The buyer chooses Christmas Day, straight away, or a date, and adds a message.

How it works:
1. `/api/gift-checkout` creates a one-off Stripe payment. No Stripe product setup is needed, because the price is set in code (`GIFT_PLANS` in `lib/gift.js`). The gift details are stored in the payment's metadata, so Stripe acts as the database.
2. When payment completes, the webhook emails the buyer a confirmation. If the gift is due today, it delivers it straight away.
3. **A daily job** (`/api/cron/daily`, run by `.github/workflows/daily.yml` at 07:00 UTC) delivers gifts that are due, including all Christmas Day gifts. It also ends gifts that have run out: it unsubscribes the recipient and emails them an invitation to join for $1 a month. It never removes someone who has since become a paying member.

Setup:
- Make up a long random string and add it as `CRON_SECRET` in Vercel (environment variables) **and** in GitHub (Settings → Secrets and variables → Actions). Also add `SITE_URL` (`https://societyofdaves.com`) as a GitHub secret.
- The daily job runs from GitHub Actions, so the code must be in a GitHub repo. You can trigger it by hand from the Actions tab ("Run workflow") to test it.
- Test it in Stripe test mode: buy a gift with "Straight away" and check that both emails arrive. Then buy one with a date of tomorrow, and run the workflow by hand the next day.

**Watch the Resend limits before Christmas.** The free plan sends at most 100 emails a day. If more than about 90 gifts are booked for Christmas Day, upgrade to Resend Pro ($20/month) for December, or some gifts will be delayed until the job runs again on 26 December.

## Images

- Cover images (`public/images/covers/`) double as each post's social share image. Regenerate them with `bash scripts/covers.sh` (needs the `agent-browser` CLI) after adding a post. Add a `render` line for the new post first.
- Photos (`public/images/blog/`) come from Wikimedia Commons. They're public domain or Creative Commons, and each is credited under the photo. Their credits and licences are in `content/images.mjs`. Use one in a post with `<!-- figure:KEY -->`.
- Links to other websites in posts open in a new tab automatically.

## Writing blog posts

Add an entry to `content/posts.mjs`. Each post needs a `slug`, `title`, `description` (the Google snippet, under about 160 characters), `date`, `dek`, `takeaways` (3 short answers shown at the top), `body` (HTML), `faqs` and `sources`. Then run `npm run build`. The post page, blog index, homepage "From the Dave Blog" list, sitemap, RSS feed and llms.txt all update together.

What's already in place for SEO and AEO (answer engines such as Google AI Overviews, ChatGPT and Perplexity):
- Each post opens with a direct answer and a "short version" box, and uses question-style headings.
- Structured data: Organization, WebSite and FAQPage on the homepage (generated from the visible FAQ, so they always match); BlogPosting, BreadcrumbList and FAQPage on every post.
- `sitemap.xml`, `rss.xml`, `robots.txt` (AI crawlers allowed) and `llms.txt`.
- Canonical URLs, Open Graph and Twitter tags, and a share image (`og.png`).
- Every post cites its sources and links to related posts.

After launch, add the site to Google Search Console and Bing Webmaster Tools, and submit `https://societyofdaves.com/sitemap.xml`.

## Tracking ad conversions

The site already passes `gclid` and `utm_*` values from the ad click into Stripe metadata, on both the checkout session and the subscription, so every member can be traced to a campaign.

### Google Analytics 4

Every page loads the GA4 tag for the "Society of Daves" property (`G-0WLED48Q40`). Generated pages get it from `GOOGLE_TAG` in `scripts/site.mjs`. The hand-written pages in `public/` have their own copy of the snippet, so if the ID changes, update both.

Sales are recorded as GA4 `purchase` events. The Stripe session ID is used as the transaction ID, so refreshing the page doesn't count a sale twice:
- `welcome.html` records a $1 membership.
- `gift-sent.html` records a $6 or $12 gift. Stripe adds `plan=6` or `plan=12` to the return URL.

### Google Ads

Link Google Ads to the GA4 property (**GA4 Admin → Product links → Google Ads**). Then import the `purchase` key event as a conversion. There's no separate Ads tag to add. Gift payments also carry `gclid` and `utm_*` in their Stripe metadata.

## Before launch

- [ ] Replace `hello@societyofdaves.com` if you'll use a different address, and make sure that inbox receives mail. Resend only sends; use Namecheap's free email forwarding (**Domain → Redirect Email**) to forward it to your Gmail.
- [ ] Have someone read `privacy.html` and `terms.html` for your country. They are sensible drafts, not legal advice.
- [ ] Google Ads requires a visible price, cancellation terms and contact details. The landing page and footer cover all three.
