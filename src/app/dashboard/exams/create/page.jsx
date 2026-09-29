import { redirect } from "next/navigation";

// Exam creation lives in the teacher workspace (subject, cohort targeting,
// plan-limit checks). This legacy route just forwards there.
export default function CreateExamPage() {
  redirect("/dashboard/teacher/exams");
}
