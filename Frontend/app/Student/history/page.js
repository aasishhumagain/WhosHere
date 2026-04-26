"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import StudentShell from "../_components/StudentShell";
import {
  MessageBanner,
  PageCard,
  StatCard,
  StudentLoadingScreen,
  StatusPill,
} from "../_components/StudentUI";
import {
  calculateUniquePresentDays,
  fetchStudentAttendance,
  formatDateTime,
  isStudentAuthError,
  redirectStudentToLogin,
  useStudentSessionGuard,
} from "../_lib/student-portal";

export default function StudentAttendanceHistoryPage() {
  const router = useRouter();
  const { sessionReady, studentSession } = useStudentSessionGuard(router);

  const [attendance, setAttendance] = useState([]);
  const [loadingAttendance, setLoadingAttendance] = useState(true);
  const [attendanceError, setAttendanceError] = useState("");

  async function refreshAttendanceHistory() {
    if (!studentSession.studentId || !studentSession.studentToken) {
      return;
    }

    setLoadingAttendance(true);
    setAttendanceError("");

    try {
      const records = await fetchStudentAttendance(
        studentSession.studentId,
        studentSession.studentToken,
      );
      setAttendance(records);
    } catch (error) {
      if (isStudentAuthError(error)) {
        redirectStudentToLogin(router);
        return;
      }

      setAttendanceError(error.message || "Could not load attendance history.");
    } finally {
      setLoadingAttendance(false);
    }
  }

  useEffect(() => {
    if (!sessionReady || !studentSession.studentId || !studentSession.studentToken) {
      return;
    }

    let isActive = true;

    async function loadInitialAttendanceHistory() {
      try {
        const records = await fetchStudentAttendance(
          studentSession.studentId,
          studentSession.studentToken,
        );

        if (!isActive) {
          return;
        }

        setAttendance(records);
      } catch (error) {
        if (!isActive) {
          return;
        }

        if (isStudentAuthError(error)) {
          redirectStudentToLogin(router);
          return;
        }

        setAttendanceError(error.message || "Could not load attendance history.");
      } finally {
        if (isActive) {
          setLoadingAttendance(false);
        }
      }
    }

    loadInitialAttendanceHistory();

    return () => {
      isActive = false;
    };
  }, [router, sessionReady, studentSession.studentId, studentSession.studentToken]);

  if (!sessionReady || !studentSession.studentId || !studentSession.studentToken) {
    return <StudentLoadingScreen />;
  }

  const presentOrLateCount = attendance.filter(
    (record) => record.status === "present" || record.status === "late",
  ).length;
  const uniquePresentDays = calculateUniquePresentDays(attendance);

  return (
    <StudentShell
      studentSession={studentSession}
      pageLabel="Attendance History"
      title="Attendance Timeline"
      subtitle="Review every attendance entry recorded for your account. This page is separated from capture so you can audit the history without affecting the daily attendance flow."
    >
      <PageCard>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-amber-700">
              Attendance Overview
            </p>
            <h2 className="mt-3 text-3xl font-semibold text-slate-950">
              Review your attendance records
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
              Each row shows the status and timestamp returned by the backend for your student
              account.
            </p>
          </div>

          <button
            type="button"
            onClick={refreshAttendanceHistory}
            className="rounded-2xl border border-slate-300 px-5 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
          >
            {loadingAttendance ? "Refreshing..." : "Refresh Attendance"}
          </button>
        </div>

        {attendanceError ? (
          <MessageBanner type="error" className="mt-5">
            {attendanceError}
          </MessageBanner>
        ) : null}

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <StatCard
            label="Total records"
            value={loadingAttendance && attendance.length === 0 ? "..." : attendance.length}
          />
          <StatCard
            label="Present or late"
            value={loadingAttendance && attendance.length === 0 ? "..." : presentOrLateCount}
            accentClass="border-emerald-200 bg-emerald-50 text-slate-900"
          />
          <StatCard
            label="Unique present days"
            value={loadingAttendance && attendance.length === 0 ? "..." : uniquePresentDays}
            accentClass="border-sky-200 bg-sky-50 text-slate-900"
          />
        </div>
      </PageCard>

      <PageCard className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[52rem] text-sm">
            <thead className="bg-slate-100 text-left">
              <tr>
                <th className="border-b border-slate-200 px-6 py-4">Status</th>
                <th className="border-b border-slate-200 px-6 py-4">Date</th>
                <th className="border-b border-slate-200 px-6 py-4">Time</th>
                <th className="border-b border-slate-200 px-6 py-4">Full Timestamp</th>
              </tr>
            </thead>

            <tbody>
              {attendance.length === 0 ? (
                <tr>
                  <td className="px-6 py-8 text-slate-500" colSpan="4">
                    {loadingAttendance
                      ? "Loading attendance records..."
                      : "No attendance records found yet."}
                  </td>
                </tr>
              ) : (
                attendance.map((record) => (
                  <tr key={record.id} className="odd:bg-white even:bg-slate-50">
                    <td className="border-b border-slate-100 px-6 py-4">
                      <StatusPill status={record.status} />
                    </td>
                    <td className="border-b border-slate-100 px-6 py-4">
                      {new Date(record.marked_at).toLocaleDateString()}
                    </td>
                    <td className="border-b border-slate-100 px-6 py-4">
                      {new Date(record.marked_at).toLocaleTimeString()}
                    </td>
                    <td className="border-b border-slate-100 px-6 py-4">
                      {formatDateTime(record.marked_at)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </PageCard>
    </StudentShell>
  );
}
