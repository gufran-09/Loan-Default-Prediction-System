'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BarChart3, Bell, LayoutDashboard, LogOut, ShieldCheck, Users } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const nav = [
  { href: '/', label: 'Overview', icon: LayoutDashboard },
  { href: '/borrowers', label: 'Borrowers', icon: Users },
  { href: '/alerts', label: 'Alerts', icon: Bell },
  { href: '/analytics', label: 'Analytics', icon: BarChart3 },
]

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  async function logout() {
    await createClient().auth.signOut()
    window.location.href = '/signin'
  }

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 border-r bg-card lg:flex lg:flex-col">
        <div className="flex h-20 items-center gap-3 border-b px-6">
          <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <ShieldCheck className="size-5" />
          </div>
          <div>
            <p className="font-semibold tracking-tight">Aegis Risk</p>
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Officer console</p>
          </div>
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-4">
          {nav.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                pathname === href ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              }`}
            >
              <Icon className="size-4" />
              {label}
            </Link>
          ))}
        </nav>
        <div className="border-t p-4">
          <button onClick={logout} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground">
            <LogOut className="size-4" />
            Sign out
          </button>
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="flex h-20 items-center justify-between border-b bg-background/90 px-6 backdrop-blur lg:px-10">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Portfolio monitoring</p>
            <p className="mt-1 text-sm font-medium">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium">Risk Officer</p>
              <p className="text-xs text-muted-foreground">Authorized workspace</p>
            </div>
            <div className="flex size-9 items-center justify-center rounded-full bg-secondary text-sm font-semibold">RO</div>
          </div>
        </header>
        <main className="p-6 lg:p-10">{children}</main>
      </div>
    </div>
  )
}