import { redirect } from "next/navigation";

// Legacy route kept for old links (e.g. the student dashboard). The real
// exam flow is /dashboard/student/exams/[id]/lobby → /active.
export default async function TakeExamPage({ params }) {
  const { id } = await params;
  redirect(`/dashboard/student/exams/${encodeURIComponent(id)}/lobby`);
}
