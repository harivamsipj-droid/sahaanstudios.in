# Customer request inbox — launch gate

The mobile-first `/request` journey collects a **preferred** date and time, not a confirmed appointment. It shows indicative service prices and typical work times, then asks the client to submit a request. After a successful website save, the client receives a reference and is invited to open WhatsApp and press **Send**. This click-to-chat is **not** an automatic WhatsApp notification; Meta Business Platform approval is still pending. The request inbox is separate from the disabled payment flow.

## Before publishing as an operational booking channel

1. On Hostinger, create a private MySQL database and user. Set `SAHAAN_MYSQL_HOST`, `SAHAAN_MYSQL_USER`, `SAHAAN_MYSQL_PASSWORD`, and `SAHAAN_MYSQL_DATABASE` in private hosting environment variables. Hostinger's website-file backups currently show only `public_html`, so a SQLite file beside `hbuilds` would not be reliably backed up. The SQLite `SAHAAN_INQUIRY_DATA_FILE` option remains for local development or a separately verified durable backup arrangement; do not put that file in GitHub or a public directory.
2. Configure a random `SAHAAN_ADMIN_TOKEN` of at least 32 characters in the hosting environment. It can be the same private admin token used by the gated payment desk; never put it in GitHub or a URL.
3. After deployment, check `/api/customer-requests/health` returns `{"enabled":true}`. If it returns 503, the form honestly offers WhatsApp-only fallback and **does not** claim a website receipt.
4. Submit a test request using non-personal test details. Verify a reference appears; open `/admin/requests`, enter the admin token privately and confirm the enquiry is present. Then open WhatsApp and make sure the message contains the same reference, service and preferred time. Do not use a real customer's number in a test.
5. Verify Hostinger's database backup includes the new database. Arrange daily monitoring of the inbox, backup and restore tests, and a customer response procedure. Staff must confirm artist coverage, time, service scope, travel and final amount before taking payment. Set a retention and deletion procedure with counsel.

The customer request API checks same-origin submissions, field limits and consent, and avoids repeat submissions from the same phone for the same service/date within two minutes. It has a bot honeypot but **no distributed rate limiter**; add host-level abuse protection before paid campaigns or high traffic.
