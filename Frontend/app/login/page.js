import AuthPortal from "@/app/_components/AuthPortal";
import MarketingShell from "@/app/_components/MarketingShell";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function LoginPage() {
  return (
    <MarketingShell activePage="login">
      <section className="space-y-6">
        <Card className="border-white/80 bg-white/88 shadow-[0_20px_90px_rgba(15,23,42,0.08)] backdrop-blur-sm">
          <CardHeader className="gap-4 p-6">
            <Badge
              variant="outline"
              className="w-fit rounded-full border-primary/15 bg-primary/6 px-3 py-1 text-primary"
            >
              Get Started
            </Badge>
            <div>
              <CardTitle className="text-4xl tracking-tight text-slate-950">
                Sign in to continue
              </CardTitle>
              <CardDescription className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
                Use the student login for attendance and leave requests. Use the admin login for
                registration, records, reports, and system management.
              </CardDescription>
            </div>
          </CardHeader>
        </Card>

        <AuthPortal />
      </section>
    </MarketingShell>
  );
}
