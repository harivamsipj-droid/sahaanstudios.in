# Three-month manual WhatsApp booking pilot

Sahaan will not use the WhatsApp API during this pilot. The existing WhatsApp Business app number stays in the app. The website saves requests and verifies Razorpay payment, but a staffed booking desk assigns artists and sends both appointment messages manually. No programmatic WhatsApp message is sent in manual mode.

## Customer promise

The booking desk is staffed daily, 10:00 am–11:00 pm India time. Within **two staffed hours after captured payment**, staff must either (a) confirm the professional and appointment to the customer on WhatsApp or (b) contact the customer to offer another agreed time or a full refund. The deadline pauses outside staffed hours. The customer sees the exact deadline on the private payment page after payment; paying is not itself a confirmed appointment.

Do not advertise this promise or accept real payments unless a named person can monitor the queue throughout those hours, including weekends and holidays. Use a second staff member as cover. The admin desk shows overdue paid requests, but it is **not** a push alert. Check the desk at least every 15 minutes and reconcile Razorpay payments against the booking list each day. If the site or WhatsApp is down, use Sahaan's documented phone escalation and pause new payment links.

## Operating steps

1. Customer submits an enquiry. Staff verifies the treatment, the published travel-inclusive price, any extras, the address, an artist's rate and availability, and a fallback artist if possible. No guessed or Google-listed availability.
2. Staff creates a private, expiring itemised quote in `/admin/bookings` and shares that payment link only with the customer. The customer reviews and accepts the quote, refund policy, and WhatsApp contact before Razorpay opens.
3. The website accepts only **captured, server-verified** payment and records `paid_unassigned`. The customer receives on-screen acknowledgement and a time-specific confirmation deadline. No automatic WhatsApp acknowledgement is promised.
4. Staff checks the paid queue, confirms the artist accepts the exact scope, time, price and travel, and records the assignment. Copy the customer and artist messages from the booking desk into the **correct chats in the WhatsApp Business app**. Send both. Mark each message as sent in the booking desk only after actually sending it. The sent marker is a staff attestation, not delivery/read proof; check the replies.
5. If the agreed service cannot be arranged, contact the customer before the deadline. Offer an agreed alternative or a full refund. For an approved refund, initiate it manually in Razorpay within the published two-business-day period and retain the Razorpay reference. The signed `refund.processed` webhook updates the booking status; check that it did.

## Safe configuration

Do not turn on live payment from a code deployment. Before any real booking: verify Hostinger MySQL persistence and backups, signed **live** Razorpay webhook with its separate `RAZORPAY_LIVE_WEBHOOK_SECRET`, live keys stored privately in Hostinger, payment capture, one small real payment and refund, the refund policy, staff coverage, and the exact pilot end date. Set `SAHAAN_NOTIFICATION_MODE=manual`, `SAHAAN_MANUAL_PILOT_END=YYYY-MM-DD` (three calendar months after the actual live start), `SAHAAN_PAYMENT_TEST_MODE=0`, `SAHAAN_POLICY_APPROVED=1`, and only then `SAHAAN_PAYMENTS_ENABLED=1`. Never put secrets in GitHub. Leave `SAHAAN_WHATSAPP_REQUESTS_ENABLED=0` during this manual pilot so the separate enquiry acknowledgement does not try to use Meta.

At the pilot end date, the server stops new quotes and payment orders; existing paid bookings remain accessible for fulfilment and refunds. Review conversion, missed deadlines, artist reliability, complaint/refund volume and WhatsApp workload before extending the pilot or switching to approved API automation.
