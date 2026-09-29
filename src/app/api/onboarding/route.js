import { submitRegistrationForm } from "@/lib/services/onboarding.service.js";

const APP_URL = process.env.APP_URL || "http://localhost:3000";
const IS_DEV = process.env.NODE_ENV !== "production";

/**
 * POST /api/onboarding
 * Accepts the "Get Started" form and creates a CollegeRegistration.
 * Provisioning runs immediately — admin gets a welcome email with setup link.
 * In development, the setup URL is also returned in the response for easy testing.
 */
export async function POST(req) {
  try {
    const body = await req.json();

    const result = await submitRegistrationForm({
      collegeName: body.collegeName,
      contactName: body.adminName,
      contactEmail: body.adminEmail,
      contactPhone: body.adminContact || null,
      designation: body.adminDesignation || null,
      address: body.address || null,
    });

    const setupUrl = `${APP_URL}/auth/setup-account?token=${result.setupToken}`;

    return Response.json({
      success: true,
      message: result.emailFailed
        ? "Registration successful, but our email service is currently down. We couldn't send the setup link to your email."
        : "Registration successful! Check your email for the setup link.",
      email: result.email,
      emailFailed: result.emailFailed,
      // Only expose the direct link in non-production to avoid token leaks via API
      ...(IS_DEV && { setupUrl }),
    });
  } catch (error) {
    console.error("[ONBOARDING ERROR]", error);
    return Response.json(
      { success: false, message: error.message },
      { status: 400 }
    );
  }
}
