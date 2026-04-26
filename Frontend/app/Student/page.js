"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { buildAssetUrl } from "@/app/lib/api";

import StudentShell from "./_components/StudentShell";
import {
  MessageBanner,
  PageCard,
  PhotoPreviewCard,
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
      subtitle="Your main student workspace now stays focused on overview and attendance capture. Use the two main buttons above for the core flow, then open the account dropdown for history, leave requests, profile details, and password settings."
    >
      <div className="grid gap-6 xl:grid-cols-[1.08fr,0.92fr]">
        <PageCard>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.28em] text-blue-700">
                Overview
              </p>
              <h2 className="mt-3 text-3xl font-semibold text-slate-950">
                Welcome back, {studentSession.studentName}
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
                Check your attendance summary, recent updates, and then jump straight into
                attendance capture when you are ready to mark today&apos;s presence.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/student/capture"
                className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800"
              >
                Open Attendance Capture
              </Link>
              <button
                type="button"
                onClick={refreshDashboard}
                className="rounded-2xl border border-slate-300 px-5 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
              >
                {loadingDashboard ? "Refreshing..." : "Refresh Dashboard"}
              </button>
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
              accentClass="border-emerald-200 bg-emerald-50 text-slate-900"
            />
            <StatCard
              label="Leave requests"
              value={loadingDashboard && leaveRequests.length === 0 ? "..." : leaveRequests.length}
              accentClass="border-sky-200 bg-sky-50 text-slate-900"
            />
            <StatCard
              label="Approved leave days"
              value={loadingDashboard && leaveRequests.length === 0 ? "..." : approvedLeaveDays}
              accentClass="border-amber-200 bg-amber-50 text-slate-900"
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
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-emerald-700">
            Recent Activity
          </p>
          <h2 className="mt-3 text-3xl font-semibold text-slate-950">Latest updates</h2>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                Last Attendance Entry
              </p>
              {latestAttendance ? (
                <>
                  <p className="mt-3 text-lg font-semibold text-slate-950">
                    {latestAttendance.status.charAt(0).toUpperCase() + latestAttendance.status.slice(1)}
                  </p>
                  <p className="mt-2 text-sm text-slate-600">
                    {formatDateTime(latestAttendance.marked_at)}
                  </p>
                </>
              ) : (
                <p className="mt-3 text-sm text-slate-500">
                  No attendance record has been marked yet.
                </p>
              )}
            </div>

            <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                Latest Leave Request
              </p>
              {latestLeaveRequest ? (
                <>
                  <p className="mt-3 text-lg font-semibold text-slate-950">
                    {latestLeaveRequest.status.charAt(0).toUpperCase() + latestLeaveRequest.status.slice(1)}
                  </p>
                  <p className="mt-2 text-sm text-slate-600">
                    {formatDate(latestLeaveRequest.start_date)} to {formatDate(latestLeaveRequest.end_date)}
                  </p>
                </>
              ) : (
                <p className="mt-3 text-sm text-slate-500">
                  No leave request has been submitted yet.
                </p>
              )}
            </div>
          </div>
        </PageCard>

        <PageCard>
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-amber-700">
            Student Snapshot
          </p>
          <h2 className="mt-3 text-3xl font-semibold text-slate-950">Your account at a glance</h2>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                Student ID
              </p>
              <p className="mt-3 text-lg font-semibold text-slate-950">
                {studentSession.studentId}
              </p>
            </div>

            <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                Email
              </p>
              <p className="mt-3 text-lg font-semibold text-slate-950">
                {profile?.email || studentSession.studentEmail || "Not provided"}
              </p>
            </div>

            <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                Registered
              </p>
              <p className="mt-3 text-lg font-semibold text-slate-950">
                {formatDateTime(profile?.created_at)}
              </p>
            </div>

            <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                Next Step
              </p>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                Open the account dropdown to reach attendance history, leave management, profile,
                and change-password settings.
              </p>
            </div>
          </div>
        </PageCard>
      </div>
    </StudentShell>
  );
}
