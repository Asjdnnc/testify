import prisma from "../prisma.js";
import { autoGradeAttempt } from "./grading.service.js";
import { generateSetupToken } from "./onboarding.service.js";
import {
  sendTrialExpiredEmail,
  sendSubscriptionExpiredEmail,
  sendSetupReminderEmail,
} from "../email.js";

// ---------------------------------------------------------------------------
// Cron Service — 9 background jobs (Section 13 of spec)
// Each function returns { processed: number } for the cron route to report.
// All functions are safe to call multiple times (idempotent).
// ---------------------------------------------------------------------------

/**
 * Job 1: expireTrials
 * TRIAL colleges where trialEndsAt < now → TRIAL_EXPIRED + email
 */
export async function expireTrials() {
  const colleges = await prisma.college.findMany({
    where: {
      subscriptionStatus: "TRIAL",
      trialEndsAt: { lt: new Date() },
      deletedAt: null,
    },
    include: {
      users: {
        where: { role: "ADMIN" },
        select: { email: true, name: true },
        take: 1,
      },
    },
  });

  let processed = 0;
  for (const college of colleges) {
    await prisma.college.update({
      where: { id: college.id },
      data: { subscriptionStatus: "TRIAL_EXPIRED" },
    });

    const admin = college.users[0];
    if (admin) {
      sendTrialExpiredEmail({
        to: admin.email,
        contactName: admin.name,
        collegeName: college.name,
      }).catch((err) => console.error(`[CRON expireTrials] email error for ${college.id}:`, err));
    }
    processed++;
  }

  return { processed };
}

/**
 * Job 2: forceSubmitAttempts
 * IN_PROGRESS attempts where expiresAt < now → TIMED_OUT + auto-grade
 */
export async function forceSubmitAttempts() {
  const attempts = await prisma.attempt.findMany({
    where: {
      status: "IN_PROGRESS",
      expiresAt: { lt: new Date() },
    },
  });

  let processed = 0;
  for (const attempt of attempts) {
    // Conditional update: skip if the student submitted in the meantime
    const { count } = await prisma.attempt.updateMany({
      where: { id: attempt.id, status: "IN_PROGRESS" },
      data: { status: "TIMED_OUT", submittedAt: new Date() },
    });
    if (count === 0) continue;

    try {
      await autoGradeAttempt(attempt.id);
    } catch (err) {
      console.error(`[CRON forceSubmitAttempts] grading failed for ${attempt.id}:`, err);
    }
    processed++;
  }

  return { processed };
}

/**
 * Job 3: expireSubscriptions
 * ACTIVE colleges where currentPeriodEnd < now → SUSPENDED + email
 */
export async function expireSubscriptions() {
  const colleges = await prisma.college.findMany({
    where: {
      subscriptionStatus: "ACTIVE",
      currentPeriodEnd: { lt: new Date() },
      deletedAt: null,
    },
    include: {
      users: {
        where: { role: "ADMIN" },
        select: { email: true, name: true },
        take: 1,
      },
    },
  });

  let processed = 0;
  for (const college of colleges) {
    await prisma.college.update({
      where: { id: college.id },
      data: { subscriptionStatus: "SUSPENDED" },
    });

    // Deactivate active subscription record
    await prisma.collegeSubscription.updateMany({
      where: { collegeId: college.id, isActive: true },
      data: { isActive: false },
    });

    const admin = college.users[0];
    if (admin) {
      sendSubscriptionExpiredEmail({
        to: admin.email,
        contactName: admin.name,
        collegeName: college.name,
      }).catch((err) =>
        console.error(`[CRON expireSubscriptions] email error for ${college.id}:`, err)
      );
    }
    processed++;
  }

  return { processed };
}

/**
 * Job 4: processCancellations
 * CancellationRequests where scheduledAt < now and not yet processed → soft delete
 */
export async function processCancellations() {
  const requests = await prisma.cancellationRequest.findMany({
    where: {
      scheduledAt: { lt: new Date() },
      processedAt: null,
    },
  });

  let processed = 0;
  for (const request of requests) {
    await prisma.$transaction(async (tx) => {
      await tx.college.update({
        where: { id: request.collegeId },
        data: {
          deletedAt: new Date(),
          deletionReason: request.reason || "EXPLICIT_CANCEL",
          subscriptionStatus: "CANCELLED",
        },
      });
      await tx.cancellationRequest.update({
        where: { id: request.id },
        data: { processedAt: new Date() },
      });
    });
    processed++;
  }

  return { processed };
}

/**
 * Job 5: scheduleDeletions
 * TRIAL_EXPIRED colleges > 30 days since expiry → set scheduledDeletionAt,
 * and soft-delete colleges whose scheduledDeletionAt has passed.
 */
export async function scheduleDeletions() {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const colleges = await prisma.college.findMany({
    where: {
      subscriptionStatus: "TRIAL_EXPIRED",
      trialEndsAt: { lt: thirtyDaysAgo },
      scheduledDeletionAt: null,
      deletedAt: null,
    },
  });

  let processed = 0;
  for (const college of colleges) {
    const scheduledDeletionAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now
    await prisma.college.update({
      where: { id: college.id },
      data: { scheduledDeletionAt },
    });
    processed++;
  }

  // Execute due deletions (still unpaid) → soft delete; hard delete follows after 90 days
  const due = await prisma.college.updateMany({
    where: {
      scheduledDeletionAt: { lt: new Date() },
      subscriptionStatus: "TRIAL_EXPIRED",
      deletedAt: null,
    },
    data: {
      deletedAt: new Date(),
      deletionReason: "TRIAL_EXPIRED_NO_PAYMENT",
    },
  });
  processed += due.count;

  return { processed };
}

/**
 * Job 6: hardDeleteColleges
 * Colleges where deletedAt < (now - 90 days) → permanent hard delete
 */
export async function hardDeleteColleges() {
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

  const colleges = await prisma.college.findMany({
    where: {
      deletedAt: { lt: ninetyDaysAgo },
    },
    select: { id: true },
  });

  let processed = 0;
  for (const college of colleges) {
    await prisma.college.delete({ where: { id: college.id } });
    processed++;
  }

  return { processed };
}

/**
 * Job 7: remindUnsetupAdmins
 * isProvisioned=true, setupCompletedAt=null, 3 days since setupTokenSentAt → reminder email.
 * The original token has been cleared by expireSetupTokens (24h), so a fresh
 * one is issued. Updating setupTokenSentAt also prevents re-sending every run.
 */
export async function remindUnsetupAdmins() {
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

  const registrations = await prisma.collegeRegistration.findMany({
    where: {
      isProvisioned: true,
      setupCompletedAt: null,
      setupTokenSentAt: { lt: threeDaysAgo },
      // Only remind once (check if college still exists / not deleted)
      college: { deletedAt: null },
    },
    include: {
      college: { select: { name: true } },
    },
  });

  let processed = 0;
  for (const reg of registrations) {
    if (!reg.college || !reg.adminUserId) continue;

    const setupToken = generateSetupToken({
      registrationId: reg.id,
      userId: reg.adminUserId,
      email: reg.contactEmail,
      purpose: "account_setup",
    });

    await prisma.collegeRegistration.update({
      where: { id: reg.id },
      data: { setupToken, setupTokenSentAt: new Date() },
    });

    sendSetupReminderEmail({
      to: reg.contactEmail,
      contactName: reg.contactName,
      collegeName: reg.college.name,
      setupToken,
    }).catch((err) =>
      console.error(`[CRON remindUnsetupAdmins] email error for ${reg.id}:`, err)
    );

    processed++;
  }

  return { processed };
}

/**
 * Job 8: cleanupNeverSetup
 * isProvisioned=true, setupCompletedAt=null, 7+ days → soft delete the college
 */
export async function cleanupNeverSetup() {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const registrations = await prisma.collegeRegistration.findMany({
    where: {
      isProvisioned: true,
      setupCompletedAt: null,
      provisionedAt: { lt: sevenDaysAgo },
      college: { deletedAt: null },
    },
  });

  let processed = 0;
  for (const reg of registrations) {
    if (!reg.collegeId) continue;
    await prisma.college.update({
      where: { id: reg.collegeId },
      data: {
        deletedAt: new Date(),
        deletionReason: "NEVER_SETUP",
      },
    });
    processed++;
  }

  return { processed };
}

/**
 * Job 9: expireSetupTokens
 * setupToken older than 24h → clear token (forces admin to use resend flow)
 */
export async function expireSetupTokens() {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const result = await prisma.collegeRegistration.updateMany({
    where: {
      setupToken: { not: null },
      setupTokenSentAt: { lt: oneDayAgo },
      setupCompletedAt: null,
    },
    data: { setupToken: null },
  });

  return { processed: result.count };
}

// ---------------------------------------------------------------------------
// Job registry — maps URL-safe job names to their functions
// ---------------------------------------------------------------------------
export const CRON_JOBS = {
  "expire-trials": expireTrials,
  "force-submit-attempts": forceSubmitAttempts,
  "expire-subscriptions": expireSubscriptions,
  "process-cancellations": processCancellations,
  "schedule-deletions": scheduleDeletions,
  "hard-delete-colleges": hardDeleteColleges,
  "remind-unsetup-admins": remindUnsetupAdmins,
  "cleanup-never-setup": cleanupNeverSetup,
  "expire-setup-tokens": expireSetupTokens,
};
