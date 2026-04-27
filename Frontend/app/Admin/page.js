"use client";

import Link from "next/link";
import {
  ArrowRight,
  ClipboardCheck,
  RefreshCcw,
  ShieldCheck,
  UserPlus,
  Users,
  Waves,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

import AdminShell from "./_components/AdminShell";
import {
  AdminLoadingScreen,
  MessageBanner,
  PageCard,
  SectionIntro,
  StatCard,
} from "./_components/AdminUI";
import {
  fetchAdminDashboardData,
  isAdminAuthError,
  redirectAdminToLogin,
  useAdminSessionGuard,
} from "./_lib/admin-portal";

const QUICK_LINKS = [
  {
    href: "/admin/register",
    label: "Register Student",
    description: "Create a new student account and capture a face photo.",
    icon: UserPlus,
  },
  {
    href: "/admin/directory",
    label: "Student Directory",
    description: "Review student records, edit details, and remove accounts.",
    icon: Users,
  },
  {
    href: "/admin/admin-directory",
    label: "Admin Directory",
    description: "Create admin accounts and update admin password settings.",
    icon: ShieldCheck,
  },
  {
    href: "/admin/attendance",
    label: "Attendance Control",
    description: "Filter, correct, export, and delete attendance records.",
    icon: ClipboardCheck,
  },
  {
    href: "/admin/leave",
    label: "Leave Requests",
    description: "Approve, reject, and clean up leave submissions.",
    icon: Waves,
  },
];

export default function AdminDashboardPage() {
  const router = useRouter();
  const { sessionReady, adminSession } = useAdminSessionGuard(router);

  const [students, setStudents] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [loadingDashboard, setLoadingDashboard] = useState(true);
  const [dashboardError, setDashboardError] = useState("");

  async function refreshDashboard() {
    if (!adminSession.token) {
      return;
    }

    setLoadingDashboard(true);
    setDashboardError("");

    try {
      const data = await fetchAdminDashboardData(adminSession.token);
      setStudents(data.students);
      setAttendance(data.attendance);
      setLeaveRequests(data.leaveRequests);
    } catch (error) {
      if (isAdminAuthError(error)) {
        redirectAdminToLogin(router);
        return;
      }

      setDashboardError(error.message || "Could not load the admin dashboard.");
    } finally {
      setLoadingDashboard(false);
    }
  }

  useEffect(() => {
    if (!sessionReady || !adminSession.token) {
      return;
    }

    let isActive = true;

    async function loadInitialDashboard() {
      try {
        const data = await fetchAdminDashboardData(adminSession.token);

        if (!isActive) {
          return;
        }

        setStudents(data.students);
        setAttendance(data.attendance);
        setLeaveRequests(data.leaveRequests);
      } catch (error) {
        if (!isActive) {
          return;
        }

        if (isAdminAuthError(error)) {
          redirectAdminToLogin(router);
          return;
        }

        setDashboardError(error.message || "Could not load the admin dashboard.");
      } finally {
        if (isActive) {
          setLoadingDashboard(false);
        }
      }
    }

    loadInitialDashboard();

    return () => {
      isActive = false;
    };
  }, [adminSession.token, router, sessionReady]);

  if (!sessionReady || !adminSession.token) {
    return <AdminLoadingScreen />;
  }

  const pendingLeaveRequests = leaveRequests.filter(
    (leaveRequest) => leaveRequest.status === "pending",
  ).length;
  const approvedLeaveRequests = leaveRequests.filter(
    (leaveRequest) => leaveRequest.status === "approved",
  ).length;

  return (
    <AdminShell
      adminSession={adminSession}
      pageLabel="Admin Workspace"
      title="Admin Dashboard"
      subtitle="Your admin landing page now stays focused on summary and quick navigation, while admin accounts, student records, attendance, and leave tools live on their own dedicated pages."
    >
      <PageCard>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <SectionIntro
            eyebrow="Overview"
            title="One view of the whole attendance system"
            description="Use this page for the high-level snapshot, then jump into the exact admin page you need for registration, admin account security, student directory cleanup, attendance corrections, or leave review."
          />

          <Button
            type="button"
            size="lg"
            className="rounded-full"
            onClick={refreshDashboard}
          >
            <RefreshCcw className={`size-4 ${loadingDashboard ? "animate-spin" : ""}`} />
            {loadingDashboard ? "Refreshing..." : "Refresh Dashboard"}
          </Button>
        </div>

        {dashboardError ? (
          <MessageBanner type="error" className="mt-5">
            {dashboardError}
          </MessageBanner>
        ) : null}

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Registered students"
            value={loadingDashboard && students.length === 0 ? "..." : students.length}
          />
          <StatCard
            label="Attendance entries"
            value={loadingDashboard && attendance.length === 0 ? "..." : attendance.length}
            accentClass="border-sky-200/80 bg-sky-50/80 text-slate-900"
          />
          <StatCard
            label="Pending leave requests"
            value={loadingDashboard && leaveRequests.length === 0 ? "..." : pendingLeaveRequests}
            accentClass="border-amber-200/80 bg-amber-50/80 text-slate-900"
          />
          <StatCard
            label="Approved leave requests"
            value={loadingDashboard && leaveRequests.length === 0 ? "..." : approvedLeaveRequests}
            accentClass="border-emerald-200/80 bg-emerald-50/80 text-slate-900"
          />
        </div>
      </PageCard>

      <div className="grid gap-6 xl:grid-cols-2">
        <PageCard>
          <SectionIntro
            eyebrow="Quick Actions"
            title="Open the right admin page fast"
            description="Each management area is now split into its own page, so you can work on admin accounts, student records, attendance, or leave without carrying the full dashboard everywhere."
          />

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {QUICK_LINKS.map((link) => {
              const Icon = link.icon;

              return (
                <Card key={link.href} className="rounded-[1.75rem] border-border/80 bg-slate-50/80 shadow-none">
                  <CardContent className="p-5">
                    <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                      <Icon className="size-5" />
                    </div>
                    <h3 className="mt-4 text-lg font-semibold text-slate-950">{link.label}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{link.description}</p>
                    <Button asChild variant="outline" className="mt-4 rounded-full">
                      <Link href={link.href}>
                        Open Page
                        <ArrowRight className="size-4" />
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </PageCard>

        <PageCard>
          <SectionIntro
            eyebrow="Workflow"
            title="Suggested admin flow"
            description="A lighter page structure works best when each page has a clear purpose. This is the flow the new admin section is designed around."
          />

          <div className="mt-6 space-y-4">
            <Card className="rounded-[1.75rem] border-border/80 bg-slate-50/80 shadow-none">
              <CardContent className="p-5">
                <p className="text-sm font-semibold text-slate-950">1. Secure Admin Access</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Keep admin credentials current and create separate admin accounts when another trusted user needs access.
                </p>
              </CardContent>
            </Card>

            <Card className="rounded-[1.75rem] border-border/80 bg-slate-50/80 shadow-none">
              <CardContent className="p-5">
                <p className="text-sm font-semibold text-slate-950">2. Register Student</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Create the account and capture a face photo before the student starts using the system.
                </p>
              </CardContent>
            </Card>

            <Card className="rounded-[1.75rem] border-border/80 bg-slate-50/80 shadow-none">
              <CardContent className="p-5">
                <p className="text-sm font-semibold text-slate-950">3. Review Student Directory</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Keep student names, emails, passwords, grades, phone numbers, and face images clean and current.
                </p>
              </CardContent>
            </Card>

            <Card className="rounded-[1.75rem] border-border/80 bg-slate-50/80 shadow-none">
              <CardContent className="p-5">
                <p className="text-sm font-semibold text-slate-950">4. Correct Attendance and Leave</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Use the attendance and leave pages to resolve mistakes, export reports, and approve requests.
                </p>
              </CardContent>
            </Card>
          </div>
        </PageCard>
      </div>
    </AdminShell>
  );
}
