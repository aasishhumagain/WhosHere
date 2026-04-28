"use client";

import { Download, RefreshCcw } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import AdminShell from "../_components/AdminShell";
import {
  ADMIN_FIELD_CLASSNAME,
  AdminLoadingScreen,
  MessageBanner,
  NativeSelect,
  PageCard,
  SectionIntro,
  StatCard,
  StatusPill,
} from "../_components/AdminUI";
import {
  createFilterState,
  deleteAttendanceRecord,
  exportAttendanceCsv,
  fetchAttendance,
  fetchStudents,
  formatDate,
  formatDateTime,
  formatPercent,
  getAttendancePresetDates,
  isAdminAuthError,
  parseDateInputValue,
  redirectAdminToLogin,
  toDateInputValue,
  updateAttendanceRecord,
  useAdminSessionGuard,
} from "../_lib/admin-portal";

export default function AdminAttendancePage() {
  const router = useRouter();
  const { sessionReady, adminSession } = useAdminSessionGuard(router);

  const [students, setStudents] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [attendanceFilters, setAttendanceFilters] = useState(createFilterState());
  const [attendanceMessage, setAttendanceMessage] = useState(null);
  const [loadingAttendance, setLoadingAttendance] = useState(true);
  const [updatingAttendanceId, setUpdatingAttendanceId] = useState(null);
  const [deletingAttendanceId, setDeletingAttendanceId] = useState(null);
  const [isExportingAttendance, setIsExportingAttendance] = useState(false);
  const [attendanceDrafts, setAttendanceDrafts] = useState({});

  async function refreshAttendancePage() {
    if (!adminSession.token) {
      return;
    }

    setLoadingAttendance(true);
    setAttendanceMessage(null);

    try {
      const [studentRecords, attendanceRecords] = await Promise.all([
        fetchStudents(adminSession.token),
        fetchAttendance(adminSession.token),
      ]);

      setStudents(studentRecords);
      setAttendance(attendanceRecords);
    } catch (error) {
      if (isAdminAuthError(error)) {
        redirectAdminToLogin(router);
        return;
      }

      setAttendanceMessage({
        type: "error",
        message: error.message || "Could not load attendance.",
      });
    } finally {
      setLoadingAttendance(false);
    }
  }

  useEffect(() => {
    if (!sessionReady || !adminSession.token) {
      return;
    }

    let isActive = true;

    async function loadInitialAttendancePage() {
      try {
        const [studentRecords, attendanceRecords] = await Promise.all([
          fetchStudents(adminSession.token),
          fetchAttendance(adminSession.token),
        ]);

        if (!isActive) {
          return;
        }

        setStudents(studentRecords);
        setAttendance(attendanceRecords);
      } catch (error) {
        if (!isActive) {
          return;
        }

        if (isAdminAuthError(error)) {
          redirectAdminToLogin(router);
          return;
        }

        setAttendanceMessage({
          type: "error",
          message: error.message || "Could not load attendance.",
        });
      } finally {
        if (isActive) {
          setLoadingAttendance(false);
        }
      }
    }

    loadInitialAttendancePage();

    return () => {
      isActive = false;
    };
  }, [adminSession.token, router, sessionReady]);

  async function handleUpdateAttendance(record) {
    const nextStatus = attendanceDrafts[record.id] || record.status;
    setUpdatingAttendanceId(record.id);
    setAttendanceMessage(null);

    try {
      const response = await updateAttendanceRecord(
        adminSession.token,
        record.id,
        nextStatus,
      );

      const refreshedAttendance = await fetchAttendance(adminSession.token);
      setAttendance(refreshedAttendance);
      setAttendanceMessage({
        type: "success",
        message: response.message || "Attendance updated successfully.",
      });
    } catch (error) {
      if (isAdminAuthError(error)) {
        redirectAdminToLogin(router);
        return;
      }

      setAttendanceMessage({
        type: "error",
        message: error.message || "Could not update the attendance record.",
      });
    } finally {
      setUpdatingAttendanceId(null);
    }
  }

  async function handleDeleteAttendance(record) {
    const confirmed = window.confirm(
      `Delete the attendance entry for ${record.student_name} marked on ${formatDateTime(record.marked_at)}?`,
    );

    if (!confirmed) {
      return;
    }

    setDeletingAttendanceId(record.id);
    setAttendanceMessage(null);

    try {
      const response = await deleteAttendanceRecord(adminSession.token, record.id);
      const refreshedAttendance = await fetchAttendance(adminSession.token);
      setAttendance(refreshedAttendance);
      setAttendanceMessage({
        type: "success",
        message: response.message || "Attendance deleted successfully.",
      });
    } catch (error) {
      if (isAdminAuthError(error)) {
        redirectAdminToLogin(router);
        return;
      }

      setAttendanceMessage({
        type: "error",
        message: error.message || "Could not delete the attendance record.",
      });
    } finally {
      setDeletingAttendanceId(null);
    }
  }

  async function handleExportAttendance() {
    setIsExportingAttendance(true);
    setAttendanceMessage(null);

    try {
      const result = await exportAttendanceCsv(adminSession.token, {
        ...attendanceFilters,
        dateFrom: normalizedDateFrom,
        dateTo: normalizedDateTo,
      });

      const downloadUrl = window.URL.createObjectURL(result.blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = result.fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);

      setAttendanceMessage({
        type: "success",
        message: "Attendance CSV exported successfully.",
      });
    } catch (error) {
      if (isAdminAuthError(error)) {
        redirectAdminToLogin(router);
        return;
      }

      setAttendanceMessage({
        type: "error",
        message: error.message || "Could not export the attendance report.",
      });
    } finally {
      setIsExportingAttendance(false);
    }
  }

  function applyAttendancePreset(preset) {
    const presetDates = getAttendancePresetDates(preset);

    setAttendanceFilters((current) => ({
      ...current,
      ...presetDates,
      preset,
    }));
  }

  function clearAttendanceFilters() {
    setAttendanceFilters(createFilterState());
  }

  if (!sessionReady || !adminSession.token) {
    return <AdminLoadingScreen />;
  }

  const parsedDateFrom = parseDateInputValue(attendanceFilters.dateFrom);
  const parsedDateTo = parseDateInputValue(attendanceFilters.dateTo);
  const normalizedDateFrom =
    parsedDateFrom && parsedDateTo && parsedDateFrom > parsedDateTo
      ? attendanceFilters.dateTo
      : attendanceFilters.dateFrom;
  const normalizedDateTo =
    parsedDateFrom && parsedDateTo && parsedDateFrom > parsedDateTo
      ? attendanceFilters.dateFrom
      : attendanceFilters.dateTo;

  const filteredAttendance = attendance.filter((record) => {
    const matchesSearch = `${record.student_name} ${record.student_id} ${record.status}`
      .toLowerCase()
      .includes(attendanceFilters.search.toLowerCase());
    const matchesStatus =
      attendanceFilters.status === "all" || record.status === attendanceFilters.status;
    const matchesStudent =
      attendanceFilters.studentId === "all" ||
      String(record.student_id) === attendanceFilters.studentId;
    const recordDate = toDateInputValue(record.marked_at);
    const matchesDateFrom = !normalizedDateFrom || recordDate >= normalizedDateFrom;
    const matchesDateTo = !normalizedDateTo || recordDate <= normalizedDateTo;

    return matchesSearch && matchesStatus && matchesStudent && matchesDateFrom && matchesDateTo;
  });

  const [attendanceSortBy, attendanceSortDirection] = attendanceFilters.sortOrder.split(":");
  const sortedAttendance = [...filteredAttendance].sort((leftRecord, rightRecord) => {
    let leftValue;
    let rightValue;

    if (attendanceSortBy === "student_name") {
      leftValue = leftRecord.student_name;
      rightValue = rightRecord.student_name;
    } else if (attendanceSortBy === "status") {
      leftValue = leftRecord.status;
      rightValue = rightRecord.status;
    } else if (attendanceSortBy === "student_id") {
      leftValue = leftRecord.student_id;
      rightValue = rightRecord.student_id;
    } else {
      leftValue = new Date(leftRecord.marked_at).getTime();
      rightValue = new Date(rightRecord.marked_at).getTime();
    }

    if (typeof leftValue === "string" || typeof rightValue === "string") {
      leftValue = String(leftValue || "").toLowerCase();
      rightValue = String(rightValue || "").toLowerCase();
    }

    if (leftValue < rightValue) {
      return attendanceSortDirection === "asc" ? -1 : 1;
    }

    if (leftValue > rightValue) {
      return attendanceSortDirection === "asc" ? 1 : -1;
    }

    return 0;
  });

  const attendanceStatusSummary = {
    present: 0,
    late: 0,
    absent: 0,
    excused: 0,
  };
  const attendanceStudentReportMap = new Map();
  const attendanceDailyReportMap = new Map();

  filteredAttendance.forEach((record) => {
    attendanceStatusSummary[record.status] =
      (attendanceStatusSummary[record.status] || 0) + 1;

    const reportDateKey = toDateInputValue(record.marked_at);
    const dailyEntry = attendanceDailyReportMap.get(reportDateKey) || {
      date: reportDateKey,
      total: 0,
      present: 0,
      late: 0,
      absent: 0,
      excused: 0,
    };
    dailyEntry.total += 1;
    dailyEntry[record.status] = (dailyEntry[record.status] || 0) + 1;
    attendanceDailyReportMap.set(reportDateKey, dailyEntry);

    const studentEntry = attendanceStudentReportMap.get(record.student_id) || {
      student_id: record.student_id,
      student_name: record.student_name,
      total: 0,
      present: 0,
      late: 0,
      absent: 0,
      excused: 0,
      latest_marked_at: "",
    };
    studentEntry.total += 1;
    studentEntry[record.status] = (studentEntry[record.status] || 0) + 1;

    if (!studentEntry.latest_marked_at || record.marked_at > studentEntry.latest_marked_at) {
      studentEntry.latest_marked_at = record.marked_at;
    }

    attendanceStudentReportMap.set(record.student_id, studentEntry);
  });

  const attendanceUniqueStudents = attendanceStudentReportMap.size;
  const attendanceCoveredCount =
    attendanceStatusSummary.present +
    attendanceStatusSummary.late +
    attendanceStatusSummary.excused;
  const attendanceCoverageRate = filteredAttendance.length
    ? (attendanceCoveredCount / filteredAttendance.length) * 100
    : 0;
  const attendanceStudentReportRows = Array.from(attendanceStudentReportMap.values()).sort(
    (leftRow, rightRow) =>
      rightRow.total - leftRow.total ||
      leftRow.student_name.localeCompare(rightRow.student_name),
  );
  const attendanceDailyReportRows = Array.from(attendanceDailyReportMap.values()).sort(
    (leftRow, rightRow) => rightRow.date.localeCompare(leftRow.date),
  );
  const attendancePresetOptions = [
    { label: "Today", value: "today" },
    { label: "Last 7 Days", value: "last7" },
    { label: "Last 30 Days", value: "last30" },
    { label: "This Month", value: "thisMonth" },
  ];

  return (
    <AdminShell
      adminSession={adminSession}
      pageLabel="Attendance Control"
      title="Attendance Control"
      subtitle="Search attendance records, fix mistakes, and export the list from this page."
    >
      <PageCard>
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <SectionIntro
            eyebrow="Attendance Filters"
            title="Search, sort, and correct attendance"
            description="Use these filters to find the records you need, then edit or export them."
          />

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
            <Input
              type="text"
              placeholder="Search attendance..."
              value={attendanceFilters.search}
              onChange={(event) =>
                setAttendanceFilters((current) => ({
                  ...current,
                  search: event.target.value,
                }))
              }
              className={ADMIN_FIELD_CLASSNAME}
            />

            <NativeSelect
              value={attendanceFilters.status}
              onChange={(event) =>
                setAttendanceFilters((current) => ({
                  ...current,
                  status: event.target.value,
                }))
              }
            >
              <option value="all">All Statuses</option>
              <option value="present">Present</option>
              <option value="late">Late</option>
              <option value="absent">Absent</option>
              <option value="excused">Excused</option>
            </NativeSelect>

            <NativeSelect
              value={attendanceFilters.studentId}
              onChange={(event) =>
                setAttendanceFilters((current) => ({
                  ...current,
                  studentId: event.target.value,
                }))
              }
            >
              <option value="all">All Students</option>
              {students.map((student) => (
                <option key={student.student_id} value={String(student.student_id)}>
                  #{student.student_id} {student.full_name}
                </option>
              ))}
            </NativeSelect>

            <Input
              type="date"
              value={attendanceFilters.dateFrom}
              onChange={(event) =>
                setAttendanceFilters((current) => ({
                  ...current,
                  dateFrom: event.target.value,
                  preset: "custom",
                }))
              }
              className={ADMIN_FIELD_CLASSNAME}
            />

            <Input
              type="date"
              value={attendanceFilters.dateTo}
              min={attendanceFilters.dateFrom || undefined}
              onChange={(event) =>
                setAttendanceFilters((current) => ({
                  ...current,
                  dateTo: event.target.value,
                  preset: "custom",
                }))
              }
              className={ADMIN_FIELD_CLASSNAME}
            />

            <NativeSelect
              value={attendanceFilters.sortOrder}
              onChange={(event) =>
                setAttendanceFilters((current) => ({
                  ...current,
                  sortOrder: event.target.value,
                }))
              }
            >
              <option value="marked_at:desc">Latest First</option>
              <option value="marked_at:asc">Oldest First</option>
              <option value="student_name:asc">Student A-Z</option>
              <option value="student_name:desc">Student Z-A</option>
              <option value="status:asc">Status A-Z</option>
              <option value="status:desc">Status Z-A</option>
              <option value="student_id:asc">Student ID Ascending</option>
              <option value="student_id:desc">Student ID Descending</option>
            </NativeSelect>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            {attendancePresetOptions.map((option) => (
              <Button
                key={option.value}
                type="button"
                size="sm"
                variant={attendanceFilters.preset === option.value ? "default" : "outline"}
                className={
                  attendanceFilters.preset === option.value
                    ? "rounded-full bg-amber-500 hover:bg-amber-600"
                    : "rounded-full border-amber-200 text-amber-700 hover:bg-amber-50"
                }
                onClick={() => applyAttendancePreset(option.value)}
              >
                {option.label}
              </Button>
            ))}

            <Button
              type="button"
              size="sm"
              variant="outline"
              className="rounded-full"
              onClick={clearAttendanceFilters}
            >
              Clear Filters
            </Button>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="rounded-full"
              onClick={refreshAttendancePage}
            >
              <RefreshCcw className={`size-4 ${loadingAttendance ? "animate-spin" : ""}`} />
              {loadingAttendance ? "Refreshing..." : "Refresh"}
            </Button>
            <Button
              type="button"
              size="lg"
              className="rounded-full bg-amber-500 hover:bg-amber-600"
              onClick={handleExportAttendance}
              disabled={isExportingAttendance}
            >
              <Download className="size-4" />
              {isExportingAttendance ? "Exporting CSV..." : "Export CSV"}
            </Button>
          </div>
        </div>

        {attendanceMessage ? (
          <MessageBanner type={attendanceMessage.type} className="mt-5">
            {attendanceMessage.message}
          </MessageBanner>
        ) : null}

        <div className="mt-4 text-sm text-slate-600">
          Showing <span className="font-semibold text-slate-900">{sortedAttendance.length}</span>{" "}
          of <span className="font-semibold text-slate-900">{attendance.length}</span> attendance entries.
        </div>
      </PageCard>

      <PageCard>
        <SectionIntro
          eyebrow="Attendance Report"
          title="Summary for the current filters"
          description="These totals change with your filters, so you can quickly review the records before exporting them."
        />

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          <StatCard label="Filtered records" value={filteredAttendance.length} accentClass="border-amber-200/80 bg-amber-50/80 text-slate-900 dark:border-amber-200/80 dark:bg-amber-50/80 dark:text-slate-50" />
          <StatCard label="Unique students" value={attendanceUniqueStudents} accentClass="border-slate-200/80 bg-white text-slate-900 dark:border-white/12 dark:bg-slate-950/76 dark:text-slate-50" />
          <StatCard label="Present" value={attendanceStatusSummary.present} accentClass="border-emerald-200/80 bg-emerald-50/80 text-slate-900 dark:border-emerald-200/80 dark:bg-emerald-50/80 dark:text-slate-50" />
          <StatCard label="Late" value={attendanceStatusSummary.late} accentClass="border-amber-200/80 bg-amber-50/80 text-slate-900 dark:border-amber-200/80 dark:bg-amber-50/80 dark:text-slate-50" />
          <StatCard label="Absent" value={attendanceStatusSummary.absent} accentClass="border-rose-200/80 bg-rose-50/80 text-slate-900 dark:border-rose-200/80 dark:bg-rose-50/80 dark:text-slate-50" />
          <StatCard label="Coverage rate" value={formatPercent(attendanceCoverageRate)} accentClass="border-sky-200/80 bg-sky-50/80 text-slate-900 dark:border-sky-200/80 dark:bg-sky-50/80 dark:text-slate-50" />
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-2">
          <Card className="rounded-[1.75rem] border-border/80 bg-slate-50/50 shadow-none dark:border-white/10 dark:bg-slate-950/72">
            <CardHeader className="gap-2">
              <CardTitle className="text-lg">Daily Breakdown</CardTitle>
              <CardDescription>Attendance totals grouped by marked date.</CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="overflow-hidden rounded-[1.25rem] border border-slate-200">
                <Table className="min-w-[32rem]">
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Present</TableHead>
                      <TableHead>Late</TableHead>
                      <TableHead>Absent</TableHead>
                      <TableHead>Excused</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {attendanceDailyReportRows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan="6" className="h-20 text-slate-500">
                          No attendance records are available for this report.
                        </TableCell>
                      </TableRow>
                    ) : (
                      attendanceDailyReportRows.map((row) => (
                        <TableRow key={row.date}>
                          <TableCell>{formatDate(row.date)}</TableCell>
                          <TableCell>{row.total}</TableCell>
                          <TableCell>{row.present}</TableCell>
                          <TableCell>{row.late}</TableCell>
                          <TableCell>{row.absent}</TableCell>
                          <TableCell>{row.excused}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[1.75rem] border-border/80 bg-slate-50/50 shadow-none dark:border-white/10 dark:bg-slate-950/72">
            <CardHeader className="gap-2">
              <CardTitle className="text-lg">Student Breakdown</CardTitle>
              <CardDescription>Per-student attendance totals for the current report.</CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="overflow-hidden rounded-[1.25rem] border border-slate-200">
                <Table className="min-w-[42rem]">
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead>Student</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Present</TableHead>
                      <TableHead>Late</TableHead>
                      <TableHead>Absent</TableHead>
                      <TableHead>Excused</TableHead>
                      <TableHead>Last Marked</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {attendanceStudentReportRows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan="7" className="h-20 text-slate-500">
                          No student attendance data is available for this report.
                        </TableCell>
                      </TableRow>
                    ) : (
                      attendanceStudentReportRows.map((row) => (
                        <TableRow key={row.student_id}>
                          <TableCell>
                            <div>
                              <p className="font-medium text-slate-900">{row.student_name}</p>
                              <p className="text-xs text-slate-500">ID #{row.student_id}</p>
                            </div>
                          </TableCell>
                          <TableCell>{row.total}</TableCell>
                          <TableCell>{row.present}</TableCell>
                          <TableCell>{row.late}</TableCell>
                          <TableCell>{row.absent}</TableCell>
                          <TableCell>{row.excused}</TableCell>
                          <TableCell>{formatDateTime(row.latest_marked_at)}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      </PageCard>

      <PageCard className="overflow-hidden p-0">
        <Table className="min-w-[78rem]">
          <TableHeader className="bg-slate-50">
            <TableRow>
              <TableHead className="px-6">Student</TableHead>
              <TableHead className="px-6">ID</TableHead>
              <TableHead className="px-6">Current Status</TableHead>
              <TableHead className="px-6">Marked At</TableHead>
              <TableHead className="px-6">Edit Status</TableHead>
              <TableHead className="px-6 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedAttendance.length === 0 ? (
              <TableRow>
                <TableCell className="px-6 py-8 text-slate-500" colSpan="6">
                  No attendance records matched the selected filters.
                </TableCell>
              </TableRow>
            ) : (
              sortedAttendance.map((record) => (
                <TableRow key={record.id}>
                  <TableCell className="px-6">{record.student_name}</TableCell>
                  <TableCell className="px-6">{record.student_id}</TableCell>
                  <TableCell className="px-6">
                    <StatusPill status={record.status} />
                  </TableCell>
                  <TableCell className="px-6">{formatDateTime(record.marked_at)}</TableCell>
                  <TableCell className="px-6">
                    <NativeSelect
                      value={attendanceDrafts[record.id] || record.status}
                      onChange={(event) =>
                        setAttendanceDrafts((current) => ({
                          ...current,
                          [record.id]: event.target.value,
                        }))
                      }
                      className="h-10 rounded-xl bg-white px-3 py-2 dark:bg-slate-950/78"
                    >
                      <option value="present">Present</option>
                      <option value="late">Late</option>
                      <option value="absent">Absent</option>
                      <option value="excused">Excused</option>
                    </NativeSelect>
                  </TableCell>
                  <TableCell className="px-6">
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        size="sm"
                        className="rounded-full bg-amber-500 hover:bg-amber-600"
                        onClick={() => handleUpdateAttendance(record)}
                        disabled={updatingAttendanceId === record.id}
                      >
                        {updatingAttendanceId === record.id ? "Saving..." : "Save"}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        className="rounded-full"
                        onClick={() => handleDeleteAttendance(record)}
                        disabled={deletingAttendanceId === record.id}
                      >
                        {deletingAttendanceId === record.id ? "Deleting..." : "Delete"}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </PageCard>
    </AdminShell>
  );
}
