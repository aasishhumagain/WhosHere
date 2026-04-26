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
    detail: "Students can sign in, capture attendance, review history, submit leave, and manage passwords.",
  },
  {
    icon: LayoutDashboard,
    label: "Separate Dashboards",
    detail: "Student and admin areas now live on their own pages instead of one crowded screen.",
  },
  {
    icon: ClipboardCheck,
    label: "Simple Flow",
    detail: "Welcome page first, login page second, and the rest of the experience stays behind the right portal.",
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
    detail: "Explain the core flow in a very lightweight way.",
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
              A cleaner first page for WhosHere starts here.
            </CardTitle>
            <CardDescription className="max-w-2xl text-base leading-7 text-slate-300">
              The public side now begins with a proper welcome page. From here, users can explore
              the basics and move into a separate login page when they are ready.
            </CardDescription>
          </CardHeader>

          <CardContent className="flex flex-wrap items-center gap-4 px-8 pb-8">
            <Link href="/login" className={buttonVariants({ size: "lg" })}>
              Get Started
              <ArrowRight className="size-4" />
            </Link>

            <Link href="/how-it-works" className={buttonVariants({ variant: "outline", size: "lg" })}>
              See How It Works
            </Link>
          </CardContent>
        </Card>

        <div className="grid gap-6">
          <Card className="border-white/80 bg-white/90 shadow-[0_20px_90px_rgba(15,23,42,0.08)]">
            <CardHeader className="gap-3 p-6">
              <Badge
                variant="outline"
                className="w-fit rounded-full border-primary/15 bg-primary/6 px-3 py-1 text-primary"
              >
                What&apos;s Ready
              </Badge>
              <CardTitle className="text-2xl tracking-tight text-slate-950">
                The flow is now easier to understand
              </CardTitle>
              <CardDescription className="text-sm leading-6 text-slate-600">
                Visitors land on a welcome page first, then move into the actual login screen from
                the `Get Started` button.
              </CardDescription>
            </CardHeader>
          </Card>

          <div className="grid gap-4 sm:grid-cols-3">
            {WELCOME_CARDS.map((card) => {
              const Icon = card.icon;

              return (
                <Card
                  key={card.label}
                  className="border-white/80 bg-white/90 shadow-[0_18px_60px_rgba(15,23,42,0.08)]"
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
            className="border-white/80 bg-white/90 shadow-[0_18px_60px_rgba(15,23,42,0.08)]"
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
