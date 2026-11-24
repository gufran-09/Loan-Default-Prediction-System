'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BarChart3, Bell, LayoutDashboard, ShieldCheck, Users, Menu, X, LogOut, UserCheck } from 'lucide-react'

const nav = [
  { href: '/', label: 'Overview', icon: LayoutDashboard },
  { href: '/borrowers', label: 'Borrowers', icon: Users },
  { href: '/alerts', label: 'Alerts', icon: Bell },
  { href: '/analytics', label: 'Analytics', icon: BarChart3 },
]

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  // Close mobile drawer on ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileOpen(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [mobileOpen])

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      {/* Desktop Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 border-r bg-card lg:flex lg:flex-col">
        <div className="flex h-20 items-center gap-3 border-b px-6">
          <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <ShieldCheck className="size-5" />
          </div>
          <div>
            <p className="font-semibold tracking-tight text-foreground">Loan Sentry</p>
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Officer console</p>
          </div>
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-4">
          {nav.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || (href !== '/' && pathname?.startsWith(href))
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  active ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                }`}
              >
                <Icon className="size-4 shrink-0" />
                {label}
              </Link>
            )
          })}
        </nav>
        <div className="border-t p-4">
          <div className="flex items-center gap-3 rounded-lg bg-muted/40 p-3">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 font-mono text-xs font-semibold text-primary">
              RO
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-foreground">Risk Officer</p>
              <p className="truncate text-[10px] text-muted-foreground">Institutional Risk</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile Drawer Overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden" aria-modal="true" role="dialog">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <div className="relative flex w-72 max-w-[85vw] flex-1 flex-col bg-card shadow-2xl transition-transform duration-200">
            <div className="flex h-16 sm:h-20 items-center justify-between border-b px-5 sm:px-6">
              <div className="flex items-center gap-2.5">
                <div className="flex size-8 sm:size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
                  <ShieldCheck className="size-4 sm:size-5" />
                </div>
                <div>
                  <p className="font-semibold tracking-tight text-foreground text-sm sm:text-base">Loan Sentry</p>
                  <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">Mobile Console</p>
                </div>
              </div>
              <button
                onClick={() => setMobileOpen(false)}
                className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Close menu"
              >
                <X className="size-5" />
              </button>
            </div>
            <nav className="flex flex-1 flex-col gap-1 p-4">
              {nav.map(({ href, label, icon: Icon }) => {
                const active = pathname === href || (href !== '/' && pathname?.startsWith(href))
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                      active ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                    }`}
                  >
                    <Icon className="size-4 shrink-0" />
                    {label}
                  </Link>
                )
              })}
            </nav>
            <div className="border-t p-4">
              <div className="flex items-center gap-3 rounded-lg bg-muted/40 p-3">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 font-mono text-xs font-semibold text-primary">
                  RO
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-foreground">Risk Officer</p>
                  <p className="truncate text-[10px] text-muted-foreground">Active Session</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="lg:pl-64 flex flex-col min-h-screen">
        <header className="sticky top-0 z-10 flex h-16 sm:h-20 items-center justify-between border-b bg-background/95 px-4 sm:px-6 backdrop-blur lg:px-10">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <button
              onClick={() => setMobileOpen(true)}
              className="rounded-lg border border-border p-2 text-muted-foreground hover:bg-muted hover:text-foreground lg:hidden shrink-0"
              aria-label="Open navigation menu"
            >
              <Menu className="size-5" />
            </button>
            <div className="min-w-0">
              <p className="font-mono text-[9px] sm:text-[10px] uppercase tracking-[0.15em] sm:tracking-[0.2em] text-muted-foreground truncate">
                Portfolio monitoring
              </p>
              <p className="mt-0.5 text-xs sm:text-sm font-medium truncate text-foreground">
                <span className="hidden sm:inline">
                  {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </span>
                <span className="sm:hidden">
                  {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <div className="hidden text-right md:block">
              <p className="text-sm font-semibold leading-tight text-foreground">Risk Officer</p>
              <p className="text-[11px] text-muted-foreground">Credit Risk Workspace</p>
            </div>
            <div className="flex size-8 sm:size-9 items-center justify-center rounded-full bg-primary/10 font-mono text-xs font-semibold text-primary ring-1 ring-primary/20">
              RO
            </div>
          </div>
        </header>
        <main className="flex-1 p-3.5 sm:p-6 lg:p-10 w-full max-w-[1600px] mx-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
