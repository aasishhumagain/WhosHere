import Link from "next/link";
import { ArrowRight, Camera, ShieldCheck, Users } from "lucide-react";

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

const FEATURE_CARDS = [
  {
    icon: Camera,
    label: "Attendance Capture",
    detail: "Students can open the camera, take a photo, and mark attendance.",
  },
  {
    icon: Users,
    label: "Student Self-Service",
    detail: "Students can check attendance history, request leave, and change passwords.",
  },
  {
    icon: ShieldCheck,
    label: "Admin Control",
    detail: "Admins can register students, fix attendance, review logs, and manage leave requests.",
  },
];

export default function FeaturesPage() {
  return (
    <MarketingShell activePage="features">
      <section className="space-y-6">
        <Card className="overflow-hidden border-white/80 bg-white/88 shadow-[0_20px_90px_rgba(15,23,42,0.08)] backdrop-blur-sm dark:border-white/10 dark:bg-slate-950/88 dark:shadow-[0_28px_90px_rgba(0,0,0,0.6)]">
          <CardHeader className="gap-4 p-6">
            <Badge
              variant="outline"
              className="w-fit rounded-full border-primary/15 bg-primary/6 px-3 py-1 text-primary"
            >
              Features
            </Badge>
            <div>
              <CardTitle className="text-4xl tracking-tight text-slate-950">
                What WhosHere includes
              </CardTitle>
              <CardDescription className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
                These are the main parts of the system before you log in.
              </CardDescription>
            </div>
          </CardHeader>
        </Card>

        <div className="grid gap-6 md:grid-cols-3">
          {FEATURE_CARDS.map((feature) => {
            const Icon = feature.icon;

            return (
              <Card
                key={feature.label}
                className="h-full border-white/80 bg-white/90 shadow-[0_18px_60px_rgba(15,23,42,0.08)] dark:border-white/10 dark:bg-slate-950/84 dark:shadow-[0_28px_90px_rgba(0,0,0,0.55)]"
              >
                <CardContent className="p-6">
                  <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <Icon className="size-5" />
                  </div>
                  <h2 className="mt-5 text-xl font-semibold text-slate-950">{feature.label}</h2>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{feature.detail}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card className="border-dashed border-primary/20 bg-white/72 shadow-none dark:bg-slate-950/78">
          <CardContent className="flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-lg font-semibold text-slate-950">Built for everyday use</p>
              <p className="mt-2 text-sm text-slate-600">
                The project already covers registration, attendance, leave handling, reports, and logs.
              </p>
            </div>

            <Link href="/login" className={buttonVariants({ size: "lg" })}>
              Get Started
              <ArrowRight className="size-4" />
            </Link>
          </CardContent>
        </Card>
      </section>
    </MarketingShell>
  );
}
