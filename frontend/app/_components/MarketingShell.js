import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button-variants";
import { Card, CardContent } from "@/components/ui/card";
import ThemeToggle from "@/app/_components/ThemeToggle";

const NAV_LINKS = [
  {
    href: "/",
    label: "Home",
    key: "home",
  },
  {
    href: "/features",
    label: "Features",
    key: "features",
  },
  {
    href: "/how-it-works",
    label: "How It Works",
    key: "how-it-works",
  },
];

export default function MarketingShell({ activePage, children }) {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(191,219,254,0.8),transparent_22%),radial-gradient(circle_at_88%_16%,rgba(254,240,138,0.55),transparent_18%),linear-gradient(180deg,#f8fbff_0%,#eef4ff_55%,#ffffff_100%)] px-4 py-6 text-slate-900 dark:bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.12),transparent_20%),radial-gradient(circle_at_88%_16%,rgba(37,99,235,0.14),transparent_18%),linear-gradient(180deg,#01040f_0%,#020617_42%,#08101f_100%)] dark:text-slate-100 md:px-6">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-[-10rem] top-[-8rem] size-96 rounded-full bg-primary/10 blur-3xl dark:bg-primary/18" />
        <div className="absolute bottom-[-10rem] right-[-4rem] size-[26rem] rounded-full bg-sky-300/20 blur-3xl dark:bg-sky-400/8" />
      </div>

      <div className="relative mx-auto max-w-7xl space-y-6">
        <Card className="border-white/80 bg-white/88 shadow-[0_20px_90px_rgba(15,23,42,0.08)] backdrop-blur-sm dark:border-white/10 dark:bg-slate-950/88 dark:shadow-[0_28px_90px_rgba(0,0,0,0.6)]">
          <CardContent className="flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-1">
              <Badge
                variant="outline"
                className="rounded-full border-primary/15 bg-primary/6 px-3 py-1 text-primary"
              >
                Smart Attendance System
              </Badge>
              <Link href="/" className="block text-2xl font-semibold tracking-tight text-slate-950 dark:text-slate-50">
                WhosHere
              </Link>
            </div>

            <nav className="flex flex-wrap items-center gap-2">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    buttonVariants({
                      variant: activePage === link.key ? "secondary" : "ghost",
                    }),
                    "rounded-full",
                  )}
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            <div className="flex flex-wrap items-center gap-3">
              <ThemeToggle />

              <Link
                href="/login"
                className={cn(
                  buttonVariants({
                    variant: activePage === "login" ? "secondary" : "default",
                    size: "lg",
                  }),
                  "rounded-full px-6",
                )}
              >
                Get Started
                <ArrowRight className="size-4" />
              </Link>
            </div>
          </CardContent>
        </Card>

        {children}

        <p className="pb-6 text-center text-sm text-muted-foreground dark:text-slate-400">
          Built for fast student check-ins, cleaner records, and stronger admin oversight.
        </p>
      </div>
    </main>
  );
}
