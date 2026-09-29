import { InfoPage, P, UL, Strong, A, Card } from "@/components/legal/info-page";
import { SITE } from "@/lib/site-config";

export const metadata = {
  title: "Security · Testify",
  description: "How Testify protects institutions' data and the integrity of online exams.",
};

const pillars = [
  {
    title: "Tenant isolation",
    body: "Every request is scoped to the signed-in user's College. IDs supplied by a browser are checked against that College before anything is read or changed.",
  },
  {
    title: "Verified sessions",
    body: "Sessions use signed tokens that are verified on every API request and page load, and expire after 7 days. Forged or tampered tokens are rejected.",
  },
  {
    title: "Exam integrity",
    body: "Answer keys and model answers never reach a student's browser, question papers are revealed only once an attempt starts, and time limits are enforced on the server.",
  },
];

const sections = [
  {
    id: "accounts",
    title: "Accounts and access control",
    content: (
      <UL
        items={[
          "Passwords are hashed with bcrypt — we never store or email them in plain text after issue.",
          "Role-based access: super admin, College admin, teacher and student each see only what their role requires.",
          "Temporary passwords issued by admins must be changed on first sign-in.",
          "Password-reset links are single-use and expire after 1 hour; account-setup links expire after 24 hours.",
          "Sign-in errors don't reveal whether an email address has an account.",
          "Accounts belonging to a deactivated College can no longer sign in.",
        ]}
      />
    ),
  },
  {
    id: "data",
    title: "Data protection",
    content: (
      <UL
        items={[
          "All traffic is served over HTTPS.",
          "Data is stored in a managed PostgreSQL database with encryption at rest provided by our hosting provider.",
          "Card and bank details are handled entirely by Razorpay; payment confirmations are verified with cryptographic signatures before a subscription is activated.",
          "Secrets such as API keys are kept in server-side configuration and are never sent to the browser.",
          <>Data retention and deletion follow the schedule in our <A href="/privacy#retention">Privacy Policy</A>.</>,
        ]}
      />
    ),
  },
  {
    id: "exams",
    title: "Exam integrity controls",
    content: (
      <>
        <UL
          items={[
            "Students see an exam only if it is targeted at their branch or batch within their own College.",
            "Answers are saved continuously; saves arriving after the time limit (beyond a short network grace period) are rejected.",
            "Proctoring records tab switches, fullscreen exits and extra displays, and on-device camera checks flag a missing face, a second person or looking away. Four browser violations or four camera warnings end the attempt.",
            "Questions used in a live or completed exam are locked — edits create a new version instead of changing what students answered.",
            "Camera video is processed entirely in the browser and is never uploaded or stored.",
          ]}
        />
        <P>
          Browser-based proctoring raises the cost of cheating but cannot make it impossible. Colleges should combine it with
          their own invigilation for high-stakes assessments.
        </P>
      </>
    ),
  },
  {
    id: "operations",
    title: "Operational practices",
    content: (
      <UL
        items={[
          "Access to production systems is restricted to authorised staff.",
          "Automated background jobs are authenticated with a dedicated secret.",
          "We will notify affected Colleges without undue delay if a breach affects their data, as required by law.",
        ]}
      />
    ),
  },
  {
    id: "disclosure",
    title: "Responsible disclosure",
    content: (
      <>
        <P>
          If you believe you&rsquo;ve found a vulnerability, email <A href={`mailto:${SITE.securityEmail}`}>{SITE.securityEmail}</A> with
          steps to reproduce. Please give us reasonable time to fix it before disclosing publicly.
        </P>
        <P>
          While investigating, <Strong>use only accounts you own</Strong>, don&rsquo;t access or modify other people&rsquo;s data, and don&rsquo;t
          disrupt the service (no denial-of-service or spam). We won&rsquo;t pursue action against good-faith research that follows
          these guidelines.
        </P>
      </>
    ),
  },
];

export default function SecurityPage() {
  return (
    <InfoPage
      eyebrow="Trust"
      title="Security at Testify"
      intro="Institutions trust us with exam papers, answers and student records. Here's how we protect them."
      sections={sections}
    >
      <div className="grid gap-4 sm:grid-cols-3 mb-14">
        {pillars.map((p) => (
          <Card key={p.title} title={p.title}>{p.body}</Card>
        ))}
      </div>
    </InfoPage>
  );
}
