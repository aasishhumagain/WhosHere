"use client";

import Link from "next/link";
import { ArrowRight, ClipboardCheck, RefreshCcw, ScrollText, UserPlus, Users, Waves } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { Button, buttonVariants } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import AdminShell from "./_components/AdminShell";
import {
  AdminLoadingScreen,
  MessageBanner,
  PageCard,
  SectionIntro,
  StatCard,
  StatusPill,
} from "./_components/AdminUI";
import {
  fetchAdminDashboardData,
  formatDate,
  formatPercent,
  isAdminAuthError,
  redirectAdminToLogin,
  toDateInputValue,
  useAdminSessionGuard,
} from "./_lib/admin-portal";

const QUICK_ACTIONS = [
  {
    href: "/admin/register",
    label: "Register Student",
    description: "Create student accounts and capture face enrollment.",
    icon: UserPlus,
  },
  {
    href: "/admin/attendance",
    label: "Attendance Control",
    description: "Review attendance, fallback requests, and review notes.",
    icon: ClipboardCheck,
  },
  {
    href: "/admin/directory",
    label: "Student Directory",
    description: "Manage student records and stored face poses.",
    icon: Users,
  },
  {
    href: "/admin/leave",
    label: "Leave Requests",
    description: "Approve or reject pending leave submissions.",
    icon: Waves,
  },
  {
    href: "/admin/logs",
    label: "Audit Logs",
    description: "Review authentication and system activity.",
    icon: ScrollText,
  },
];

function buildRecentDateKeys(numberOfDays) {
  return Array.from({ length: numberOfDays }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (numberOfDays - index - 1));
    return toDateInputValue(date);
  });
}

function countFaceSetMissing(student) {
  return (student.missing_face_poses || []).length;
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const { sessionReady, adminSession } = useAdminSessionGuard(router);

  const [students, setStudents] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [fallbackRequests, setFallbackRequests] = useState([]);
  const [loadingDashboard, setLoadingDashboard] = useState(true);
  const [dashboardMessage, setDashboardMessage] = useState(null);

  function applyDashboardData(dashboardData) {
    setStudents(dashboardData.students || []);
    setAttendance(dashboardData.attendance || []);
    setLeaveRequests(dashboardData.leaveRequests || []);
    setFallbackRequests(dashboardData.fallbackRequests || []);
  }

  async function refreshDashboard() {
    if (!adminSession.token) {
      return;
    }

    setLoadingDashboard(true);
    setDashboardMessage(null);

    try {
      const dashboardData = await fetchAdminDashboardData(adminSession.token);
      applyDashboardData(dashboardData);
    } catch (error) {
      if (isAdminAuthError(error)) {
        redirectAdminToLogin(router);
        return;
      }

      setDashboardMessage({
        type: "error",
        message: error.message || "Could not load the admin dashboard.",
      });
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
        const dashboardData = await fetchAdminDashboardData(adminSession.token);

        if (!isActive) {
          return;
        }

        applyDashboardData(dashboardData);
      } catch (error) {
        if (!isActive) {
          return;
        }

        if (isAdminAuthError(error)) {
          redirectAdminToLogin(router);
          return;
        }

        setDashboardMessage({
          type: "error",
          message: error.message || "Could not load the admin dashboard.",
        });
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
    return <AdminLoadingScreen title="Loading dashboard..." description="Preparing attendance, enrollment, leave, and fallback review data." />;
  }

  const todayKey = toDateInputValue(new Date());
  const todayAttendance = attendance.filter((record) => toDateInputValue(record.marked_at) === todayKey);
  const confirmedTodayCount = todayAttendance.filter(
    (record) => record.status === "present" || record.status === "late" || record.status === "excused",
  ).length;
  const pendingLeaveCount = leaveRequests.filter((request) => request.status === "pending").length;
  const pendingFallbackCount = fallbackRequests.filter((request) => request.status === "pending").length;
  const completeFaceSetCount = students.filter((student) => student.has_complete_face_enrollment).length;
  const faceEnrollmentRate = students.length ? (completeFaceSetCount / students.length) * 100 : 0;
  const todayCheckedInRate = students.length ? (confirmedTodayCount / students.length) * 100 : 0;

  const recentDateKeys = buildRecentDateKeys(7);
  const trendRows = recentDateKeys.map((dateKey) => {
    const dayRecords = attendance.filter((record) => toDateInputValue(record.marked_at) === dateKey);
    const uniqueStudents = new Set(dayRecords.map((record) => record.student_id)).size;
    const present = dayRecords.filter((record) => record.status === "present").length;
    const late = dayRecords.filter((record) => record.status === "late").length;
    const excused = dayRecords.filter((record) => record.status === "excused").length;

    return {
      date: dateKey,
      uniqueStudents,
      present,
      late,
      excused,
      rate: students.length ? (uniqueStudents / students.length) * 100 : 0,
    };
  });

  const pendingFallbackByStudent = fallbackRequests.reduce((result, request) => {
    if (request.status !== "pending") {
      return result;
    }

    result[request.student_id] = (result[request.student_id] || 0) + 1;
    return result;
  }, {});

  const pendingLeaveByStudent = leaveRequests.reduce((result, request) => {
    if (request.status !== "pending") {
      return result;
    }

    result[request.student_id] = (result[request.student_id] || 0) + 1;
    return result;
  }, {});

  const attendanceRiskByStudent = attendance.reduce((result, record) => {
    const current = result[record.student_id] || { total: 0, lateOrAbsent: 0 };
    current.total += 1;

    if (record.status === "late" || record.status === "absent") {
      current.lateOrAbsent += 1;
    }

    result[record.student_id] = current;
    return result;
  }, {});

  const attentionRows = [...students]
    .map((student) => {
      const riskSummary = attendanceRiskByStudent[student.student_id] || { total: 0, lateOrAbsent: 0 };

      return {
        student_id: student.student_id,
        full_name: student.full_name,
        missingFaceCount: countFaceSetMissing(student),
        missingFacePoses: student.missing_face_poses || [],
        pendingFallbacks: pendingFallbackByStudent[student.student_id] || 0,
        pendingLeave: pendingLeaveByStudent[student.student_id] || 0,
        lateOrAbsent: riskSummary.lateOrAbsent,
        totalAttendanceRecords: riskSummary.total,
      };
    })
    .sort((leftStudent, rightStudent) => {
      return (
        rightStudent.pendingFallbacks - leftStudent.pendingFallbacks ||
        rightStudent.missingFaceCount - leftStudent.missingFaceCount ||
        rightStudent.pendingLeave - leftStudent.pendingLeave ||
        rightStudent.lateOrAbsent - leftStudent.lateOrAbsent ||
        leftStudent.full_name.localeCompare(rightStudent.full_name)
      );
    })
    .slice(0, 8);

  const recentPendingFallbacks = fallbackRequests
    .filter((request) => request.status === "pending")
    .slice(0, 6);
  const recentPendingLeave = leaveRequests
    .filter((request) => request.status === "pending")
    .slice(0, 6);

  return (
    <AdminShell
      adminSession={adminSession}
      pageLabel="Admin Dashboard"
      title="Operations Dashboard"
      subtitle="Track enrollment quality, today's attendance activity, and the review queue from one place."
    >
      <PageCard>
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <SectionIntro
            eyebrow="Overview"
            title="Current operational snapshot"
            description="These numbers combine student enrollment, attendance activity, leave requests, and fallback review work."
          />

          <Button
            type="button"
            variant="outline"
            size="lg"
            className="rounded-full"
            onClick={refreshDashboard}
          >
            <RefreshCcw className={`size-4 ${loadingDashboard ? "animate-spin" : ""}`} />
            {loadingDashboard ? "Refreshing..." : "Refresh Dashboard"}
          </Button>
        </div>

        {dashboardMessage ? (
          <MessageBanner type={dashboardMessage.type} className="mt-5">
            {dashboardMessage.message}
          </MessageBanner>
        ) : null}

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          <StatCard label="Students" value={students.length} />
          <StatCard
            label="Complete face sets"
            value={`${completeFaceSetCount}/${students.length || 0}`}
            helper={formatPercent(faceEnrollmentRate)}
            accentClass="border-sky-200/80 bg-sky-50/80 text-slate-900"
          />
          <StatCard
            label="Today's check-ins"
            value={confirmedTodayCount}
            helper={formatPercent(todayCheckedInRate)}
            accentClass="border-emerald-200/80 bg-emerald-50/80 text-slate-900"
          />
          <StatCard
            label="Pending leave"
            value={pendingLeaveCount}
            accentClass="border-amber-200/80 bg-amber-50/80 text-slate-900"
          />
          <StatCard
            label="Pending fallback"
            value={pendingFallbackCount}
            accentClass="border-rose-200/80 bg-rose-50/80 text-slate-900"
          />
          <StatCard
            label="Attendance records"
            value={attendance.length}
            accentClass="border-slate-200/80 bg-white text-slate-900"
          />
        </div>
      </PageCard>

      <div className="grid gap-6 xl:grid-cols-[1.1fr,0.9fr]">
        <PageCard>
          <SectionIntro
            eyebrow="Quick Actions"
            title="Move directly into the active work"
            description="Use these shortcuts to jump to the parts of the admin workspace you are most likely to need next."
          />

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {QUICK_ACTIONS.map((action) => {
              const Icon = action.icon;

              return (
                <div
                  key={action.href}
                  className="rounded-[1.5rem] border border-slate-200 bg-slate-50/70 p-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                        <Icon className="size-5" />
                      </div>
                      <p className="mt-4 text-lg font-semibold text-slate-900">{action.label}</p>
                      <p className="mt-2 text-sm leading-6 text-slate-600">{action.description}</p>
                    </div>
                  </div>

                  <Link
                    href={action.href}
                    className={`${buttonVariants({ variant: "outline" })} mt-4 rounded-full`}
                  >
                    Open
                    <ArrowRight className="size-4" />
                  </Link>
                </div>
              );
            })}
          </div>
        </PageCard>

        <PageCard>
          <SectionIntro
            eyebrow="Review Queue"
            title="Pending requests needing admin action"
            description="Fallback attendance requests and leave submissions waiting on a decision."
          />

          <div className="mt-6 space-y-5">
            <div>
              <p className="text-sm font-semibold text-slate-900">Pending fallback attendance</p>
              <div className="mt-3 space-y-3">
                {recentPendingFallbacks.length === 0 ? (
                  <p className="text-sm text-slate-500">No pending fallback attendance requests.</p>
                ) : (
                  recentPendingFallbacks.map((request) => (
                    <div
                      key={request.id}
                      className="rounded-[1.25rem] border border-slate-200 bg-slate-50/70 p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium text-slate-900">{request.student_name}</p>
                          <p className="text-xs text-slate-500">
                            {request.student_id} • {formatDate(request.attendance_date)}
                          </p>
                        </div>
                        <StatusPill status={request.status} />
                      </div>
                      <p className="mt-2 text-sm text-slate-600">{request.reason}</p>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div>
              <p className="text-sm font-semibold text-slate-900">Pending leave requests</p>
              <div className="mt-3 space-y-3">
                {recentPendingLeave.length === 0 ? (
                  <p className="text-sm text-slate-500">No pending leave requests.</p>
                ) : (
                  recentPendingLeave.map((request) => (
                    <div
                      key={request.id}
                      className="rounded-[1.25rem] border border-slate-200 bg-slate-50/70 p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium text-slate-900">{request.student_name}</p>
                          <p className="text-xs text-slate-500">
                            {request.student_id} • {formatDate(request.start_date)} to {formatDate(request.end_date)}
                          </p>
                        </div>
                        <StatusPill status={request.status} />
                      </div>
                      <p className="mt-2 text-sm text-slate-600">{request.reason}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </PageCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr,1fr]">
        <PageCard className="overflow-hidden p-0">
          <div className="border-b border-slate-200 px-6 py-6">
            <SectionIntro
              eyebrow="Attendance Trend"
              title="Last seven days"
              description="Unique student check-ins and recorded attendance activity across the last seven local days."
            />
          </div>

          <Table className="min-w-[44rem]">
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead className="px-6">Date</TableHead>
                <TableHead className="px-6">Unique students</TableHead>
                <TableHead className="px-6">Present</TableHead>
                <TableHead className="px-6">Late</TableHead>
                <TableHead className="px-6">Excused</TableHead>
                <TableHead className="px-6">Check-in rate</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {trendRows.map((row) => (
                <TableRow key={row.date}>
                  <TableCell className="px-6">{formatDate(row.date)}</TableCell>
                  <TableCell className="px-6">{row.uniqueStudents}</TableCell>
                  <TableCell className="px-6">{row.present}</TableCell>
                  <TableCell className="px-6">{row.late}</TableCell>
                  <TableCell className="px-6">{row.excused}</TableCell>
                  <TableCell className="px-6">{formatPercent(row.rate)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </PageCard>

        <PageCard className="overflow-hidden p-0">
          <div className="border-b border-slate-200 px-6 py-6">
            <SectionIntro
              eyebrow="Attention List"
              title="Students needing follow-up"
              description="Priority ordering based on pending fallback requests, missing face poses, pending leave, and repeated late/absent records."
            />
          </div>

          <Table className="min-w-[52rem]">
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead className="px-6">Student</TableHead>
                <TableHead className="px-6">Face Set</TableHead>
                <TableHead className="px-6">Pending Fallback</TableHead>
                <TableHead className="px-6">Pending Leave</TableHead>
                <TableHead className="px-6">Late/Absent</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {attentionRows.length === 0 ? (
                <TableRow>
                  <TableCell className="px-6 py-8 text-slate-500" colSpan="5">
                    No students need follow-up right now.
                  </TableCell>
                </TableRow>
              ) : (
                attentionRows.map((row) => (
                  <TableRow key={row.student_id}>
                    <TableCell className="px-6">
                      <div>
                        <p className="font-medium text-slate-900">{row.full_name}</p>
                        <p className="text-xs text-slate-500">ID {row.student_id}</p>
                      </div>
                    </TableCell>
                    <TableCell className="px-6">
                      {row.missingFaceCount === 0
                        ? "Complete"
                        : `Missing ${row.missingFacePoses.join(", ")}`}
                    </TableCell>
                    <TableCell className="px-6">{row.pendingFallbacks}</TableCell>
                    <TableCell className="px-6">{row.pendingLeave}</TableCell>
                    <TableCell className="px-6">
                      {row.lateOrAbsent}/{row.totalAttendanceRecords}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </PageCard>
      </div>
    </AdminShell>
  );
}
