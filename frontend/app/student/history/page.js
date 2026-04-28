"use client";

import { RefreshCcw } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import StudentShell from "../_components/StudentShell";
import {
  MessageBanner,
  PageCard,
  SectionIntro,
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
      title="Attendance History"
      subtitle="See the attendance records saved for your account."
    >
      <PageCard>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <SectionIntro
            eyebrow="History"
            title="Review your attendance records"
            description="Each row shows the status, date, and time saved in the system."
          />

          <Button
            type="button"
            onClick={refreshAttendanceHistory}
            variant="outline"
            size="lg"
            className="rounded-full"
          >
            <RefreshCcw className={`size-4 ${loadingAttendance ? "animate-spin" : ""}`} />
            {loadingAttendance ? "Refreshing..." : "Refresh Attendance"}
          </Button>
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
        <Table className="min-w-[52rem]">
          <TableHeader className="bg-slate-50">
            <TableRow>
              <TableHead className="px-6">Status</TableHead>
              <TableHead className="px-6">Date</TableHead>
              <TableHead className="px-6">Time</TableHead>
              <TableHead className="px-6">Full Timestamp</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {attendance.length === 0 ? (
              <TableRow>
                <TableCell className="px-6 py-8 text-slate-500" colSpan="4">
                  {loadingAttendance
                    ? "Loading attendance records..."
                    : "No attendance records found yet."}
                </TableCell>
              </TableRow>
            ) : (
              attendance.map((record) => (
                <TableRow key={record.id}>
                  <TableCell className="px-6">
                    <StatusPill status={record.status} />
                  </TableCell>
                  <TableCell className="px-6">
                    {new Date(record.marked_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="px-6">
                    {new Date(record.marked_at).toLocaleTimeString()}
                  </TableCell>
                  <TableCell className="px-6">
                    {formatDateTime(record.marked_at)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </PageCard>
    </StudentShell>
  );
}
