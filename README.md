# Forever Florals

A responsive Vite site for Forever Florals. The seven compressed product
photos and brand logo are served from `public/images`, so image links stay
portable when the site is deployed and do not contain local computer paths.

## Run locally

1. Install Node.js (LTS).
2. In this folder, run `npm install`.
3. Run `npm run dev` and open the local URL printed by Vite.
4. Run `npm run build` to produce the deployable `dist` folder.

## Order flow and email delivery

Bouquet cards and the "Order Now" button open a separate order page. Customers
can add multiple bouquets, adjust quantities, select toppers and wrapping,
provide delivery and event details, and attach an inspiration photo. The cart
is stored in the customer's browser. The order page shows a bouquet subtotal;
custom bouquet prices, extras, and delivery charges are confirmed before
payment. The site does not process payments.

Order enquiries use Formspree; there are no email credentials in the browser.

1. Create a form in the Forever Florals Formspree account and set its recipient
   to the business email address.
2. Copy the form ID from its endpoint, which looks like
   `https://formspree.io/f/FORM_ID`.
3. Create a `.env` file based on `.env.example` and set
   `VITE_FORMSPREE_FORM_ID=FORM_ID`.
4. For a hosted site, add `VITE_FORMSPREE_FORM_ID` to the host's production
   environment variables and redeploy.

Until the form ID is configured, email submission stays disabled and the order
page directs visitors to the existing WhatsApp contact.

## Deploy with Vercel

1. Create a Git repository for this folder and push it to GitHub.
2. Import the repository in Vercel. The `vercel.json` configures Vite, the
   `npm run build` command, and the `dist` output folder.
3. Add the Formspree ID as `VITE_FORMSPREE_FORM_ID` in the Vercel project's
   environment variables before deploying.
4. Add your custom domain in Vercel and follow its DNS instructions.
5. Test the order form and gallery on the deployed domain before sharing it.

The site is prepared for static hosting and hosted form delivery. It does not
include payment processing, inventory, or an order-management dashboard.
