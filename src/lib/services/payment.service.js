import prisma from "../prisma.js";
import { getPlanByType } from "./subscription.service.js";
import crypto from "crypto";


// ---------------------------------------------------------------------------
// Payment Service — gateway-agnostic payment lifecycle
// ---------------------------------------------------------------------------
// Gateway integrations are thin wrappers. The spec includes both Razorpay and
// Stripe. Razorpay is the default for INR. Stripe is included as an alternative.
// ---------------------------------------------------------------------------

// ── Razorpay helper ──────────────────────────────────────────────────────────
async function createRazorpayOrder(amountInPaise, currency, receiptId) {
  const key_id = process.env.RAZORPAY_KEY_ID;
  const key_secret = process.env.RAZORPAY_KEY_SECRET;

  if (!key_id || !key_secret) throw new Error("Razorpay credentials not configured");

  const credentials = Buffer.from(`${key_id}:${key_secret}`).toString("base64");

  const response = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: amountInPaise,
      currency,
      receipt: receiptId,
    }),
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(`Razorpay order creation failed: ${err.error?.description || response.statusText}`);
  }

  return response.json(); // { id, amount, currency, receipt, ... }
}

// ── Razorpay signature verification ──────────────────────────────────────────
function safeEqualHex(expected, received) {
  if (typeof received !== "string" || received.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(received));
}

// Checkout callback: HMAC(order_id|payment_id, key_secret)
function verifyRazorpaySignature(orderId, paymentId, signature) {
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret || !orderId || !paymentId) return false;
  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");

  return safeEqualHex(expectedSignature, signature);
}

// Server webhook: HMAC(raw body, webhook_secret)
function verifyRazorpayWebhookSignature(rawBody, signature) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret || !rawBody) return false;
  const expectedSignature = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  return safeEqualHex(expectedSignature, signature);
}

// ---------------------------------------------------------------------------
// initiatePayment — creates a Payment row (PENDING) and a gateway order
// ---------------------------------------------------------------------------
export async function initiatePayment(collegeId, planType, gateway = "razorpay") {
  if (planType === "TRIAL") throw new Error("The trial plan cannot be purchased");
  const plan = await getPlanByType(planType);
  if (!plan.isActive) throw new Error("This plan is not available");

  const college = await prisma.college.findUnique({
    where: { id: collegeId },
    select: { id: true, name: true, subscriptionStatus: true, deletedAt: true },
  });
  if (!college || college.deletedAt) throw new Error("College not found");

  const receiptId = `testify_${collegeId.slice(0, 8)}_${Date.now()}`;
  let gatewayOrderId = null;

  if (gateway === "razorpay") {
    const order = await createRazorpayOrder(plan.priceInPaise, plan.currency, receiptId);
    gatewayOrderId = order.id;
  } else {
    throw new Error(`Gateway "${gateway}" not supported yet`);
  }

  const payment = await prisma.payment.create({
    data: {
      collegeId,
      amountInPaise: plan.priceInPaise,
      currency: plan.currency,
      status: "PENDING",
      planType,
      gateway,
      gatewayOrderId,
    },
  });

  return {
    payment,
    gatewayOrderId,
    amount: plan.priceInPaise,
    currency: plan.currency,
    key: process.env.RAZORPAY_KEY_ID, // sent to frontend for Razorpay checkout
  };
}

// ---------------------------------------------------------------------------
// handlePaymentWebhook — verifies signature, idempotent, activates subscription
// ---------------------------------------------------------------------------
export async function handlePaymentWebhook(gateway, body, headerSignature = null, rawBody = null) {
  if (gateway !== "razorpay") throw new Error("Unsupported gateway");

  let orderId, paymentId, paidAmount = null;

  if (body?.event) {
    // ── Server-to-server webhook ──
    if (!verifyRazorpayWebhookSignature(rawBody, headerSignature)) {
      throw Object.assign(new Error("Invalid webhook signature"), { statusCode: 400 });
    }

    if (body.event === "payment.failed") {
      const entity = body.payload?.payment?.entity;
      if (entity?.order_id) {
        await handlePaymentFailure(entity.order_id, entity.error_description).catch(() => {});
      }
      return { handled: true, event: body.event };
    }

    // Only handle successful payment events
    if (body.event !== "payment.captured" && body.event !== "order.paid") {
      return { skipped: true, event: body.event };
    }

    const entity = body.payload?.payment?.entity;
    orderId = entity?.order_id;
    paymentId = entity?.id;
    paidAmount = entity?.amount ?? null;
  } else {
    // ── Browser checkout callback ──
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body || {};
    if (!verifyRazorpaySignature(razorpay_order_id, razorpay_payment_id, razorpay_signature)) {
      throw Object.assign(new Error("Invalid webhook signature"), { statusCode: 400 });
    }
    orderId = razorpay_order_id;
    paymentId = razorpay_payment_id;
  }

  if (!orderId || !paymentId) throw Object.assign(new Error("Malformed payment payload"), { statusCode: 400 });

  // Find the payment by gateway order ID
  const payment = await prisma.payment.findFirst({
    where: { gatewayOrderId: orderId },
  });
  if (!payment) throw Object.assign(new Error("Payment not found"), { statusCode: 404 });

  // Idempotency: callback + webhook both fire for the same payment
  if (payment.status === "SUCCESS") return { idempotent: true, paymentId: payment.id };

  if (paidAmount !== null && paidAmount !== payment.amountInPaise) {
    throw Object.assign(new Error("Payment amount mismatch"), { statusCode: 400 });
  }

  // Activate subscription
  await activateSubscription(payment.collegeId, payment.id, payment.planType, paymentId);

  return { success: true, paymentId: payment.id };
}

// ---------------------------------------------------------------------------
// activateSubscription — atomic: deactivate old sub, create new, update College
// ---------------------------------------------------------------------------
export async function activateSubscription(collegeId, paymentId, planType, gatewayPaymentId = null) {
  const plan = await getPlanByType(planType);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + plan.durationDays * 24 * 60 * 60 * 1000);

  const activated = await prisma.$transaction(async (tx) => {
    // 0. Claim the payment atomically — concurrent callback + webhook must
    //    not create two subscriptions.
    const claimed = await tx.payment.updateMany({
      where: { id: paymentId, status: { not: "SUCCESS" } },
      data: { status: "SUCCESS" },
    });
    if (claimed.count === 0) return false;

    // 1. Deactivate previous subscriptions
    await tx.collegeSubscription.updateMany({
      where: { collegeId, isActive: true },
      data: { isActive: false },
    });

    // 2. Create new subscription
    await tx.collegeSubscription.create({
      data: {
        collegeId,
        paymentId,
        planType,
        startedAt: now,
        expiresAt,
        isActive: true,
      },
    });

    // 3. Update payment to SUCCESS
    await tx.payment.update({
      where: { id: paymentId },
      data: {
        status: "SUCCESS",
        gatewayPaymentId: gatewayPaymentId || undefined,
        paidAt: now,
        billingPeriodStart: now,
        billingPeriodEnd: expiresAt,
      },
    });

    // 4. Update College
    await tx.college.update({
      where: { id: collegeId },
      data: {
        subscriptionStatus: "ACTIVE",
        planType,
        currentPeriodStart: now,
        currentPeriodEnd: expiresAt,
        // Paying reverses any scheduled trial-expiry deletion
        scheduledDeletionAt: null,
      },
    });

    return true;
  });

  return { activated, expiresAt };
}

// ---------------------------------------------------------------------------
// handlePaymentFailure — marks payment as FAILED
// ---------------------------------------------------------------------------
export async function handlePaymentFailure(gatewayOrderId, reason) {
  const payment = await prisma.payment.findFirst({
    where: { gatewayOrderId },
  });
  if (!payment) throw new Error("Payment not found");

  return prisma.payment.update({
    where: { id: payment.id },
    data: { status: "FAILED", failureReason: reason || "Unknown" },
  });
}

// ---------------------------------------------------------------------------
// getPaymentHistory — for the billing dashboard
// ---------------------------------------------------------------------------
export async function getPaymentHistory(collegeId) {
  return prisma.payment.findMany({
    where: { collegeId },
    orderBy: { createdAt: "desc" },
  });
}
