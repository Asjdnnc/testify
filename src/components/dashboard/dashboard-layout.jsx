"use client";

import ProtectedRoute from "@/components/auth/protected-route";
import Sidebar from "./sidebar";
import Header from "./header";
import { usePathname } from "next/navigation";
import { useCallback, useState } from "react";

import ForcePasswordChange from "./force-password-change";
import AdminSetupGuide from "./admin-setup-guide";
import { useAuth } from "@/context/auth-context";

export default function DashboardLayout({ children }) {
  const pathname = usePathname();
  const { user } = useAuth();
  const isActiveExam = pathname?.endsWith("/active");
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = useCallback(() => setMenuOpen(false), []);

  if (user?.requirePasswordChange) {
    return <ForcePasswordChange />;
  }

  if (isActiveExam) {
     // Focus mode: no sidebar/header while an exam is running
     return (
       <ProtectedRoute>
          <div className="min-h-screen bg-background text-foreground">
             {children}
          </div>
       </ProtectedRoute>
     );
  }

  return (
    <ProtectedRoute>
      <div className="flex min-h-screen bg-background text-foreground">
        <Sidebar mobileOpen={menuOpen} onClose={closeMenu} />

        <div className="flex min-w-0 flex-1 flex-col">
          <Header onOpenMenu={() => setMenuOpen(true)} />

          <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            <div className="mx-auto w-full max-w-7xl">
              {children}
            </div>
          </main>

          {/* First-run setup guide (shown after the admin has a password) */}
          {user?.role === "ADMIN" && <AdminSetupGuide />}
        </div>
      </div>
    </ProtectedRoute>
  );
}
