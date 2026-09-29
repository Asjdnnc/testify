import prisma from "@/lib/prisma.js";
import { sendPasswordResetEmail } from "@/lib/email.js";
import crypto from "crypto";

export async function POST(req) {
  try {
    const { email } = await req.json();

    if (!email) {
      return Response.json({ success: false, message: "Email is required" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      // Return a successful response even if the user is not found to prevent email enumeration attacks
      return Response.json({ success: true, message: "If your email is registered, a reset link will be sent shortly." });
    }

    // Generate a secure, 32-byte hex token
    const token = crypto.randomBytes(32).toString('hex');
    
    // Set expiration to 1 hour from now
    const expires = new Date();
    expires.setHours(expires.getHours() + 1);

    // Save token to DB
    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetPasswordToken: token,
        resetPasswordExpires: expires
      }
    });

    // Send the email (failure must not reveal whether the account exists)
    await sendPasswordResetEmail({
      to: user.email,
      contactName: user.name,
      resetToken: token
    }).catch((err) => console.error("[FORGOT_PASSWORD_EMAIL_ERROR]", err?.message || err));

    // Dev-only: real email might get suppressed by Resend's free tier.
    // Never log reset links in production — they grant account takeover.
    if (process.env.NODE_ENV !== "production") {
      console.log(`\n========================================`);
      console.log(`🔑 PASSWORD RESET INITIATED`);
      console.log(`📧 User: ${user.email}`);
      console.log(`🔗 Reset Link: ${process.env.APP_URL}/reset-password?token=${token}`);
      console.log(`========================================\n`);
    }

    return Response.json({ success: true, message: "If your email is registered, a reset link will be sent shortly." });

  } catch (error) {
    console.error("[FORGOT_PASSWORD_ERROR]", error);
    return Response.json({ success: false, message: "Server error handling your request" }, { status: 500 });
  }
}
