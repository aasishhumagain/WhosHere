"use client";

import { RefreshCcw } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
} from "../_components/AdminUI";
import {
  capitalizeWords,
  createAuditLogFilterState,
  fetchAuditLogs,
  formatDateTime,
  getAttendancePresetDates,
  isAdminAuthError,
  parseDateInputValue,
  redirectAdminToLogin,
  toDateInputValue,
  useAdminSessionGuard,
} from "../_lib/admin-portal";

function getActorBadgeClass(actorType) {
  if (actorType === "admin") {
    return "border-blue-200 bg-blue-50 text-blue-700";
  }

  if (actorType === "student") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  return "border-slate-200 bg-slate-50 text-slate-700";
}

function buildAuditTargetLabel(auditLog) {
  if (auditLog.target_label) {
    return auditLog.target_label;
  }

  if (auditLog.target_type) {
    return capitalizeWords(auditLog.target_type);
  }

  return "System";
}

export default function AdminLogsPage() {
  const router = useRouter();
  const { sessionReady, adminSession } = useAdminSessionGuard(router);

  const [auditLogs, setAuditLogs] = useState([]);
  const [auditFilters, setAuditFilters] = useState(createAuditLogFilterState());
  const [auditMessage, setAuditMessage] = useState(null);
  const [loadingLogs, setLoadingLogs] = useState(true);

  async function refreshAuditLogs() {
    if (!adminSession.token) {
      return;
    }

    setLoadingLogs(true);
    setAuditMessage(null);

    try {
      const nextAuditLogs = await fetchAuditLogs(adminSession.token);
      setAuditLogs(nextAuditLogs);
    } catch (error) {
      if (isAdminAuthError(error)) {
        redirectAdminToLogin(router);
        return;
      }

      setAuditMessage({
        type: "error",
        message: error.message || "Could not load audit logs.",
      });
    } finally {
      setLoadingLogs(false);
    }
  }

  useEffect(() => {
    if (!sessionReady || !adminSession.token) {
      return;
    }

    let isActive = true;

    async function loadInitialAuditLogs() {
      try {
        const nextAuditLogs = await fetchAuditLogs(adminSession.token);

        if (!isActive) {
          return;
        }

        setAuditLogs(nextAuditLogs);
      } catch (error) {
        if (!isActive) {
          return;
        }

        if (isAdminAuthError(error)) {
          redirectAdminToLogin(router);
          return;
        }

        setAuditMessage({
          type: "error",
          message: error.message || "Could not load audit logs.",
        });
      } finally {
        if (isActive) {
          setLoadingLogs(false);
        }
      }
    }

    loadInitialAuditLogs();

    return () => {
      isActive = false;
    };
  }, [adminSession.token, router, sessionReady]);

  function applyAuditPreset(preset) {
    const presetDates = getAttendancePresetDates(preset);

    setAuditFilters((current) => ({
      ...current,
      ...presetDates,
      preset,
    }));
  }

  function clearAuditFilters() {
    setAuditFilters(createAuditLogFilterState());
  }

  if (!sessionReady || !adminSession.token) {
    return <AdminLoadingScreen title="Loading audit logs..." description="Preparing login, attendance, student, and leave activity history." />;
  }

  const parsedDateFrom = parseDateInputValue(auditFilters.dateFrom);
  const parsedDateTo = parseDateInputValue(auditFilters.dateTo);
  const normalizedDateFrom =
    parsedDateFrom && parsedDateTo && parsedDateFrom > parsedDateTo
      ? auditFilters.dateTo
      : auditFilters.dateFrom;
  const normalizedDateTo =
    parsedDateFrom && parsedDateTo && parsedDateFrom > parsedDateTo
      ? auditFilters.dateFrom
      : auditFilters.dateTo;

  const filteredAuditLogs = auditLogs.filter((auditLog) => {
    const haystack = [
      auditLog.actor_type,
      auditLog.actor_label,
      auditLog.action,
      auditLog.target_type,
      auditLog.target_id,
      auditLog.target_label,
      auditLog.details,
    ]
      .join(" ")
      .toLowerCase();
    const matchesSearch = haystack.includes(auditFilters.search.toLowerCase());
    const matchesActorType =
      auditFilters.actorType === "all" || auditLog.actor_type === auditFilters.actorType;
    const matchesAction =
      auditFilters.action === "all" || auditLog.action === auditFilters.action;
    const logDate = toDateInputValue(auditLog.created_at);
    const matchesDateFrom = !normalizedDateFrom || logDate >= normalizedDateFrom;
    const matchesDateTo = !normalizedDateTo || logDate <= normalizedDateTo;

    return matchesSearch && matchesActorType && matchesAction && matchesDateFrom && matchesDateTo;
  });

  const [auditSortBy, auditSortDirection] = auditFilters.sortOrder.split(":");
  const sortedAuditLogs = [...filteredAuditLogs].sort((leftLog, rightLog) => {
    let leftValue;
    let rightValue;

    if (auditSortBy === "actor_label") {
      leftValue = leftLog.actor_label;
      rightValue = rightLog.actor_label;
    } else if (auditSortBy === "action") {
      leftValue = leftLog.action;
      rightValue = rightLog.action;
    } else if (auditSortBy === "target_label") {
      leftValue = buildAuditTargetLabel(leftLog);
      rightValue = buildAuditTargetLabel(rightLog);
    } else {
      leftValue = new Date(leftLog.created_at).getTime();
      rightValue = new Date(rightLog.created_at).getTime();
    }

    if (typeof leftValue === "string" || typeof rightValue === "string") {
      leftValue = String(leftValue || "").toLowerCase();
      rightValue = String(rightValue || "").toLowerCase();
    }

    if (leftValue < rightValue) {
      return auditSortDirection === "asc" ? -1 : 1;
    }

    if (leftValue > rightValue) {
      return auditSortDirection === "asc" ? 1 : -1;
    }

    return 0;
  });

  const todayKey = toDateInputValue(new Date());
  const adminCount = filteredAuditLogs.filter((auditLog) => auditLog.actor_type === "admin").length;
  const studentCount = filteredAuditLogs.filter((auditLog) => auditLog.actor_type === "student").length;
  const todayCount = filteredAuditLogs.filter(
    (auditLog) => toDateInputValue(auditLog.created_at) === todayKey,
  ).length;
  const uniqueActorCount = new Set(
    filteredAuditLogs.map((auditLog) => `${auditLog.actor_type}:${auditLog.actor_id ?? auditLog.actor_label}`),
  ).size;
  const actionOptions = Array.from(
    new Set(auditLogs.map((auditLog) => auditLog.action).filter(Boolean)),
  ).sort((leftAction, rightAction) => leftAction.localeCompare(rightAction));
  const auditPresetOptions = [
    { label: "Today", value: "today" },
    { label: "Last 7 Days", value: "last7" },
    { label: "Last 30 Days", value: "last30" },
    { label: "This Month", value: "thisMonth" },
  ];

  return (
    <AdminShell
      adminSession={adminSession}
      pageLabel="Audit Logs"
      title="Audit Logs"
      subtitle="Review the system-wide activity trail for admins and students, including logins, logouts, account changes, attendance actions, and leave workflows."
    >
      <PageCard>
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <SectionIntro
            eyebrow="Log Filters"
            title="Trace activity across the whole system"
            description="Filter by actor type, specific action, date range, or free-text search to inspect the full audit trail without leaving the admin workspace."
          />

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
            <Input
              type="text"
              placeholder="Search logs..."
              value={auditFilters.search}
              onChange={(event) =>
                setAuditFilters((current) => ({
                  ...current,
                  search: event.target.value,
                }))
              }
              className={ADMIN_FIELD_CLASSNAME}
            />

            <NativeSelect
              value={auditFilters.actorType}
              onChange={(event) =>
                setAuditFilters((current) => ({
                  ...current,
                  actorType: event.target.value,
                }))
              }
            >
              <option value="all">All Actors</option>
              <option value="admin">Admins</option>
              <option value="student">Students</option>
              <option value="system">System</option>
            </NativeSelect>

            <NativeSelect
              value={auditFilters.action}
              onChange={(event) =>
                setAuditFilters((current) => ({
                  ...current,
                  action: event.target.value,
                }))
              }
            >
              <option value="all">All Actions</option>
              {actionOptions.map((action) => (
                <option key={action} value={action}>
                  {capitalizeWords(action)}
                </option>
              ))}
            </NativeSelect>

            <Input
              type="date"
              value={auditFilters.dateFrom}
              onChange={(event) =>
                setAuditFilters((current) => ({
                  ...current,
                  dateFrom: event.target.value,
                  preset: "custom",
                }))
              }
              className={ADMIN_FIELD_CLASSNAME}
            />

            <Input
              type="date"
              value={auditFilters.dateTo}
              min={auditFilters.dateFrom || undefined}
              onChange={(event) =>
                setAuditFilters((current) => ({
                  ...current,
                  dateTo: event.target.value,
                  preset: "custom",
                }))
              }
              className={ADMIN_FIELD_CLASSNAME}
            />

            <NativeSelect
              value={auditFilters.sortOrder}
              onChange={(event) =>
                setAuditFilters((current) => ({
                  ...current,
                  sortOrder: event.target.value,
                }))
              }
            >
              <option value="created_at:desc">Latest First</option>
              <option value="created_at:asc">Oldest First</option>
              <option value="actor_label:asc">Actor A-Z</option>
              <option value="actor_label:desc">Actor Z-A</option>
              <option value="action:asc">Action A-Z</option>
              <option value="action:desc">Action Z-A</option>
              <option value="target_label:asc">Target A-Z</option>
              <option value="target_label:desc">Target Z-A</option>
            </NativeSelect>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            {auditPresetOptions.map((option) => (
              <Button
                key={option.value}
                type="button"
                size="sm"
                variant={auditFilters.preset === option.value ? "default" : "outline"}
                className={
                  auditFilters.preset === option.value
                    ? "rounded-full bg-blue-600 hover:bg-blue-700"
                    : "rounded-full border-blue-200 text-blue-700 hover:bg-blue-50"
                }
                onClick={() => applyAuditPreset(option.value)}
              >
                {option.label}
              </Button>
            ))}

            <Button
              type="button"
              size="sm"
              variant="outline"
              className="rounded-full"
              onClick={clearAuditFilters}
            >
              Clear Filters
            </Button>
          </div>

          <Button
            type="button"
            variant="outline"
            size="lg"
            className="rounded-full"
            onClick={refreshAuditLogs}
          >
            <RefreshCcw className={`size-4 ${loadingLogs ? "animate-spin" : ""}`} />
            {loadingLogs ? "Refreshing..." : "Refresh Logs"}
          </Button>
        </div>

        {auditMessage ? (
          <MessageBanner type={auditMessage.type} className="mt-5">
            {auditMessage.message}
          </MessageBanner>
        ) : null}

        <div className="mt-4 text-sm text-slate-600">
          Showing <span className="font-semibold text-slate-900">{sortedAuditLogs.length}</span>{" "}
          of <span className="font-semibold text-slate-900">{auditLogs.length}</span> audit entries.
        </div>
      </PageCard>

      <PageCard>
        <SectionIntro
          eyebrow="Audit Summary"
          title="Quick read on recent system behavior"
          description="These live counts follow the current filters so you can narrow the audit trail and still keep a useful high-level summary."
        />

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <StatCard label="Filtered logs" value={filteredAuditLogs.length} />
          <StatCard label="Admin actions" value={adminCount} accentClass="border-blue-200/80 bg-blue-50/80 text-slate-900" />
          <StatCard label="Student actions" value={studentCount} accentClass="border-emerald-200/80 bg-emerald-50/80 text-slate-900" />
          <StatCard label="Today's logs" value={todayCount} accentClass="border-amber-200/80 bg-amber-50/80 text-slate-900" />
          <StatCard label="Unique actors" value={uniqueActorCount} accentClass="border-slate-200/80 bg-white text-slate-900" />
        </div>
      </PageCard>

      <PageCard className="overflow-hidden p-0">
        <Table className="min-w-[92rem]">
          <TableHeader className="bg-slate-50">
            <TableRow>
              <TableHead className="px-6">Time</TableHead>
              <TableHead className="px-6">Actor Type</TableHead>
              <TableHead className="px-6">Actor</TableHead>
              <TableHead className="px-6">Action</TableHead>
              <TableHead className="px-6">Target</TableHead>
              <TableHead className="px-6">Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedAuditLogs.length === 0 ? (
              <TableRow>
                <TableCell className="px-6 py-8 text-slate-500" colSpan="6">
                  No audit entries matched the selected filters.
                </TableCell>
              </TableRow>
            ) : (
              sortedAuditLogs.map((auditLog) => (
                <TableRow key={auditLog.id}>
                  <TableCell className="px-6 align-top">
                    <div>
                      <p className="font-medium text-slate-900">{formatDateTime(auditLog.created_at)}</p>
                      <p className="text-xs text-slate-500">Log #{auditLog.id}</p>
                    </div>
                  </TableCell>
                  <TableCell className="px-6 align-top">
                    <Badge
                      variant="outline"
                      className={`rounded-full px-3 py-1 ${getActorBadgeClass(auditLog.actor_type)}`}
                    >
                      {capitalizeWords(auditLog.actor_type)}
                    </Badge>
                  </TableCell>
                  <TableCell className="px-6 align-top">
                    <div>
                      <p className="font-medium text-slate-900">{auditLog.actor_label}</p>
                      <p className="text-xs text-slate-500">
                        {auditLog.actor_id ? `Internal ID ${auditLog.actor_id}` : "No internal ID"}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell className="px-6 align-top">
                    <div>
                      <p className="font-medium text-slate-900">{capitalizeWords(auditLog.action)}</p>
                      <p className="text-xs text-slate-500">{auditLog.action}</p>
                    </div>
                  </TableCell>
                  <TableCell className="px-6 align-top">
                    <div>
                      <p className="font-medium text-slate-900">{buildAuditTargetLabel(auditLog)}</p>
                      <p className="text-xs text-slate-500">
                        {auditLog.target_type
                          ? `${capitalizeWords(auditLog.target_type)}${auditLog.target_id ? ` • ${auditLog.target_id}` : ""}`
                          : "No specific target"}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell className="px-6 align-top text-sm leading-6 text-slate-600">
                    {auditLog.details || "No extra details recorded."}
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
