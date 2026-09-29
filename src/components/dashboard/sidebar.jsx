"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import {
  LayoutDashboard, Users, GraduationCap, GitBranch, Layers, BookOpen, ClipboardList,
  School, CreditCard, FileQuestion, CheckSquare, BarChart3, LogOut, X, Building2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { StatusBadge, SUBSCRIPTION_TONE, humanize } from "@/components/ui/saas";

// Navigation per role. `exact` = only active on that exact path.
export const NAV = {
  SUPER_ADMIN: [
    { section: "Platform", items: [
      { href: "/dashboard/super-admin", label: "Overview", icon: LayoutDashboard, exact: true },
      { href: "/dashboard/super-admin/colleges", label: "Colleges", icon: School },
      { href: "/dashboard/super-admin/plans", label: "Plans & pricing", icon: CreditCard },
    ]},
  ],
  ADMIN: [
    { section: "Overview", items: [
      { href: "/dashboard/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
    ]},
    { section: "Academics", items: [
      { href: "/dashboard/admin/branches", label: "Branches", icon: GitBranch },
      { href: "/dashboard/admin/batches", label: "Batches", icon: Layers },
      { href: "/dashboard/admin/subjects", label: "Subjects", icon: BookOpen },
    ]},
    { section: "People", items: [
      { href: "/dashboard/admin/teachers", label: "Teachers", icon: Users },
      { href: "/dashboard/admin/students", label: "Students", icon: GraduationCap },
    ]},
    { section: "Account", items: [
      { href: "/dashboard/admin/billing", label: "Billing & plan", icon: CreditCard },
    ]},
  ],
  TEACHER: [
    { section: "Overview", items: [
      { href: "/dashboard/teacher", label: "Dashboard", icon: LayoutDashboard, exact: true },
    ]},
    { section: "Teaching", items: [
      { href: "/dashboard/teacher/exams", label: "Exams", icon: ClipboardList },
      { href: "/dashboard/teacher/questions", label: "Question bank", icon: FileQuestion },
      { href: "/dashboard/teacher/grading", label: "Grading", icon: CheckSquare },
    ]},
  ],
  STUDENT: [
    { section: "Overview", items: [
      { href: "/dashboard/student", label: "Dashboard", icon: LayoutDashboard, exact: true },
    ]},
    { section: "Learning", items: [
      { href: "/dashboard/student/exams", label: "My exams", icon: ClipboardList },
      { href: "/dashboard/student/results", label: "Results", icon: BarChart3 },
    ]},
  ],
};

const ROLE_LABEL = { SUPER_ADMIN: "Platform admin", ADMIN: "College admin", TEACHER: "Teacher", STUDENT: "Student" };

function initials(name = "") {
  return name.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "?";
}

function useSubscription(role) {
  const [billing, setBilling] = useState(null);
  useEffect(() => {
    if (role !== "ADMIN") return;
    let cancelled = false;
    fetch("/api/account/billing")
      .then((r) => r.json())
      .then((j) => { if (!cancelled && j.success) setBilling(j.billing); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [role]);
  return billing;
}

function SidebarContent({ onNavigate }) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const sections = NAV[user?.role] || [];
  const billing = useSubscription(user?.role);

  const isActive = (item) =>
    item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(item.href + "/");

  return (
    <div className="flex h-full flex-col">
      {/* Brand */}
      <div className="flex h-16 items-center gap-2.5 px-5">
        <Link href="/dashboard" onClick={onNavigate} className="flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary font-serif text-lg font-bold italic text-primary-foreground">T</span>
          <span className="font-serif text-xl font-bold tracking-tight text-foreground">Testify</span>
        </Link>
      </div>

      {/* Workspace */}
      {user?.role !== "SUPER_ADMIN" && user?.college?.name && (
        <div className="mx-3 mb-2 flex items-center gap-3 rounded-lg border bg-background/60 px-3 py-2.5">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Building2 className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">{user.college.name}</p>
            <p className="truncate text-xs text-muted-foreground">
              {billing ? `${billing.plan} plan` : ROLE_LABEL[user.role]}
            </p>
          </div>
          {billing && billing.subscriptionStatus !== "ACTIVE" && (
            <StatusBadge tone={SUBSCRIPTION_TONE[billing.subscriptionStatus]}>
              {billing.subscriptionStatus === "TRIAL" ? "Trial" : humanize(billing.subscriptionStatus)}
            </StatusBadge>
          )}
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-3" aria-label="Main">
        {sections.map((group) => (
          <div key={group.section}>
            <p className="mb-1.5 px-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">{group.section}</p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active = isActive(item);
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors",
                        active
                          ? "bg-sidebar-accent text-sidebar-accent-foreground"
                          : "text-sidebar-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      <Icon className={cn("size-4 shrink-0", active ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* User */}
      <div className="border-t p-3">
        <div className="flex items-center gap-3 rounded-lg px-2 py-2">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
            {initials(user?.name)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">{user?.name}</p>
            <p className="truncate text-xs text-muted-foreground">{ROLE_LABEL[user?.role] || user?.role}</p>
          </div>
          <button
            onClick={logout}
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
            aria-label="Log out"
            title="Log out"
          >
            <LogOut className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Sidebar({ mobileOpen = false, onClose }) {
  const pathname = usePathname();

  // Close the mobile drawer on navigation / Escape
  useEffect(() => { onClose?.(); }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e) => e.key === "Escape" && onClose?.();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileOpen, onClose]);

  return (
    <>
      {/* Desktop */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 border-r bg-sidebar lg:block">
        <SidebarContent />
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[85vw] border-r bg-sidebar shadow-2xl animate-in slide-in-from-left duration-200">
            <button onClick={onClose} className="absolute right-3 top-4 rounded-md p-1.5 text-muted-foreground hover:bg-muted" aria-label="Close menu">
              <X className="size-4" />
            </button>
            <SidebarContent onNavigate={onClose} />
          </aside>
        </div>
      )}
    </>
  );
}
