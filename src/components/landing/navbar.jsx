"use client";

import Link from "next/link";
import { useAuth } from "@/context/auth-context";
import { Button } from "@/components/ui/button";

export function Navbar() {
  const { user } = useAuth();
  
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-testify-border bg-[rgba(7,8,18,0.8)] backdrop-blur-md dark:bg-[rgba(7,8,18,0.8)] bg-white/80 dark:border-testify-border transition-colors">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-testify-accent flex items-center justify-center text-white font-serif italic text-lg font-bold">
            T
          </div>
          <span className="font-serif text-2xl font-bold text-testify-text tracking-tight">Testify</span>
        </Link>
        
        <div className="hidden md:flex items-center gap-8 text-sm font-medium text-testify-muted">
          <Link href="/#features" className="hover:text-testify-text transition-colors">Features</Link>
          <Link href="/#how-it-works" className="hover:text-testify-text transition-colors">How it works</Link>
          <Link href="/#pricing" className="hover:text-testify-text transition-colors">Pricing</Link>
          <Link href="/docs" className="hover:text-testify-text transition-colors">Docs</Link>
        </div>

        <div className="flex items-center gap-4">
          {user ? (
             <Link href="/dashboard">
               <Button className="bg-testify-accent hover:bg-testify-accent2 text-white border-0">Dashboard →</Button>
             </Link>
          ) : (
            <>
              <Link href="/login" className="text-sm font-medium text-testify-text hover:text-testify-muted transition-colors hidden sm:block">
                Sign in
              </Link>
              <Link href="/get-started">
                <Button className="bg-testify-accent hover:bg-testify-accent2 text-white border-0 rounded-full px-6">
                  Get Started →
                </Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
