# Customer accounts, coupons and stock limits

The public collection remains accessible without registration. Customers can keep a device-local cart and guest favorites. Verified accounts save favorites and notification read state in D1 and own their order history. Existing Sites / ChatGPT staff sign-in remains available. A verified password account can access staff functions only when its verified email already belongs to a staff member or invitation. Registration never grants ownership.

## Firebase Authentication

The active provider is Firebase Authentication. The dedicated project is `mb-dryfit-loja-6af1b1` (MB Dryfit Loja), with no billing account linked. Other Firebase projects are independent. Email/password sign-in is enabled. Signup, email verification links and password-reset links use the Firebase Web SDK and Google's default hosted action handler (the MB `/conta/acao` handler is prepared but not linked by outbound email). Verification links do not use a six-digit code. After opening the link, customers return to the storefront and choose “Já confirmei meu e-mail”.

Configure these production runtime values with native Sites environment-variable tools, then deploy a saved version:

- `FIREBASE_PROJECT_ID`
- `FIREBASE_WEB_API_KEY`
- `FIREBASE_APP_ID`
- `FIREBASE_AUTH_DOMAIN`

The Web SDK configuration is intentionally public through `/api/account/firebase/config`; it does not include an administrator credential or service-account key. Never put administrative credentials, OAuth refresh tokens or real passwords in source or runtime client bundles. The browser sends passwords directly to Firebase. Firebase SDK persistence renews its ID tokens. The Worker independently verifies the RS256 signature against Google's published signing keys, the exact project audience and issuer, expiry, issue/authentication timestamps and verified email. Unverified accounts can stage a profile, but cannot receive a local session or access account history.

Local session tokens are random 256-bit values; D1 stores their SHA-256 digests. Cookies use `Secure`, `HttpOnly`, `SameSite=Lax` and the `__Host-` prefix. Firebase-backed sessions never outlive the Firebase ID token (at most one hour). The browser renews them when Firebase refreshes its token, on returning to the page and periodically. Disabled users and password resets revoke Firebase refresh credentials; an already-issued local session can remain usable until its one-hour token expires. Explicit sign-out clears both Firebase's browser state and the local cookie.

Existing profiles link only after a verified Firebase token matches their email; account IDs, favorites and order history remain intact. First-time links revoke old local sessions. A linked Firebase UID cannot be replaced by another UID with the same email. Existing Sites / ChatGPT staff sign-in remains available. Staff roles and invitations are still checked on the server; registration never grants ownership. Birth dates and emails are not public catalog fields.

Migrations are additive: `0013_firebase_accounts.sql` adds the Firebase identity binding and expiring pending profiles. The legacy PBKDF2/code implementation is retained for compatibility when Firebase runtime configuration is absent. Its registration/login/reset routes are explicitly disabled while Firebase is configured. No Brevo sender is required for the active setup.

The test suite mocks email delivery and Firebase SDK calls, and signs test ID tokens with a test RSA key. A live probe with nonexistent credentials confirmed the deployed Firebase email/password endpoint is active without creating a customer or sending email. Delivery to a real mailbox and the full browser flow still require a user signup. SDK script URLs and Google's signing-key endpoint were checked separately.

A branded HTML reset email is prepared in `email-templates/password-reset.html`; the responsive `/conta/acao` page supports verified Firebase action codes for confirmation and password recovery. They are **not active in outbound emails**: Google rejected supported template edits (including reset templates and the callback URL) with `400 EMAIL_TEMPLATE_UPDATE_NOT_ALLOWED`. The existing default Firebase templates and default hosted action URL remain active. No real email was sent while testing. Do not claim the custom template was applied; activation needs the provider restriction resolved or a separately authorized email sender. See the Firebase project issue https://github.com/firebase/firebase-tools/issues/10188 and the official customization reference https://support.google.com/firebase/answer/7000714. No custom SMTP provider or billing upgrade is configured.

The owner-confirmed shared vendor email is applied once from `MB_INITIAL_VENDOR_EMAIL` using `vendor_access_bootstrap`, outside schema migrations. Later owner edits remain authoritative. This authorizes the shared account but does not create or reveal its Firebase password. The operator creates the password and confirms the mailbox on first access.

The owner has a dedicated **Vendas por vendedor** tab with date presets, custom dates, seller filtering and all directory entries (zero sales included). Notifications remain in-site bell events; they are not email marketing or browser push alerts.

The Firebase CLI configuration is retained in `firebase/`. Run official Firebase CLI commands from that directory with the intended Google account selected; deploy only `auth` when updating providers. This does not move the catalog, inventory, photos or Sites hosting to Firebase. Verification/reset mail follows Firebase's free-plan quotas; no billing upgrade was made.

## Coupons and orders

The owner manages percentage, total use limit, start/end times, enabled state and an optional one-use-per-account rule under **Cupons e pedidos**. Ordinary coupons work with guest orders. The optional account rule requires a verified account. Previews never consume uses. Registering a submitted order atomically claims a coupon use; D1 triggers enforce availability, dates, limits and per-account rules even under concurrent requests. Idempotent request keys prevent duplicate orders and redemptions. Reloading a registered order uses a read-only receipt endpoint and never claims the coupon again; account receipts require the same verified account, and guest receipts require their unguessable order/request keys. Cancelling an unsold order returns its use. Old receipts preserve their agreed prices and discount.

Order submission does not reserve or subtract stock; it creates a request for the shop to confirm. The owner can load that order into the POS. The POS validates exact products, quantities and prices, allocates the discount in integer cents across sale lines and records the actual net amount. An order can be sold only once. Real sale triggers subtract stock; reopening the receipt never subtracts it again. Sold orders cannot return their coupon use by changing order status.

Public product/quote responses provide the available quantity of published variations so the selector and cart can enforce stock limits. Existing Nex reservations are subtracted. Every add rechecks stock server-side; cart quantities shrink when stock falls. Checkout validates again. Neither stock counts for private models nor barcodes/references are exposed by customer endpoints.

Notifications are inside the site: first publication of a model and transitions from unavailable to available create bounded, deduplicated events. Unpublished/private models never appear. No email marketing or browser push is enabled.
