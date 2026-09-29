import prisma from "../prisma.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { sendWelcomeSetupEmail, sendSetupLinkEmail } from "../email.js";

const SETUP_TOKEN_SECRET = process.env.SETUP_JWT_SECRET || process.env.JWT_SECRET;
const SETUP_TOKEN_EXPIRY = "24h";
const TRIAL_DAYS = 3;

// ─── Helpers ──────────────────────────────────────────────────────────────

export function generateSetupToken(payload) {
  return jwt.sign(payload, SETUP_TOKEN_SECRET, { expiresIn: SETUP_TOKEN_EXPIRY });
}

function verifySetupToken(token) {
  return jwt.verify(token, SETUP_TOKEN_SECRET);
}

function generateAuthToken(user) {
  return jwt.sign(
    {
      userId: user.id,
      email: user.email,
      role: user.role,
      collegeId: user.collegeId,
      branchId: user.branchId || null,
      batchId: user.batchId || null,
    },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
}

// ─── Step 1: Submit Registration Form ─────────────────────────────────────
/**
 * Creates a CollegeRegistration row ONLY. Does NOT touch College or User tables.
 * Called when the "Get Started" form is submitted.
 */
export async function submitRegistrationForm({
  collegeName,
  contactName,
  contactEmail,
  contactPhone,
  designation,
  address,
}) {
  if (!collegeName) throw new Error("College name is required");
  if (!contactName) throw new Error("Contact name is required");
  if (!contactEmail) throw new Error("Email address is required");

  // Check for duplicate in CollegeRegistration
  const existingReg = await prisma.collegeRegistration.findUnique({
    where: { contactEmail },
  });
  if (existingReg) {
    if (existingReg.setupCompletedAt) {
      throw new Error("An account with this email already exists. Please log in instead.");
    }
    if (existingReg.isProvisioned) {
      throw new Error("A setup link was already sent to this email. Check your inbox or use the 'Resend setup link' option.");
    }
    throw new Error("A registration with this email is already pending.");
  }

  // Check for duplicate in User table (catches orphaned users from failed prior attempts)
  const existingUser = await prisma.user.findUnique({
    where: { email: contactEmail },
  });
  if (existingUser) {
    throw new Error("An account with this email already exists. Please log in instead.");
  }

  // Check for duplicate college name (case-insensitive)
  const existingCollege = await prisma.college.findFirst({
    where: { name: { equals: collegeName, mode: "insensitive" } },
  });
  if (existingCollege) {
    throw new Error("A college with this name is already registered. Please contact support if this is a mistake.");
  }


  // Create registration record (staging area)
  const registration = await prisma.collegeRegistration.create({
    data: {
      collegeName,
      contactName,
      contactEmail,
      contactPhone: contactPhone || null,
      designation: designation || null,
      address: address || null,
      isProvisioned: false,
    },
  });

  // Provision immediately (synchronously) — see spec Section 4.2
  const provisionResult = await provisionCollege(registration.id);

  return { 
    success: true, 
    email: contactEmail, 
    setupToken: provisionResult.setupToken,
    emailFailed: provisionResult.emailFailed
  };
}


// ─── Step 2: Provision College (Transaction) ──────────────────────────────
/**
 * Atomic 4-step provisioning:
 * 1. Create College (TRIAL, 3-day window)
 * 2. Create Admin User (temporary password hash)
 * 3. Update CollegeRegistration (isProvisioned, collegeId, adminUserId)
 * 4. Generate setup token & send welcome email
 *
 * CRITICAL: All DB steps are wrapped in a single transaction.
 */
export async function provisionCollege(registrationId) {
  const registration = await prisma.collegeRegistration.findUnique({
    where: { id: registrationId },
  });

  if (!registration) throw new Error("Registration not found");
  if (registration.isProvisioned) throw new Error("Already provisioned");

  const trialEndsAt = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000);

  // Temporary placeholder password (never usable — admin must go through setup flow)
  const tempPasswordHash = await bcrypt.hash(`temp_${Date.now()}_${Math.random()}`, 10);

  let college, adminUser;

  await prisma.$transaction(async (tx) => {
    // Step 1: Create College
    college = await tx.college.create({
      data: {
        name: registration.collegeName,
        address: registration.address || null,
        subscriptionStatus: "TRIAL",
        planType: "TRIAL",
        trialEndsAt,
      },
    });

    // Step 2: Create Admin User
    adminUser = await tx.user.create({
      data: {
        name: registration.contactName,
        email: registration.contactEmail,
        passwordHash: tempPasswordHash,
        role: "ADMIN",
        collegeId: college.id,
      },
    });

    // Step 3: Update CollegeRegistration
    await tx.collegeRegistration.update({
      where: { id: registrationId },
      data: {
        isProvisioned: true,
        provisionedAt: new Date(),
        collegeId: college.id,
        adminUserId: adminUser.id,
        // Token will be set below after TX commits (JWT doesn't need a TX)
      },
    });
  });

  // Step 4: Generate setup token and update registration (outside TX — idempotent if TX rolls back, we retry)
  const setupToken = generateSetupToken({
    registrationId,
    userId: adminUser.id,
    email: registration.contactEmail,
    purpose: "account_setup",
  });

  await prisma.collegeRegistration.update({
    where: { id: registrationId },
    data: {
      setupToken,
      setupTokenSentAt: new Date(),
    },
  });

  console.log("\n=======================================================");
  console.log(`[DEBUG] Setup token generated for ${registration.contactEmail}:`);
  console.log(`Token: ${setupToken}`);
  console.log("=======================================================\n");

  let emailFailed = false;

  // Send welcome email — await it so we can log success/failure clearly
  try {
    const emailResult = await sendWelcomeSetupEmail({
      to: registration.contactEmail,
      contactName: registration.contactName,
      collegeName: registration.collegeName,
      trialEndsAt,
      setupToken,
    });
    
    if (emailResult?.error) {
      console.error("[EMAIL] Failed to send welcome email (API error):", emailResult.error);
      emailFailed = true;
    } else {
      console.log("[EMAIL] Welcome email sent successfully:", emailResult?.data?.id ?? emailResult);
    }
  } catch (err) {
    // Log the full error — provisioning already succeeded so don't rethrow
    console.error("[EMAIL] Failed to send welcome email (Exception):", JSON.stringify(err?.response?.data || err?.message || err));
    emailFailed = true;
  }

  return { college, adminUser, trialEndsAt, setupToken, emailFailed };
}

// ─── Step 3: Complete Account Setup ───────────────────────────────────────
/**
 * Called when admin clicks the setup link and sets their password.
 * Verifies the JWT, updates password, marks setup as complete.
 * Returns a full auth token so the admin is immediately logged in.
 */
export async function completeAccountSetup(token, password) {
  if (!token) throw new Error("Setup token is required");
  if (!password || password.length < 8)
    throw new Error("Password must be at least 8 characters");

  let decoded;
  try {
    decoded = verifySetupToken(token);
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      throw Object.assign(new Error("Setup link has expired. Please request a new one."), {
        code: "TOKEN_EXPIRED",
      });
    }
    throw new Error("Invalid setup link");
  }

  if (decoded.purpose !== "account_setup") throw new Error("Invalid token purpose");

  const registration = await prisma.collegeRegistration.findUnique({
    where: { id: decoded.registrationId },
  });

  if (!registration) throw new Error("Registration not found");
  if (registration.setupCompletedAt) throw new Error("Account is already set up");
  if (registration.setupToken !== token) throw new Error("This setup link has been superseded by a newer one");

  // Hash new password
  const passwordHash = await bcrypt.hash(password, 10);

  // Update user password + mark setup complete
  const [user] = await prisma.$transaction([
    prisma.user.update({
      where: { id: decoded.userId },
      data: { passwordHash },
      include: { college: { select: { name: true } } },
    }),
    prisma.collegeRegistration.update({
      where: { id: decoded.registrationId },
      data: {
        setupCompletedAt: new Date(),
        setupToken: null, // Invalidate the token
      },
    }),
  ]);

  const authToken = generateAuthToken(user);
  const { passwordHash: _, ...safeUser } = user;

  return { token: authToken, user: safeUser };
}

// ─── Resend Setup Link ─────────────────────────────────────────────────────
/**
 * Generates a fresh setup token and re-sends the welcome email.
 * Called when the admin's setup link has expired.
 */
export async function resendSetupLink(email) {
  if (!email) throw new Error("Email is required");

  const registration = await prisma.collegeRegistration.findUnique({
    where: { contactEmail: email },
  });

  if (!registration) throw new Error("No registration found for this email");
  if (!registration.isProvisioned) throw new Error("Account has not been provisioned yet");
  if (registration.setupCompletedAt) throw new Error("Account is already set up. Please log in.");

  const setupToken = generateSetupToken({
    registrationId: registration.id,
    userId: registration.adminUserId,
    email: registration.contactEmail,
    purpose: "account_setup",
  });

  await prisma.collegeRegistration.update({
    where: { id: registration.id },
    data: {
      setupToken,
      setupTokenSentAt: new Date(),
    },
  });

  console.log("\n=======================================================");
  console.log(`[DEBUG] Resend setup token for ${registration.contactEmail}:`);
  console.log(`Token: ${setupToken}`);
  console.log("=======================================================\n");

  // Fire-and-forget
  sendSetupLinkEmail({
    to: registration.contactEmail,
    contactName: registration.contactName,
    setupToken,
  }).catch((err) => console.error("[EMAIL] Failed to send resend email:", err));

  return { success: true };
}
