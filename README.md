# Forever Florals

A responsive Vite site for Forever Florals. The seven compressed product
photos and brand logo are served from `public/images`, so image links stay
portable when the site is deployed and do not contain local computer paths.

## Run locally

1. Install Node.js (LTS).
2. In this folder, run `npm install`.
3. Run `npm run dev` and open the local URL printed by Vite.
4. Run `npm run build` to produce the deployable `dist` folder.

### Preview the admin dashboard locally

Start the Vite development server and open `/admin`. In local development,
the dashboard opens directly with fictional sample orders; order actions and
emails are disabled. This preview is enabled only in Vite development mode and
is not available in production builds or deployments.

## Order flow

Bouquet cards and the "Order Now" button open a separate order page. Customers
can add multiple bouquets, adjust quantities, select toppers and wrapping,
provide delivery and event details, and attach an inspiration photo. The cart
is stored in the customer's browser. The order page estimates priced bouquets
and selected priced toppers, including the quantity of each priced topper;
custom bouquet prices, delivery charges, and other quoted items are confirmed
by the shop before payment. The site does not
process payments.

Order submissions are processed by the Vercel serverless endpoint in `api/orders.js`.
The endpoint validates the submitted order, stores it in Supabase, uploads any
inspiration photo to a private Storage bucket, emails the shop through Resend,
and sends the customer an order-received acknowledgement. The shop notification
and customer acknowledgement are attempted independently; an email failure
does not discard the saved order.
The private `/admin` dashboard lets the allowlisted admin review inquiries,
set a confirmed total, and email the customer a bank-transfer invoice. Once the
invoice is sent, the admin can mark the order paid. Lifetime purchase count and
JMD revenue include paid orders only. Admins can update invoice bank details and
customer-facing payment instructions in the dashboard, and save a customer
message on each order to include in its invoice. The message becomes read-only
after the first invoice is sent. No online payment is processed.

The dashboard uses Supabase Auth email/password sign-in. Create both admin
accounts yourself and disable public sign-ups in Supabase. Admins can request a
secure password setup/reset link from the dashboard, save a password on the
verified recovery page, then sign in with that password. Server APIs independently verify
the signed-in account against the comma-separated `ORDER_ADMIN_EMAILS` allowlist;
the browser-side allowlist is only a convenience and is not an authorization
control.

Supabase service-role and Resend API keys are server-only environment variables
and must never use a `VITE_` prefix. Bank details are stored in the admin-only
Supabase settings table and are included only in invoice emails.

### Connect Supabase and Resend

1. In the Supabase project, open **SQL Editor**, run the migrations in order:
   `supabase/migrations/20261023000000_create_orders.sql`, then
   `supabase/migrations/20261023010000_add_order_confirmation_and_payment.sql`,
   then `supabase/migrations/20261115000000_track_customer_order_email.sql`,
   then `supabase/migrations/20261117000000_admin_payment_settings_and_notes.sql`,
   then `supabase/migrations/20261118000000_order_customer_note.sql`.
   Confirm the `orders` table and private `order-inspiration` Storage bucket were created.
2. In Supabase **Project Settings → API**, copy the project URL and the
   `service_role` secret key. Keep the service-role key private.
3. Generate a long random value for `ORDER_RATE_LIMIT_SECRET` and keep it private.
   It is used to hash request IPs for server-side order rate limiting.
4. In Resend, create an API key. For production delivery, verify a domain you
   own and use an address on that domain as `ORDER_FROM_EMAIL`. Until a domain
   is verified, Resend's test sender can only send to the email address allowed
   by your Resend account; this can prevent both customer receipts and shop
   notifications from reaching their recipients.
5. In Supabase **Authentication → Users**, create admin users for
   `joelguy26@gmail.com` and `Foreverflorals.ltd@gmail.com`. Disable public
   sign-ups so other visitors cannot create accounts. Enable the Supabase
   email/password provider. In **Authentication → URL Configuration**, set the
   **Site URL** to `https://www.foreverflorals.store` and add
   `https://www.foreverflorals.store/admin` to **Redirect URLs**. The
   dashboard explicitly requests that production URL for password resets; if
   you use a custom reset-email template, its link must use
   `{{ .ConfirmationURL }}` rather than linking directly to `{{ .SiteURL }}`.
   Configure Supabase Auth email delivery (SMTP) so password setup/reset links
   reliably reach the admin inboxes.
6. In Vercel, open the project **Settings → Environment Variables** and add
   `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ORDER_RATE_LIMIT_SECRET`,
   `RESEND_API_KEY`, `ORDER_NOTIFICATION_EMAIL` (`Foreverflorals.ltd@gmail.com`),
   `ORDER_FROM_EMAIL`, and
   `ORDER_ADMIN_EMAILS` (`joelguy26@gmail.com,Foreverflorals.ltd@gmail.com`)
   for Production (and Preview if desired). Bank transfer details and
   customer-facing payment notes are entered by an admin in the dashboard.
7. Add `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and
   `VITE_ORDER_ADMIN_EMAILS` (`joelguy26@gmail.com,Foreverflorals.ltd@gmail.com`)
   as a Vercel environment variable for the dashboard build. The anon key is
   public by design; the service-role key must remain
   server-only.
8. Redeploy the latest commit. The order page checks the server endpoint,
   retries transient check failures, and enables submission only when all
   required settings are present.
9. Open `/admin`, sign in with the admin account, and verify inquiries
   appear. Confirm a test order with a final JMD total to send its invoice, then
   mark it paid to check the dashboard's lifetime count and revenue.

If an email notification fails after saving, the order remains in Supabase and
the customer is asked to contact the shop on WhatsApp as a backup. If expected
emails are not arriving, check the Vercel Production values for
`RESEND_API_KEY`, `ORDER_FROM_EMAIL`, and `ORDER_NOTIFICATION_EMAIL`, verify the
sender domain in Resend, redeploy after changing environment variables, and
review the Resend email logs and spam folders.

## Deploy with Vercel

1. Create a Git repository for this folder and push it to GitHub.
2. Import the repository in Vercel. The `vercel.json` configures Vite, the
   `npm run build` command, and the `dist` output folder; Vercel also deploys
   the `api` serverless function.
3. Add the Supabase and Resend server environment variables described above.
4. Add your custom domain in Vercel and follow its DNS instructions.
5. Test the order form and gallery on the deployed domain before sharing it.

The site does not process payments or manage inventory. Bank transfers are
confirmed manually by the shop owner.
