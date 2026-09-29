import { InfoPage, P, UL, Strong, A, Table } from "@/components/legal/info-page";
import { SITE } from "@/lib/site-config";

export const metadata = {
  title: "Privacy Policy · Testify",
  description: "How Testify collects, uses, stores and protects personal data on its online examination platform.",
};

// NOTE: This policy describes how the Testify codebase actually handles data.
// It is a starting point, not legal advice — have it reviewed before launch.

const sections = [
  {
    id: "who-we-are",
    title: "Who we are and our role",
    content: (
      <>
        <P>
          {SITE.productName} is an online examination platform operated by {SITE.legalEntity} ({SITE.registeredAddress}).
          Educational institutions (&ldquo;Colleges&rdquo;) subscribe to {SITE.productName} to create exams and assess their students.
        </P>
        <P>
          For data about a College&rsquo;s own teachers and students, the <Strong>College is the Data Fiduciary</Strong> (data controller)
          and {SITE.productName} acts as a <Strong>Data Processor</Strong> on the College&rsquo;s instructions. For data about the people who
          register a College, pay for a subscription or contact us, {SITE.productName} is the Data Fiduciary.
        </P>
      </>
    ),
  },
  {
    id: "what-we-collect",
    title: "Information we collect",
    content: (
      <>
        <Table
          head={["Category", "Examples", "Source"]}
          rows={[
            ["Institution registration", "College name and address, contact person's name, email, phone and designation", "The person who fills in the Get Started form"],
            ["Account data", "Name, email, role (admin, teacher, student), branch and batch, hashed password", "The College admin, or you when you set up your account"],
            ["Academic content", "Subjects, question banks, model answers, exams and schedules", "Teachers and admins"],
            ["Exam activity", "Answers and their save timestamps, attempt start/submit times, scores, grades and teacher feedback", "Students and teachers while using the platform"],
            ["Proctoring signals", "Tab switches, fullscreen exits, window focus loss, multiple-display detection, and camera face checks (face not visible, more than one person, looking away, camera off) with timestamps and strike counts", "Automatically, only during a live exam"],
            ["Billing", "Plan, amount, payment status and payment reference IDs", "Our payment processor (Razorpay)"],
            ["Technical", "Browser type, session token, request logs", "Automatically, when you use the service"],
          ]}
        />
        <P>
          <Strong>Camera proctoring:</Strong> during an exam your webcam feed is analysed by face-detection software running inside your
          browser. The video never leaves your device — only the resulting event (for example &ldquo;face not visible&rdquo;) is sent to us.
          We do <Strong>not</Strong> record or upload video, audio, photos, screenshots or keystrokes, and we don&rsquo;t create
          biometric templates or identify who you are. We never receive or store full card or bank details — those are handled
          entirely by our payment processor.
        </P>
      </>
    ),
  },
  {
    id: "how-we-use",
    title: "How we use information",
    content: (
      <UL
        items={[
          "To provide the service: create accounts, deliver exams, save answers, grade attempts and show results and GPA.",
          "To protect exam integrity: detect and record proctoring violations (browser and camera), and end an attempt after repeated violations.",
          "To run the subscription: manage trials, process payments, enforce plan limits and send account notices (trial expiry, renewals, cancellation).",
          "To secure the platform: authenticate users, prevent abuse and investigate incidents.",
          "To support you when you contact us.",
          "Optional AI features: documents a teacher uploads for question import, and — when a teacher asks for a grading recommendation — the question, model answer and the student's written answer text (without the student's name or email) are sent to Google's Gemini API. AI recommendations are never saved as grades; a teacher reviews and sets every mark.",
        ]}
      />
    ),
  },
  {
    id: "sharing",
    title: "Who we share it with",
    content: (
      <>
        <P>We do not sell personal data. We share it only with service providers who help us run {SITE.productName}, under contracts that restrict their use of it:</P>
        <Table
          head={["Provider", "Purpose"]}
          rows={[
            ["Neon (PostgreSQL hosting)", "Database hosting"],
            ["Razorpay", "Payment processing"],
            ["Resend", "Transactional email (account setup, password reset, notices)"],
            ["Google (Gemini API)", "AI question import and grading recommendations — only when a teacher uses these features"],
            ["Our hosting provider", "Running the application"],
          ]}
        />
        <P>
          Within a College, data is visible according to role: admins manage their institution&rsquo;s users, teachers see exams they
          created and their students&rsquo; attempts, and students see only their own work. Each College&rsquo;s data is isolated from every
          other College. We may disclose data where required by law.
        </P>
      </>
    ),
  },
  {
    id: "retention",
    title: "How long we keep it",
    content: (
      <UL
        items={[
          <>While a College&rsquo;s subscription is active, data is kept for as long as the College needs it.</>,
          <>After a College <Strong>cancels</Strong>, data is retained read-only during a grace period (7 days, or until 7 days after the paid period ends), then deactivated.</>,
          <>Trials that expire without payment are scheduled for deletion roughly 37 days after expiry.</>,
          <>Deactivated Colleges are <Strong>permanently deleted after 90 days</Strong>, including all users, exams, answers and results.</>,
          <>Password-reset links expire after 1 hour; account-setup links after 24 hours.</>,
          <>Payment records may be kept longer where tax or accounting law requires.</>,
        ]}
      />
    ),
  },
  {
    id: "security",
    title: "How we protect it",
    content: (
      <P>
        Passwords are hashed with bcrypt, every request is authenticated with a signed token, and each College&rsquo;s data is
        isolated at the application layer. Answer keys are never sent to students&rsquo; browsers. See our <A href="/security">Security page</A> for
        details. No system is perfectly secure, but we work to protect your information and will notify affected parties of
        a breach as required by law.
      </P>
    ),
  },
  {
    id: "your-rights",
    title: "Your rights",
    content: (
      <>
        <P>
          Subject to applicable law, including India&rsquo;s Digital Personal Data Protection Act, 2023, you may request access to,
          correction of, or erasure of your personal data, and nominate someone to exercise these rights on your behalf.
        </P>
        <P>
          <Strong>Students and teachers:</Strong> your College controls your account, so please contact your College admin first —
          they can correct or remove your data. If you cannot resolve it with them, contact us.
        </P>
        <P>
          <Strong>Everyone else:</Strong> email <A href={`mailto:${SITE.privacyEmail}`}>{SITE.privacyEmail}</A>. We respond within 30 days.
        </P>
      </>
    ),
  },
  {
    id: "children",
    title: "Students under 18",
    content: (
      <P>
        {SITE.productName} is intended for higher-education institutions. Where a College enrols students under 18, the College is
        responsible for obtaining verifiable parental or guardian consent before creating their accounts. We do not use
        students&rsquo; data for advertising, tracking or behavioural profiling.
      </P>
    ),
  },
  {
    id: "cookies",
    title: "Cookies and local storage",
    content: (
      <P>
        We use one essential cookie (<code className="font-mono text-xs text-testify-text">testify-token</code>) and browser local storage
        to keep you signed in, and local storage to keep an in-progress exam&rsquo;s answers safe if your connection drops. We also
        remember your light/dark theme preference. We do not use advertising or third-party analytics cookies.
      </P>
    ),
  },
  {
    id: "changes-contact",
    title: "Changes and contact",
    content: (
      <>
        <P>We will post changes here and update the date above. Significant changes will be notified to College admins by email.</P>
        <P>
          Questions or complaints: <A href={`mailto:${SITE.privacyEmail}`}>{SITE.privacyEmail}</A> — {SITE.grievanceOfficer}.
        </P>
      </>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <InfoPage
      eyebrow="Legal"
      title="Privacy Policy"
      intro={`How ${SITE.productName} collects, uses and protects information about institutions, teachers and students.`}
      lastUpdated={SITE.legalLastUpdated}
      sections={sections}
    />
  );
}
