"use client";

import { RefreshCcw } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

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
  StatusPill,
} from "../_components/AdminUI";
import {
  createLeaveFilterState,
  deleteLeaveRequestRecord,
  fetchLeaveRequests,
  formatDate,
  isAdminAuthError,
  redirectAdminToLogin,
  updateLeaveRequest,
  useAdminSessionGuard,
} from "../_lib/admin-portal";

export default function AdminLeaveRequestsPage() {
  const router = useRouter();
  const { sessionReady, adminSession } = useAdminSessionGuard(router);

  const [leaveRequests, setLeaveRequests] = useState([]);
  const [leaveFilters, setLeaveFilters] = useState(createLeaveFilterState());
  const [leaveMessage, setLeaveMessage] = useState(null);
  const [loadingLeaveRequests, setLoadingLeaveRequests] = useState(true);
  const [leaveDrafts, setLeaveDrafts] = useState({});
  const [updatingLeaveId, setUpdatingLeaveId] = useState(null);
  const [deletingLeaveId, setDeletingLeaveId] = useState(null);

  async function refreshLeaveRequests() {
    if (!adminSession.token) {
      return;
    }

    setLoadingLeaveRequests(true);
    setLeaveMessage(null);

    try {
      const records = await fetchLeaveRequests(adminSession.token);
      setLeaveRequests(records);
    } catch (error) {
      if (isAdminAuthError(error)) {
        redirectAdminToLogin(router);
        return;
      }

      setLeaveMessage({
        type: "error",
        message: error.message || "Could not load leave requests.",
      });
    } finally {
      setLoadingLeaveRequests(false);
    }
  }

  useEffect(() => {
    if (!sessionReady || !adminSession.token) {
      return;
    }

    let isActive = true;

    async function loadInitialLeaveRequests() {
      try {
        const records = await fetchLeaveRequests(adminSession.token);

        if (!isActive) {
          return;
        }

        setLeaveRequests(records);
      } catch (error) {
        if (!isActive) {
          return;
        }

        if (isAdminAuthError(error)) {
          redirectAdminToLogin(router);
          return;
        }

        setLeaveMessage({
          type: "error",
          message: error.message || "Could not load leave requests.",
        });
      } finally {
        if (isActive) {
          setLoadingLeaveRequests(false);
        }
      }
    }

    loadInitialLeaveRequests();

    return () => {
      isActive = false;
    };
  }, [adminSession.token, router, sessionReady]);

  async function handleUpdateLeaveRequest(leaveRequest) {
    const nextStatus = leaveDrafts[leaveRequest.id] || leaveRequest.status;
    setUpdatingLeaveId(leaveRequest.id);
    setLeaveMessage(null);

    try {
      const response = await updateLeaveRequest(
        adminSession.token,
        leaveRequest.id,
        nextStatus,
      );

      const refreshedRequests = await fetchLeaveRequests(adminSession.token);
      setLeaveRequests(refreshedRequests);
      setLeaveMessage({
        type: "success",
        message: response.message || "Leave request updated successfully.",
      });
    } catch (error) {
      if (isAdminAuthError(error)) {
        redirectAdminToLogin(router);
        return;
      }

      setLeaveMessage({
        type: "error",
        message: error.message || "Could not update the leave request.",
      });
    } finally {
      setUpdatingLeaveId(null);
    }
  }

  async function handleDeleteLeaveRequest(leaveRequest) {
    const confirmed = window.confirm(
      `Delete the leave request for ${leaveRequest.student_name}?`,
    );

    if (!confirmed) {
      return;
    }

    setDeletingLeaveId(leaveRequest.id);
    setLeaveMessage(null);

    try {
      const response = await deleteLeaveRequestRecord(adminSession.token, leaveRequest.id);
      const refreshedRequests = await fetchLeaveRequests(adminSession.token);
      setLeaveRequests(refreshedRequests);
      setLeaveMessage({
        type: "success",
        message: response.message || "Leave request deleted successfully.",
      });
    } catch (error) {
      if (isAdminAuthError(error)) {
        redirectAdminToLogin(router);
        return;
      }

      setLeaveMessage({
        type: "error",
        message: error.message || "Could not delete the leave request.",
      });
    } finally {
      setDeletingLeaveId(null);
    }
  }

  if (!sessionReady || !adminSession.token) {
    return <AdminLoadingScreen />;
  }

  const filteredLeaveRequests = leaveRequests.filter((leaveRequest) => {
    const matchesSearch = `${leaveRequest.student_name} ${leaveRequest.reason} ${leaveRequest.start_date} ${leaveRequest.end_date}`
      .toLowerCase()
      .includes(leaveFilters.search.toLowerCase());
    const matchesStatus =
      leaveFilters.status === "all" || leaveRequest.status === leaveFilters.status;

    return matchesSearch && matchesStatus;
  });

  const pendingCount = filteredLeaveRequests.filter(
    (leaveRequest) => leaveRequest.status === "pending",
  ).length;
  const approvedCount = filteredLeaveRequests.filter(
    (leaveRequest) => leaveRequest.status === "approved",
  ).length;
  const rejectedCount = filteredLeaveRequests.filter(
    (leaveRequest) => leaveRequest.status === "rejected",
  ).length;

  return (
    <AdminShell
      adminSession={adminSession}
      pageLabel="Leave Requests"
      title="Leave Requests"
      subtitle="Review, approve, reject, and clean up student leave submissions from a dedicated admin page."
    >
      <PageCard>
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <SectionIntro
            eyebrow="Leave Review"
            title="Review and decide student leave requests"
            description="Pending requests can be approved or rejected here, and old requests can be removed without carrying the full admin dashboard around."
          />

          <div className="grid gap-3 sm:grid-cols-3">
            <Input
              type="text"
              placeholder="Search leave requests..."
              value={leaveFilters.search}
              onChange={(event) =>
                setLeaveFilters((current) => ({
                  ...current,
                  search: event.target.value,
                }))
              }
              className={ADMIN_FIELD_CLASSNAME}
            />

            <NativeSelect
              value={leaveFilters.status}
              onChange={(event) =>
                setLeaveFilters((current) => ({
                  ...current,
                  status: event.target.value,
                }))
              }
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </NativeSelect>

            <Button
              type="button"
              variant="outline"
              size="lg"
              className="rounded-full"
              onClick={refreshLeaveRequests}
            >
              <RefreshCcw className={`size-4 ${loadingLeaveRequests ? "animate-spin" : ""}`} />
              {loadingLeaveRequests ? "Refreshing..." : "Refresh"}
            </Button>
          </div>
        </div>

        {leaveMessage ? (
          <MessageBanner type={leaveMessage.type} className="mt-5">
            {leaveMessage.message}
          </MessageBanner>
        ) : null}

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <StatCard label="Pending" value={pendingCount} accentClass="border-amber-200/80 bg-amber-50/80 text-slate-900" />
          <StatCard label="Approved" value={approvedCount} accentClass="border-emerald-200/80 bg-emerald-50/80 text-slate-900" />
          <StatCard label="Rejected" value={rejectedCount} accentClass="border-rose-200/80 bg-rose-50/80 text-slate-900" />
        </div>
      </PageCard>

      <PageCard className="overflow-hidden p-0">
        <Table className="min-w-[82rem]">
          <TableHeader className="bg-slate-50">
            <TableRow>
              <TableHead className="px-6">Student</TableHead>
              <TableHead className="px-6">Dates</TableHead>
              <TableHead className="px-6">Days</TableHead>
              <TableHead className="px-6">Reason</TableHead>
              <TableHead className="px-6">Current Status</TableHead>
              <TableHead className="px-6">Update Status</TableHead>
              <TableHead className="px-6 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {filteredLeaveRequests.length === 0 ? (
              <TableRow>
                <TableCell className="px-6 py-8 text-slate-500" colSpan="7">
                  No leave requests matched the current filters.
                </TableCell>
              </TableRow>
            ) : (
              filteredLeaveRequests.map((leaveRequest) => (
                <TableRow key={leaveRequest.id}>
                  <TableCell className="px-6">
                    <div>
                      <p className="font-medium text-slate-900">{leaveRequest.student_name}</p>
                      <p className="text-xs text-slate-500">ID #{leaveRequest.student_id}</p>
                    </div>
                  </TableCell>
                  <TableCell className="px-6">
                    {formatDate(leaveRequest.start_date)} to {formatDate(leaveRequest.end_date)}
                  </TableCell>
                  <TableCell className="px-6">{leaveRequest.days_requested}</TableCell>
                  <TableCell className="px-6">
                    <p className="max-w-xs whitespace-pre-wrap text-slate-700">
                      {leaveRequest.reason}
                    </p>
                  </TableCell>
                  <TableCell className="px-6">
                    <StatusPill status={leaveRequest.status} />
                  </TableCell>
                  <TableCell className="px-6">
                    <NativeSelect
                      value={leaveDrafts[leaveRequest.id] || leaveRequest.status}
                      onChange={(event) =>
                        setLeaveDrafts((current) => ({
                          ...current,
                          [leaveRequest.id]: event.target.value,
                        }))
                      }
                      className="h-10 rounded-xl bg-white px-3 py-2"
                    >
                      <option value="pending">Pending</option>
                      <option value="approved">Approved</option>
                      <option value="rejected">Rejected</option>
                    </NativeSelect>
                  </TableCell>
                  <TableCell className="px-6">
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        size="sm"
                        className="rounded-full bg-blue-600 hover:bg-blue-700"
                        onClick={() => handleUpdateLeaveRequest(leaveRequest)}
                        disabled={updatingLeaveId === leaveRequest.id}
                      >
                        {updatingLeaveId === leaveRequest.id ? "Saving..." : "Save"}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        className="rounded-full"
                        onClick={() => handleDeleteLeaveRequest(leaveRequest)}
                        disabled={deletingLeaveId === leaveRequest.id}
                      >
                        {deletingLeaveId === leaveRequest.id ? "Deleting..." : "Delete"}
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
