import { InfoPage, P, UL, Strong, A, Card, Table } from "@/components/legal/info-page";

export const metadata = {
  title: "Documentation · Testify",
  description: "Guides for college admins, teachers and students using Testify.",
};

function Steps({ items }) {
  return (
    <ol className="space-y-3">
      {items.map((item, i) => (
        <li key={i} className="flex gap-4 text-[15px] leading-7 text-testify-muted">
          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-testify-accent/15 font-mono text-xs font-semibold text-testify-accent">
            {i + 1}
          </span>
          <span className="min-w-0">{item}</span>
        </li>
      ))}
    </ol>
  );
}

function Path({ children }) {
  return <span className="font-medium text-testify-text">{children}</span>;
}

const sections = [
  {
    id: "getting-started",
    title: "Getting started",
    content: (
      <Steps
        items={[
          <>Register your institution on <A href="/get-started">Get Started</A>. You&rsquo;ll receive an email with a setup link (valid for 24 hours).</>,
          "Open the link and choose a password. You're now signed in as your College's admin, on a 3-day free trial.",
          "Create your academic structure: branches, batches and subjects.",
          "Add teachers and students — one at a time or by uploading a spreadsheet.",
          "Teachers build question banks and exams; students take them from their dashboard.",
        ]}
      />
    ),
  },
  {
    id: "admins",
    title: "For college admins",
    content: (
      <>
        <P><Strong>Academic structure.</Strong> Set it up in this order, because students belong to a batch inside a branch:</P>
        <UL
          items={[
            <><Path>Academic Branches</Path> — departments such as &ldquo;CSE&rdquo;. You can create batches for several graduation years at once.</>,
            <><Path>Class Batches</Path> — cohorts inside a branch, named by graduation year (e.g. 2028).</>,
            <><Path>Manage Subjects</Path> — name, optional code (e.g. CS201) and credits, used for GPA.</>,
          ]}
        />
        <P><Strong>People.</Strong> In <Path>Manage Teachers</Path> and <Path>Manage Students</Path>, add people individually or switch to <Path>Batch Upload</Path>. Each new person gets an email with a temporary password they must change on first sign-in.</P>
        <P><Strong>Spreadsheet formats</Strong> (.xlsx or .csv, first sheet, header row required):</P>
        <Table
          head={["Upload", "Required columns", "Notes"]}
          rows={[
            ["Teachers", "Name, Email", "—"],
            ["Students", "Name, Email, Branch, Batch", "Branch and Batch must match names that already exist"],
            ["Subjects", "Name, Code, Credits", "Code and Credits optional; credits default to 3"],
          ]}
        />
        <P>Rows that fail (duplicate email, unknown batch, plan limit reached) are reported individually — the rest still go through.</P>
      </>
    ),
  },
  {
    id: "teachers",
    title: "For teachers",
    content: (
      <>
        <P><Strong>Question Bank.</Strong> Questions are shared across your College and grouped by subject. Three types are supported:</P>
        <Table
          head={["Type", "How it's graded"]}
          rows={[
            ["Single choice (MCQ)", "Automatically — full marks for the correct option"],
            ["Multiple choice (MCQ)", "Automatically — full marks only if exactly the correct set of options is chosen"],
            ["Subjective", "Manually by the teacher; add a model answer to guide grading (never shown to students)"],
          ]}
        />
        <P>
          Use <Strong>AI import</Strong> to turn a PDF or photo of a question paper into draft questions, then review them before saving.
          Editing a question that is already used in a live or completed exam creates a new copy, so past answers stay intact.
        </P>
        <P><Strong>Building an exam</Strong> — in <Path>Manage Exams</Path> → <Path>Design New Exam</Path>:</P>
        <Steps
          items={[
            "Set title, subject, duration, total and passing marks, and target a branch or a specific batch (leave empty for the whole College).",
            "Add questions from the bank, set marks per question and drag to reorder. Optionally shuffle questions and options per student.",
            "Publish with an optional start and end time. Students in the target group see it immediately and can start once the window opens.",
            "End the exam manually at any time — any unfinished attempts are submitted and graded.",
          ]}
        />
        <P>
          <Strong>Proctoring log.</Strong> When reviewing an attempt you&rsquo;ll see every browser and camera warning with its time,
          and whether the attempt was ended for violations. Treat these as indicators and review them before taking action.
        </P>
        <P>
          <Strong>Grading.</Strong> Open <Path>Grading</Path> to see submissions, with those needing review listed first. MCQs are
          already marked; enter marks and feedback for subjective answers. Click <Path>Get AI recommendation</Path> for a suggested
          score with reasoning — it&rsquo;s only a starting point: you must tick that you&rsquo;ve reviewed it before the mark can be saved,
          and the AI never saves grades itself. Use <Path>Sync &amp; Recover Results</Path> to recalculate
          totals — your manual marks are preserved.
        </P>
      </>
    ),
  },
  {
    id: "students",
    title: "For students",
    content: (
      <>
        <P>Your assigned exams appear under <Path>My Assessments</Path>. Before starting, the lobby checks your setup:</P>
        <Steps
          items={[
            "Read and accept the exam rules.",
            "Disconnect any extra monitors — exams require a single display.",
            "Allow camera access and sit facing the screen in good light. Continue once your face is verified.",
            "Enter fullscreen mode. The question paper opens and the timer starts.",
          ]}
        />
        <Card title="During the exam" className="mt-2">
          <UL
            items={[
              "Your answers save automatically every 30 seconds and when you submit.",
              "Switching tabs, leaving fullscreen or connecting another display counts as a violation. After 4 violations the exam ends automatically.",
              "Your camera stays on (top-right of the exam). If your face is out of view, someone else appears, or you turn your head or look down/away from the screen for more than a few seconds, you get a face warning (a countdown shows first). 4 face warnings end the exam.",
              "During the camera check, look at the centre of your screen for a moment — this calibrates the system to your seating position.",
              "Camera video is analysed on your device only — it is never recorded or uploaded.",
              "If you lose connection, reopen the exam — your attempt and saved answers are restored.",
              "When the timer reaches zero your exam is submitted automatically.",
              "Each exam can be attempted once.",
            ]}
          />
        </Card>
        <P>
          Results appear under <Path>My Results</Path>. Multiple-choice marks are immediate; subjective answers appear once your
          teacher has graded them.
        </P>
      </>
    ),
  },
  {
    id: "grading-scale",
    title: "Grades and GPA",
    content: (
      <>
        <Table
          head={["Percentage", "Grade point"]}
          rows={[["90% and above", "4.0"], ["80 – 89%", "3.0"], ["70 – 79%", "2.0"], ["60 – 69%", "1.0"], ["Below 60%", "0.0"]]}
        />
        <P>
          An attempt passes if it reaches the exam&rsquo;s passing marks, or 40% when none are set. Semester GPA is the credit-weighted
          average of your best grade point in each enrolled subject for that semester.
        </P>
      </>
    ),
  },
  {
    id: "billing",
    title: "Plans and billing",
    content: (
      <>
        <P>
          Admins manage subscriptions in <Path>Billing &amp; Plan</Path>, which shows your current plan, renewal date and how much of each
          limit you&rsquo;ve used. Payment is by card, UPI or net banking through Razorpay, and activates immediately.
        </P>
        <UL
          items={[
            "When a trial or paid period ends, the account becomes read-only until you pay. Students can't start new exams in this state.",
            "Cancelling keeps your data read-only for a 7-day grace period before the account is deactivated.",
            <>See the <A href="/terms#cancellation">Terms</A> for full details.</>,
          ]}
        />
      </>
    ),
  },
];

export default function DocsPage() {
  return (
    <InfoPage
      eyebrow="Documentation"
      title="Using Testify"
      intro="Everything admins, teachers and students need to set up, run and take exams."
      sections={sections}
    >
      <div className="grid gap-4 sm:grid-cols-3 mb-14">
        <a href="#admins" className="block rounded-2xl border border-testify-border bg-testify-bg2 p-6 hover:border-testify-accent transition-colors">
          <p className="font-semibold text-testify-text">College admins</p>
          <p className="mt-1 text-sm text-testify-muted">Structure, people, uploads</p>
        </a>
        <a href="#teachers" className="block rounded-2xl border border-testify-border bg-testify-bg2 p-6 hover:border-testify-accent transition-colors">
          <p className="font-semibold text-testify-text">Teachers</p>
          <p className="mt-1 text-sm text-testify-muted">Questions, exams, grading</p>
        </a>
        <a href="#students" className="block rounded-2xl border border-testify-border bg-testify-bg2 p-6 hover:border-testify-accent transition-colors">
          <p className="font-semibold text-testify-text">Students</p>
          <p className="mt-1 text-sm text-testify-muted">Taking exams, results</p>
        </a>
      </div>
    </InfoPage>
  );
}
