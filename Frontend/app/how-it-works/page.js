import Link from "next/link";

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

const STEPS = [
  {
    step: "01",
    title: "Set up the portal",
    detail: "The admin signs in, registers students, and saves their face photos.",
  },
  {
    step: "02",
    title: "Students log in",
    detail: "Students sign in, mark attendance, and check their own record.",
  },
  {
    step: "03",
    title: "Review the records",
    detail: "Admins review attendance, fix mistakes, and respond to leave requests.",
  },
];

export default function HowItWorksPage() {
  return (
    <MarketingShell activePage="how-it-works">
      <section className="space-y-6">
        <Card className="overflow-hidden border-white/80 bg-white/88 shadow-[0_20px_90px_rgba(15,23,42,0.08)] backdrop-blur-sm">
          <CardHeader className="gap-4 p-6">
            <Badge
              variant="outline"
              className="w-fit rounded-full border-primary/15 bg-primary/6 px-3 py-1 text-primary"
            >
              How It Works
            </Badge>
            <div>
              <CardTitle className="text-4xl tracking-tight text-slate-950">
                How the system works
              </CardTitle>
              <CardDescription className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
                The full flow is simple: set up students, mark attendance, then review the records.
              </CardDescription>
            </div>
          </CardHeader>
        </Card>

        <div className="grid gap-6 lg:grid-cols-3">
          {STEPS.map((item) => (
            <Card
              key={item.step}
              className="h-full border-white/80 bg-white/90 shadow-[0_18px_60px_rgba(15,23,42,0.08)]"
            >
              <CardContent className="p-6">
                <span className="text-sm font-semibold uppercase tracking-[0.28em] text-primary/80">
                  Step {item.step}
                </span>
                <h2 className="mt-4 text-xl font-semibold text-slate-950">{item.title}</h2>
                <p className="mt-3 text-sm leading-6 text-slate-600">{item.detail}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="border-dashed border-primary/20 bg-white/72 shadow-none">
          <CardContent className="flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-lg font-semibold text-slate-950">Ready to try the flow?</p>
              <p className="mt-2 text-sm text-slate-600">
                Open the login page and continue as a student or admin.
              </p>
            </div>

            <Link href="/login" className={buttonVariants({ size: "lg" })}>
              Open Login Page
            </Link>
          </CardContent>
        </Card>
      </section>
    </MarketingShell>
  );
}
