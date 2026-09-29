"use client";

import Link from "next/link";
import { useAuth } from "@/context/auth-context";
import { Button } from "@/components/ui/button";
import { useTheme } from "next-themes";

export default function Navbar() {

  const { user, logout } = useAuth();
  const { setTheme } = useTheme();

  return (

    <nav className="w-full border-b px-6 py-4 flex justify-between items-center bg-background">

      <Link href="/" className="font-semibold text-lg">
        Testify
      </Link>

      <div className="flex gap-3">

        <Button variant="outline" onClick={() => setTheme("light")}>Light</Button>
        <Button variant="outline" onClick={() => setTheme("dark")}>Dark</Button>

        {!user ? (
          <>
            <Link href="/login">
              <Button variant="outline">Login</Button>
            </Link>

            <Link href="/get-started">
              <Button>Get Started</Button>
            </Link>
          </>
        ) : (
          <>
            <Link href="/dashboard">
              <Button variant="outline">Dashboard</Button>
            </Link>

            <Button variant="destructive" onClick={logout}>
              Logout
            </Button>
          </>
        )}

      </div>

    </nav>

  );

}