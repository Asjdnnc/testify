import { handlePaymentWebhook } from "@/lib/services/payment.service.js";
import { errorResponse } from "@/lib/server-auth.js";

// POST /api/payments/webhook/razorpay
// Handles BOTH:
//   1. Checkout handler callback from the browser:
//      { razorpay_order_id, razorpay_payment_id, razorpay_signature }
//      → signature = HMAC_SHA256(order_id|payment_id, RAZORPAY_KEY_SECRET)
//   2. Server-to-server Razorpay webhooks (event: "payment.captured"):
//      → X-Razorpay-Signature = HMAC_SHA256(rawBody, RAZORPAY_WEBHOOK_SECRET)
export async function POST(req) {
  try {
    // Read raw body for signature verification
    const rawBody = await req.text();
    let body;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return Response.json({ success: false, message: "Invalid JSON body" }, { status: 400 });
    }

    const headerSignature = req.headers.get("x-razorpay-signature") || null;

    const result = await handlePaymentWebhook("razorpay", body, headerSignature, rawBody);

    return Response.json({ success: true, ...result });
  } catch (error) {
    return errorResponse(error);
  }
}
