import Link from "next/link";
import { ArrowRight, Camera, ClipboardCheck, LayoutDashboard } from "lucide-react";

import MarketingShell from "@/app/_components/MarketingShell";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button-variants";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const WELCOME_CARDS = [
  {
    icon: Camera,
    label: "Student Attendance",
    detail: "Students can sign in, capture attendance, review history, submit leave, and update passwords from their own portal.",
  },
  {
    icon: LayoutDashboard,
    label: "Focused Dashboards",
    detail: "Student and admin workspaces stay organized with dedicated pages for each part of the flow.",
  },
  {
    icon: ClipboardCheck,
    label: "Reliable Records",
    detail: "Attendance, leave requests, audit logs, and reports stay connected in one consistent system.",
  },
];

const QUICK_LINKS = [
  {
    label: "Home",
    detail: "Start with a welcome screen and entry point into the app.",
    href: "/",
  },
  {
    label: "Features",
    detail: "Keep a simple public page for the product highlights.",
    href: "/features",
  },
  {
    label: "How It Works",
    detail: "See the full flow from enrollment through attendance review.",
    href: "/how-it-works",
  },
];

export default function WelcomePage() {
  return (
    <MarketingShell activePage="home">
      <section className="grid gap-6 xl:grid-cols-[1.08fr,0.92fr]">
        <Card className="overflow-hidden border-white/70 bg-slate-950 text-white shadow-[0_30px_120px_rgba(15,23,42,0.28)]">
          <CardHeader className="gap-5 p-8">
            <Badge className="w-fit rounded-full border-0 bg-white/10 px-3 py-1 text-[0.72rem] uppercase tracking-[0.28em] text-blue-100">
              Welcome
            </Badge>
            <CardTitle className="max-w-3xl text-5xl leading-tight tracking-tight text-white">
              Face-recognition attendance built for a calmer campus workflow.
            </CardTitle>
            <CardDescription className="max-w-2xl text-base leading-7 text-slate-300">
              WhosHere gives students and administrators a clear path from sign-in to attendance
              tracking, student management, leave handling, and audit-ready reporting.
            </CardDescription>
          </CardHeader>

          <CardContent className="flex flex-wrap items-center gap-4 px-8 pb-8">
            <Link href="/login" className={buttonVariants({ size: "lg" })}>
              Get Started
              <ArrowRight className="size-4" />
            </Link>

            <Link
              href="/how-it-works"
              className={`${buttonVariants({ variant: "outline", size: "lg" })} border-white/40 bg-white text-slate-950 hover:bg-sky-50 hover:text-slate-950`}
            >
              See How It Works
            </Link>
          </CardContent>
        </Card>

        <div className="grid gap-6">
          <Card className="h-full border-white/80 bg-white/90 shadow-[0_20px_90px_rgba(15,23,42,0.08)]">
            <CardHeader className="gap-3 p-6">
              <Badge
                variant="outline"
                className="w-fit rounded-full border-primary/15 bg-primary/6 px-3 py-1 text-primary"
              >
                Platform Snapshot
              </Badge>
              <CardTitle className="text-2xl tracking-tight text-slate-950">
                Everything important is one step away
              </CardTitle>
              <CardDescription className="text-sm leading-6 text-slate-600">
                Use the public pages to understand the product quickly, then jump into the right
                portal from the login screen when you are ready to work.
              </CardDescription>
            </CardHeader>
          </Card>

          <div className="grid gap-4 sm:grid-cols-3">
            {WELCOME_CARDS.map((card) => {
              const Icon = card.icon;

              return (
                <Card
                  key={card.label}
                  className="h-full border-white/80 bg-white/90 shadow-[0_18px_60px_rgba(15,23,42,0.08)]"
                >
                  <CardContent className="p-5">
                    <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                      <Icon className="size-5" />
                    </div>
                    <h2 className="mt-4 text-lg font-semibold text-slate-950">{card.label}</h2>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{card.detail}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-3">
        {QUICK_LINKS.map((item) => (
          <Card
            key={item.href}
            className="h-full border-white/80 bg-white/90 shadow-[0_18px_60px_rgba(15,23,42,0.08)]"
          >
            <CardContent className="space-y-4 p-6">
              <div>
                <h2 className="text-xl font-semibold text-slate-950">{item.label}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">{item.detail}</p>
              </div>

              <Link href={item.href} className={buttonVariants({ variant: "outline" })}>
                Open Page
              </Link>
            </CardContent>
          </Card>
        ))}
      </section>
    </MarketingShell>
  );
}
