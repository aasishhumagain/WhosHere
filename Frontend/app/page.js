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
    label: "Attendance Capture",
    detail: "Students complete live check-ins, review attendance history, and submit leave requests.",
  },
  {
    icon: LayoutDashboard,
    label: "Role-Based Access",
    detail: "Separate student and admin workspaces keep daily actions focused and secure.",
  },
  {
    icon: ClipboardCheck,
    label: "Operational Records",
    detail: "Attendance, leave, reporting, and audit activity stay connected in one system.",
  },
];

const QUICK_LINKS = [
  {
    label: "Home",
    detail: "Platform summary and sign-in access.",
    href: "/",
  },
  {
    label: "Features",
    detail: "Core capabilities across student and admin workflows.",
    href: "/features",
  },
  {
    label: "Workflow",
    detail: "Enrollment, attendance capture, and review flow.",
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
              WhosHere
            </Badge>
            <CardTitle className="max-w-3xl text-5xl leading-tight tracking-tight text-white">
              Attendance operations in one place.
            </CardTitle>
            <CardDescription className="max-w-2xl text-base leading-7 text-slate-300">
              WhosHere brings together live attendance capture, leave handling, and admin oversight
              in a single portal.
            </CardDescription>
          </CardHeader>

          <CardContent className="flex flex-wrap items-center gap-4 px-8 pb-8">
            <Link href="/login" className={buttonVariants({ size: "lg" })}>
              Sign In
              <ArrowRight className="size-4" />
            </Link>

            <Link
              href="/how-it-works"
              className={`${buttonVariants({ variant: "outline", size: "lg" })} border-white/40 bg-white text-slate-950 hover:bg-sky-50 hover:text-slate-950`}
            >
              View Workflow
            </Link>
          </CardContent>
        </Card>

        <div className="grid gap-6">
          <Card className="h-full border-white/80 bg-white/90 shadow-[0_20px_90px_rgba(15,23,42,0.08)] dark:border-white/10 dark:bg-slate-950/88 dark:shadow-[0_28px_90px_rgba(0,0,0,0.6)]">
            <CardHeader className="gap-3 p-6">
              <Badge
                variant="outline"
                className="w-fit rounded-full border-primary/15 bg-primary/6 px-3 py-1 text-primary"
              >
                Overview
              </Badge>
              <CardTitle className="text-2xl tracking-tight text-slate-950">
                Platform overview
              </CardTitle>
              <CardDescription className="text-sm leading-6 text-slate-600">
                Review the core areas or move straight to sign-in.
              </CardDescription>
            </CardHeader>
          </Card>

          <div className="grid gap-4 sm:grid-cols-3">
            {WELCOME_CARDS.map((card) => {
              const Icon = card.icon;

              return (
                <Card
                  key={card.label}
                  className="h-full border-white/80 bg-white/90 shadow-[0_18px_60px_rgba(15,23,42,0.08)] dark:border-white/10 dark:bg-slate-950/84 dark:shadow-[0_28px_90px_rgba(0,0,0,0.55)]"
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
            className="h-full border-white/80 bg-white/90 shadow-[0_18px_60px_rgba(15,23,42,0.08)] dark:border-white/10 dark:bg-slate-950/84 dark:shadow-[0_28px_90px_rgba(0,0,0,0.55)]"
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
