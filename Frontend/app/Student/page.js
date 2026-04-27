"use client";

import Link from "next/link";
import { ArrowRight, CalendarClock, GraduationCap, IdCard, Mail, Phone, RefreshCcw } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { buildAssetUrl } from "@/app/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

import StudentShell from "./_components/StudentShell";
import {
  MessageBanner,
  PageCard,
  PhotoPreviewCard,
  SectionIntro,
  StatCard,
  StudentLoadingScreen,
} from "./_components/StudentUI";
import {
  calculateApprovedLeaveDays,
  calculateUniquePresentDays,
  fetchStudentDashboardData,
  formatDate,
  formatDateTime,
  isStudentAuthError,
  redirectStudentToLogin,
  useStudentSessionGuard,
} from "./_lib/student-portal";

export default function StudentDashboardPage() {
  const router = useRouter();
  const { sessionReady, studentSession } = useStudentSessionGuard(router);

  const [profile, setProfile] = useState(null);
  const [attendance, setAttendance] = useState([]);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [loadingDashboard, setLoadingDashboard] = useState(true);
  const [dashboardError, setDashboardError] = useState("");

  function applyDashboardData(dashboardData) {
    setProfile(dashboardData.profile);
    setAttendance(dashboardData.attendance);
    setLeaveRequests(dashboardData.leaveRequests);
  }

  async function refreshDashboard() {
    if (!studentSession.studentId || !studentSession.studentToken) {
      return;
    }

    setLoadingDashboard(true);
    setDashboardError("");

    try {
      const dashboardData = await fetchStudentDashboardData(
        studentSession.studentId,
        studentSession.studentToken,
      );

      applyDashboardData(dashboardData);
    } catch (error) {
      if (isStudentAuthError(error)) {
        redirectStudentToLogin(router);
        return;
      }

      setDashboardError(error.message || "Could not load the student dashboard.");
    } finally {
      setLoadingDashboard(false);
    }
  }

  useEffect(() => {
    if (!sessionReady || !studentSession.studentId || !studentSession.studentToken) {
      return;
    }

    let isActive = true;

    async function loadInitialDashboard() {
      try {
        const dashboardData = await fetchStudentDashboardData(
          studentSession.studentId,
          studentSession.studentToken,
        );

        if (!isActive) {
          return;
        }

        applyDashboardData(dashboardData);
      } catch (error) {
        if (!isActive) {
          return;
        }

        if (isStudentAuthError(error)) {
          redirectStudentToLogin(router);
          return;
        }

        setDashboardError(error.message || "Could not load the student dashboard.");
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
  }, [router, sessionReady, studentSession.studentId, studentSession.studentToken]);

  if (!sessionReady || !studentSession.studentId || !studentSession.studentToken) {
    return <StudentLoadingScreen />;
  }

  const uniquePresentDays = calculateUniquePresentDays(attendance);
  const approvedLeaveDays = calculateApprovedLeaveDays(leaveRequests);
  const latestAttendance = attendance[0] || null;
  const latestLeaveRequest = leaveRequests[0] || null;
  const profilePhotoUrl = buildAssetUrl(
    profile?.face_image_url || studentSession.faceImageUrl,
  );

  return (
    <StudentShell
      studentSession={studentSession}
      pageLabel="Student Portal"
      title="Student Dashboard"
      subtitle="Your student home now stays focused on overview and attendance capture. Use the main navigation for the core flow, then open the account menu for history, leave, and profile details."
    >
      <div className="grid gap-6 xl:grid-cols-[1.08fr,0.92fr]">
        <PageCard>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <SectionIntro
              eyebrow="Overview"
              title={`Welcome back, ${studentSession.studentName}`}
              description="Check your attendance summary, recent updates, and then jump straight into attendance capture when you are ready to mark today's presence."
            />

            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg" className="rounded-full">
                <Link href="/student/capture">
                  Open Attendance Capture
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={refreshDashboard}
                className="rounded-full"
              >
                <RefreshCcw className={`size-4 ${loadingDashboard ? "animate-spin" : ""}`} />
                {loadingDashboard ? "Refreshing..." : "Refresh Dashboard"}
              </Button>
            </div>
          </div>

          {dashboardError ? (
            <MessageBanner type="error" className="mt-5">
              {dashboardError}
            </MessageBanner>
          ) : null}

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Attendance records"
              value={loadingDashboard && attendance.length === 0 ? "..." : attendance.length}
            />
            <StatCard
              label="Unique present days"
              value={loadingDashboard && attendance.length === 0 ? "..." : uniquePresentDays}
              accentClass="border-emerald-200/80 bg-emerald-50/80 text-slate-900"
            />
            <StatCard
              label="Leave requests"
              value={loadingDashboard && leaveRequests.length === 0 ? "..." : leaveRequests.length}
              accentClass="border-sky-200/80 bg-sky-50/80 text-slate-900"
            />
            <StatCard
              label="Approved leave days"
              value={loadingDashboard && leaveRequests.length === 0 ? "..." : approvedLeaveDays}
              accentClass="border-amber-200/80 bg-amber-50/80 text-slate-900"
            />
          </div>
        </PageCard>

        <PageCard>
          <PhotoPreviewCard
            title="Profile Photo"
            subtitle="This image is currently registered to your student account for face-based attendance matching."
            imageUrl={profilePhotoUrl}
            fallbackLabel="Your registered profile image will appear here once the admin adds one."
            imageLoading="eager"
          />
        </PageCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <PageCard>
          <SectionIntro
            eyebrow="Recent Activity"
            title="Latest updates"
            description="Your latest attendance and leave activity appears here so you can confirm what the system last recorded."
          />

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <Card className="rounded-[1.75rem] border-border/80 bg-slate-50/80 shadow-none">
              <CardContent className="p-5">
                <Badge variant="outline" className="rounded-full px-3 py-1">
                  Last Attendance Entry
                </Badge>
                {latestAttendance ? (
                  <>
                    <p className="mt-4 text-lg font-semibold text-slate-950">
                      {latestAttendance.status.charAt(0).toUpperCase() + latestAttendance.status.slice(1)}
                    </p>
                    <p className="mt-2 text-sm text-slate-600">
                      {formatDateTime(latestAttendance.marked_at)}
                    </p>
                  </>
                ) : (
                  <p className="mt-4 text-sm text-slate-500">
                    No attendance record has been marked yet.
                  </p>
                )}
              </CardContent>
            </Card>

            <Card className="rounded-[1.75rem] border-border/80 bg-slate-50/80 shadow-none">
              <CardContent className="p-5">
                <Badge variant="outline" className="rounded-full px-3 py-1">
                  Latest Leave Request
                </Badge>
                {latestLeaveRequest ? (
                  <>
                    <p className="mt-4 text-lg font-semibold text-slate-950">
                      {latestLeaveRequest.status.charAt(0).toUpperCase() + latestLeaveRequest.status.slice(1)}
                    </p>
                    <p className="mt-2 text-sm text-slate-600">
                      {formatDate(latestLeaveRequest.start_date)} to {formatDate(latestLeaveRequest.end_date)}
                    </p>
                  </>
                ) : (
                  <p className="mt-4 text-sm text-slate-500">
                    No leave request has been submitted yet.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </PageCard>

        <PageCard>
          <SectionIntro
            eyebrow="Student Snapshot"
            title="Your account at a glance"
            description="The essentials below help you confirm which profile details and records are currently available in your student account."
          />

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <Card className="rounded-[1.75rem] border-border/80 bg-slate-50/80 shadow-none">
              <CardContent className="p-5">
                <Badge variant="outline" className="rounded-full px-3 py-1">
                  <IdCard className="mr-1 size-3.5" />
                  Student ID
                </Badge>
                <p className="mt-4 text-lg font-semibold text-slate-950">
                  {studentSession.studentId}
                </p>
              </CardContent>
            </Card>

            <Card className="rounded-[1.75rem] border-border/80 bg-slate-50/80 shadow-none">
              <CardContent className="p-5">
                <Badge variant="outline" className="rounded-full px-3 py-1">
                  <Mail className="mr-1 size-3.5" />
                  Email
                </Badge>
                <p className="mt-4 text-lg font-semibold text-slate-950">
                  {profile?.email || studentSession.studentEmail || "Not provided"}
                </p>
              </CardContent>
            </Card>

            <Card className="rounded-[1.75rem] border-border/80 bg-slate-50/80 shadow-none">
              <CardContent className="p-5">
                <Badge variant="outline" className="rounded-full px-3 py-1">
                  <Phone className="mr-1 size-3.5" />
                  Phone Number
                </Badge>
                <p className="mt-4 text-lg font-semibold text-slate-950">
                  {profile?.phone_number || studentSession.studentPhoneNumber || "Not provided"}
                </p>
              </CardContent>
            </Card>

            <Card className="rounded-[1.75rem] border-border/80 bg-slate-50/80 shadow-none">
              <CardContent className="p-5">
                <Badge variant="outline" className="rounded-full px-3 py-1">
                  <GraduationCap className="mr-1 size-3.5" />
                  Grade
                </Badge>
                <p className="mt-4 text-lg font-semibold text-slate-950">
                  {profile?.grade || studentSession.studentGrade || "Not provided"}
                </p>
              </CardContent>
            </Card>

            <Card className="rounded-[1.75rem] border-border/80 bg-slate-50/80 shadow-none">
              <CardContent className="p-5">
                <Badge variant="outline" className="rounded-full px-3 py-1">
                  <CalendarClock className="mr-1 size-3.5" />
                  Registered
                </Badge>
                <p className="mt-4 text-lg font-semibold text-slate-950">
                  {formatDateTime(profile?.created_at)}
                </p>
              </CardContent>
            </Card>

            <Card className="rounded-[1.75rem] border-border/80 bg-slate-50/80 shadow-none">
              <CardContent className="p-5">
                <Badge variant="outline" className="rounded-full px-3 py-1">
                  Next Step
                </Badge>
                <p className="mt-4 text-sm leading-6 text-slate-600">
                  Open the account menu to reach attendance history, leave management, and profile details.
                </p>
              </CardContent>
            </Card>
          </div>
        </PageCard>
      </div>
    </StudentShell>
  );
}
