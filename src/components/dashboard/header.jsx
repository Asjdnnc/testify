"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, HelpCircle, ChevronRight } from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { ThemeToggle } from "@/components/theme-toggle";
import { NAV } from "./sidebar";

// Titles for pages that aren't top-level nav items
const DETAIL_TITLES = [
  [/^\/dashboard\/teacher\/exams\/[^/]+$/, "Exam builder"],
  [/^\/dashboard\/teacher\/grading\/attempt\/[^/]+$/, "Review attempt"],
  [/^\/dashboard\/teacher\/grading\/[^/]+$/, "Submissions"],
  [/^\/dashboard\/super-admin\/colleges\/[^/]+$/, "College details"],
  [/^\/dashboard\/student\/exams\/[^/]+\/lobby$/, "Exam check-in"],
];

function useBreadcrumb(role) {
  const pathname = usePathname() || "";
  const items = (NAV[role] || []).flatMap((g) => g.items);
  const section = items
    .filter((i) => pathname === i.href || pathname.startsWith(i.href + "/"))
    .sort((a, b) => b.href.length - a.href.length)[0];
  const detail = DETAIL_TITLES.find(([re]) => re.test(pathname))?.[1];
  return { section, detail };
}

export default function Header({ onOpenMenu }) {
  const { user } = useAuth();
  const { section, detail } = useBreadcrumb(user?.role);

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur-md supports-[backdrop-filter]:bg-background/70 sm:px-6">
      <button
        onClick={onOpenMenu}
        className="-ml-1 rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground lg:hidden"
        aria-label="Open menu"
      >
        <Menu className="size-5" />
      </button>

      <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-sm">
        {section ? (
          <>
            <Link
              href={section.href}
              className={detail ? "truncate text-muted-foreground hover:text-foreground" : "truncate font-medium text-foreground"}
            >
              {section.label}
            </Link>
            {detail && (
              <>
                <ChevronRight className="size-3.5 shrink-0 text-muted-foreground/60" />
                <span className="truncate font-medium text-foreground">{detail}</span>
              </>
            )}
          </>
        ) : (
          <span className="font-medium text-foreground">Dashboard</span>
        )}
      </nav>

      <div className="ml-auto flex items-center gap-2">
        <Link
          href="/docs"
          target="_blank"
          className="hidden items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:inline-flex"
        >
          <HelpCircle className="size-4" /> Help
        </Link>
        <ThemeToggle />
      </div>
    </header>
  );
}
