import prisma from "../prisma.js";
import { sendCancellationConfirmationEmail } from "../email.js";

// ---------------------------------------------------------------------------
// Cancellation Service — all 4 scenarios from Section 7
// ---------------------------------------------------------------------------
// Scenario A: Trial college requests cancellation
//             scheduledAt = now + 7 days
// Scenario B: Paid college (ACTIVE/SUSPENDED) requests cancellation
//             scheduledAt = currentPeriodEnd + 7 days (or now + 7 if no period)
// Scenario C: Cron job processes scheduled cancellation → soft delete
// Scenario D: SUPER_ADMIN restores a soft-deleted or cancelled college
// ---------------------------------------------------------------------------

const GRACE_DAYS = 7;

// ── Scenario A & B: Request cancellation ────────────────────────────────────
export async function requestCancellation(collegeId, requestedBy, reason) {
  const college = await prisma.college.findUnique({
    where: { id: collegeId },
    select: {
      id: true,
      subscriptionStatus: true,
      currentPeriodEnd: true,
      deletedAt: true,
      cancellationRequest: true,
    },
  });

  if (!college) throw new Error("College not found");
  if (college.deletedAt) throw new Error("College is already deleted");
  if (college.cancellationRequest) {
    throw new Error("A cancellation request is already pending for this college");
  }

  const now = new Date();
  let scheduledAt;

  // Scenario B: paid college — grace extends to currentPeriodEnd + 7 days
  if (
    college.subscriptionStatus === "ACTIVE" &&
    college.currentPeriodEnd &&
    college.currentPeriodEnd > now
  ) {
    scheduledAt = new Date(
      college.currentPeriodEnd.getTime() + GRACE_DAYS * 24 * 60 * 60 * 1000
    );
  } else {
    // Scenario A: trial or expired — 7 days from now
    scheduledAt = new Date(now.getTime() + GRACE_DAYS * 24 * 60 * 60 * 1000);
  }

  const cancellationRequest = await prisma.cancellationRequest.create({
    data: {
      collegeId,
      requestedBy,
      reason: reason || null,
      scheduledAt,
    },
  });

  // Update college status to CANCELLED
  await prisma.college.update({
    where: { id: collegeId },
    data: { subscriptionStatus: "CANCELLED" },
  });

  // Fire-and-forget confirmation email
  const college2 = await prisma.college.findUnique({
    where: { id: collegeId },
    include: { users: { where: { id: requestedBy }, select: { email: true, name: true } } },
  });
  if (college2?.users?.[0]) {
    sendCancellationConfirmationEmail({
      to: college2.users[0].email,
      contactName: college2.users[0].name,
      scheduledAt,
    }).catch((err) =>
      console.error("[EMAIL] Failed to send cancellation confirmation:", err)
    );
  }

  return { cancellationRequest, scheduledAt };
}

// ── Scenario D: Restore account (SUPER_ADMIN only) ──────────────────────────
export async function restoreAccount(collegeId) {
  const college = await prisma.college.findUnique({
    where: { id: collegeId },
    select: { id: true, deletedAt: true, subscriptionStatus: true },
  });

  if (!college) throw new Error("College not found");

  await prisma.$transaction(async (tx) => {
    // Delete cancellation request if any
    await tx.cancellationRequest.deleteMany({ where: { collegeId } });

    // Restore college: clear deletedAt, set TRIAL_EXPIRED (admin must re-subscribe)
    await tx.college.update({
      where: { id: collegeId },
      data: {
        subscriptionStatus: "TRIAL_EXPIRED",
        deletedAt: null,
        deletionReason: null,
        scheduledDeletionAt: null,
      },
    });
  });

  return { restored: true };
}

// ── Scenario C: Process a single cancellation request (called by cron) ───────
export async function processCancellation(cancellationRequestId) {
  const request = await prisma.cancellationRequest.findUnique({
    where: { id: cancellationRequestId },
    include: { college: true },
  });

  if (!request) throw new Error("Cancellation request not found");
  if (request.processedAt) throw new Error("Already processed");

  await prisma.$transaction(async (tx) => {
    // Soft delete the college
    await tx.college.update({
      where: { id: request.collegeId },
      data: {
        deletedAt: new Date(),
        deletionReason: request.reason || "EXPLICIT_CANCEL",
        subscriptionStatus: "CANCELLED",
      },
    });

    // Mark request as processed
    await tx.cancellationRequest.update({
      where: { id: cancellationRequestId },
      data: { processedAt: new Date() },
    });
  });

  return { processed: true, collegeId: request.collegeId };
}
