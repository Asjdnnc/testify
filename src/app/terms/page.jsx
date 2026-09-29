import { InfoPage, P, UL, Strong, A } from "@/components/legal/info-page";
import { SITE } from "@/lib/site-config";

export const metadata = {
  title: "Terms of Service · Testify",
  description: "The terms that govern institutions', teachers' and students' use of the Testify examination platform.",
};

// NOTE: Template terms that match how the product works today (trial length,
// billing, cancellation grace periods). Have them reviewed before launch.

const sections = [
  {
    id: "agreement",
    title: "Agreement",
    content: (
      <>
        <P>
          These Terms govern access to {SITE.productName}, operated by {SITE.legalEntity}. By registering an institution or using an
          account, you agree to them. If you register on behalf of a College, you confirm you are authorised to bind that College.
        </P>
        <P>
          The College is our customer. Teachers and students use {SITE.productName} through accounts their College creates, and
          their use is also subject to their College&rsquo;s own policies.
        </P>
      </>
    ),
  },
  {
    id: "accounts",
    title: "Accounts",
    content: (
      <UL
        items={[
          "Each College gets an admin account on registration. Admins create teacher and student accounts; public self-registration is not available.",
          "Keep your credentials confidential. You are responsible for activity under your account and must tell us promptly about any unauthorised use.",
          "Temporary passwords issued by an admin must be changed on first sign-in.",
          "Admins are responsible for the accuracy of the people and information they add, and for removing access when someone leaves.",
        ]}
      />
    ),
  },
  {
    id: "trial-plans",
    title: "Free trial and plans",
    content: (
      <>
        <P>
          New Colleges start on a <Strong>3-day free trial</Strong> with limited resources. Paid plans (Starter, Professional,
          Enterprise) raise or remove limits on teachers, students and exams, as shown on our <A href="/#pricing">pricing</A> and in your
          billing dashboard. We may change plan features or limits with notice; changes don&rsquo;t reduce what you have already paid for
          during the current billing period.
        </P>
        <P>
          When a plan limit is reached, you won&rsquo;t be able to add more of that resource until you upgrade or free up capacity.
        </P>
      </>
    ),
  },
  {
    id: "billing",
    title: "Payment and renewal",
    content: (
      <UL
        items={[
          "Fees are charged in advance for each billing period (currently 30 days) through our payment processor, Razorpay. Prices are in INR and exclude taxes unless stated.",
          "Your subscription activates when payment is confirmed. It is not renewed automatically — renew before the period ends to avoid interruption.",
          "If a trial or paid period ends without payment, the account becomes read-only: you can still sign in, view data and pay, but not create or change content, and students cannot start new exams.",
          "Except where required by law or stated otherwise in writing, fees already paid are non-refundable.",
        ]}
      />
    ),
  },
  {
    id: "cancellation",
    title: "Cancellation and data deletion",
    content: (
      <>
        <UL
          items={[
            "A College admin can cancel at any time from the billing page.",
            "On cancellation the account becomes read-only. Data is retained for a 7-day grace period (for paid plans, 7 days after the paid period ends) so you can export what you need, after which the account is deactivated.",
            "Deactivated accounts and all their data — users, exams, answers and results — are permanently deleted 90 days later.",
            `To reverse a cancellation during the grace period, contact ${SITE.supportEmail}.`,
          ]}
        />
        <P>Export any records you must keep (for example, for accreditation) before your data is deleted.</P>
      </>
    ),
  },
  {
    id: "acceptable-use",
    title: "Acceptable use",
    content: (
      <>
        <P>You must not:</P>
        <UL
          items={[
            "attempt to access another College's data, or another user's account or exam attempt;",
            "circumvent proctoring, time limits, or other exam-integrity controls, or help others do so;",
            "probe, scan or test the platform's security without our written permission (see our Security page for responsible disclosure);",
            "upload unlawful content, malware, or material you do not have the right to use;",
            "overload, scrape or reverse-engineer the service, or resell it without our agreement.",
          ]}
        />
      </>
    ),
  },
  {
    id: "exam-integrity",
    title: "Exam integrity and proctoring",
    content: (
      <>
        <P>
          During a live exam, {SITE.productName} requires fullscreen mode and a working webcam. It monitors browser events (tab
          switches, leaving fullscreen, connecting additional displays) and uses on-device face detection to check that exactly one
          person is present and facing the screen. Four browser violations, or four camera warnings, automatically end and submit
          the attempt. Students without a working camera cannot take proctored exams.
          Answers are auto-saved, and attempts are submitted automatically when time runs out.
        </P>
        <P>
          These signals are indicators, not proof of misconduct. Decisions about academic integrity, grades and appeals are made
          by the College, not by {SITE.productName}.
        </P>
      </>
    ),
  },
  {
    id: "content",
    title: "Your content",
    content: (
      <P>
        Colleges and their teachers own the questions, exams and other material they upload, and students&rsquo; answers belong to
        them and their College. You grant us a limited licence to host and process that content solely to provide the service.
        We handle personal data as described in our <A href="/privacy">Privacy Policy</A>.
      </P>
    ),
  },
  {
    id: "availability",
    title: "Availability and warranties",
    content: (
      <P>
        We work to keep {SITE.productName} available and reliable, but the service is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo;. We don&rsquo;t
        guarantee uninterrupted operation, and we recommend Colleges have a contingency plan for high-stakes exams. To the
        extent permitted by law, we disclaim implied warranties of merchantability and fitness for a particular purpose.
      </P>
    ),
  },
  {
    id: "liability",
    title: "Limitation of liability",
    content: (
      <P>
        To the extent permitted by law, {SITE.legalEntity} is not liable for indirect, incidental or consequential losses, or for
        loss of data, profits or goodwill. Our total liability for any claim relating to the service is limited to the fees the
        College paid us in the 12 months before the claim arose.
      </P>
    ),
  },
  {
    id: "suspension",
    title: "Suspension and termination",
    content: (
      <P>
        We may suspend or terminate access for non-payment, breach of these Terms, or to protect the platform or other users. Where
        reasonable we will give notice first. Sections that by their nature should survive termination (such as content ownership,
        liability limits and governing law) continue to apply.
      </P>
    ),
  },
  {
    id: "law-contact",
    title: "Governing law and contact",
    content: (
      <>
        <P>
          These Terms are governed by the laws of {SITE.jurisdiction}, and disputes are subject to the exclusive jurisdiction of{" "}
          {SITE.governingCourts}. We may update these Terms; material changes will be notified to College admins in advance.
        </P>
        <P>
          Questions: <A href={`mailto:${SITE.supportEmail}`}>{SITE.supportEmail}</A>.
        </P>
      </>
    ),
  },
];

export default function TermsPage() {
  return (
    <InfoPage
      eyebrow="Legal"
      title="Terms of Service"
      intro={`The rules for using ${SITE.productName} — for institutions, teachers and students.`}
      lastUpdated={SITE.legalLastUpdated}
      sections={sections}
    />
  );
}
