import { InfoPage, A } from "@/components/legal/info-page";
import { SITE } from "@/lib/site-config";

export const metadata = {
  title: "Support · Testify",
  description: "Get help with Testify — contact options and answers to common questions.",
};

const faqs = [
  {
    group: "Accounts & sign-in",
    items: [
      {
        q: "I forgot my password.",
        a: <>Use <A href="/forgot-password">Forgot password</A> on the sign-in page. The reset link is valid for 1 hour — check your spam folder if it doesn&rsquo;t arrive.</>,
      },
      {
        q: "How do I create an account?",
        a: <>Students and teachers are added by their College admin, who will email you a temporary password. If your institution isn&rsquo;t on {SITE.productName} yet, your admin can register it on <A href="/get-started">Get Started</A>.</>,
      },
      {
        q: "My account setup link has expired.",
        a: "Setup links last 24 hours. Open the expired link anyway — the setup page lets you request a fresh one by email. If that doesn't work, contact support.",
      },
    ],
  },
  {
    group: "Taking exams",
    items: [
      {
        q: "The lobby says multiple displays were detected.",
        a: "Disconnect any external monitor (or turn off screen mirroring/extended desktop), then refresh the lobby. Exams require a single display.",
      },
      {
        q: "The camera check won't turn green.",
        a: "Allow camera access when the browser asks (or via the camera icon in the address bar), close other apps using the webcam (Zoom, Teams), face the screen in good light, and make sure nobody else is in view.",
      },
      {
        q: "Is my camera video recorded?",
        a: "No. Face detection runs inside your browser and the video never leaves your device. Only warnings such as “face not visible” are sent, so your teacher can review them.",
      },
      {
        q: "My exam ended before I finished.",
        a: "Exams end automatically when the timer runs out, after 4 browser violations (switching tabs, leaving fullscreen, adding a display), or after 4 camera warnings (face not visible, another person, looking away, camera off). Everything saved up to that point is submitted. Contact your teacher if you believe it was a mistake — they can review the proctoring log.",
      },
      {
        q: "My internet dropped during an exam.",
        a: "Reopen the exam from My Assessments. Your attempt resumes with your saved answers, but the timer keeps running while you're disconnected.",
      },
      {
        q: "I can't see an exam my classmates can see.",
        a: "Exams are assigned to specific branches or batches. Ask your College admin to confirm you're in the right batch.",
      },
    ],
  },
  {
    group: "Teaching & grading",
    items: [
      {
        q: "Why can't I edit a question?",
        a: "Questions used in a live or completed exam are locked to protect students' answers. Saving an edit creates a new copy you can use in future exams.",
      },
      {
        q: "Where do I grade written answers?",
        a: <>Open Grading from your dashboard. Submissions needing review are listed first. See the <A href="/docs#teachers">teacher guide</A>.</>,
      },
    ],
  },
  {
    group: "Billing",
    items: [
      {
        q: "Our account is read-only.",
        a: "Your trial or subscription period has ended. An admin can renew from Billing & Plan — access is restored as soon as payment is confirmed.",
      },
      {
        q: "We've hit a plan limit.",
        a: "Each plan caps the number of teachers, students and exams. Upgrade from Billing & Plan, or remove unused accounts.",
      },
      {
        q: "Can we get an invoice or change plans?",
        a: `Email ${SITE.supportEmail} from your admin address with your College name and we'll help.`,
      },
    ],
  },
];

export default function SupportPage() {
  return (
    <InfoPage
      eyebrow="Help"
      title="How can we help?"
      intro="Find quick answers below, or get in touch with our team."
    >
      {/* Contact options */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-testify-border bg-testify-bg2 p-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-testify-muted2">Students &amp; teachers</p>
          <p className="mt-3 font-semibold text-testify-text">Contact your College admin</p>
          <p className="mt-2 text-sm leading-6 text-testify-muted">
            For account access, batch changes, exam schedules and grades, your institution can help fastest.
          </p>
        </div>
        <div className="rounded-2xl border border-testify-accent/40 bg-testify-bg2 p-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-testify-accent">Admins &amp; everyone else</p>
          <p className="mt-3 font-semibold text-testify-text">Email support</p>
          <a href={`mailto:${SITE.supportEmail}`} className="mt-2 inline-block text-sm text-testify-accent hover:text-testify-accent2 break-all">
            {SITE.supportEmail}
          </a>
          <p className="mt-2 text-sm leading-6 text-testify-muted">{SITE.supportHours}. Include your College name and a screenshot if you can.</p>
        </div>
        <div className="rounded-2xl border border-testify-border bg-testify-bg2 p-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-testify-muted2">Self-serve</p>
          <p className="mt-3 font-semibold text-testify-text">Read the docs</p>
          <p className="mt-2 text-sm leading-6 text-testify-muted">
            Step-by-step guides for admins, teachers and students in the <A href="/docs">documentation</A>.
          </p>
        </div>
      </div>

      {/* FAQ */}
      <div className="mt-16 space-y-12">
        <h2 className="font-serif text-3xl tracking-tight">Frequently asked questions</h2>
        {faqs.map((group) => (
          <section key={group.group}>
            <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-testify-muted2 mb-3">{group.group}</h3>
            <div className="divide-y divide-testify-border rounded-2xl border border-testify-border">
              {group.items.map((item) => (
                <details key={item.q} className="group px-5 open:bg-testify-bg2/60">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 font-medium text-testify-text [&::-webkit-details-marker]:hidden">
                    {item.q}
                    <span className="shrink-0 text-testify-muted transition-transform group-open:rotate-45 text-xl leading-none">+</span>
                  </summary>
                  <div className="pb-5 text-[15px] leading-7 text-testify-muted">{item.a}</div>
                </details>
              ))}
            </div>
          </section>
        ))}
      </div>

      <p className="mt-16 text-sm text-testify-muted">
        Found a security issue? Please report it privately — see <A href="/security#disclosure">responsible disclosure</A>.
      </p>
    </InfoPage>
  );
}
