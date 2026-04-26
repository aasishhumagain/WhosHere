"use client";

import { RefreshCcw, SendHorizontal } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

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
  createLeaveForm,
  fetchStudentLeaveRequests,
  formatDate,
  isStudentAuthError,
  redirectStudentToLogin,
  submitStudentLeaveRequest,
  useStudentSessionGuard,
} from "../_lib/student-portal";

export default function StudentLeaveRequestsPage() {
  const router = useRouter();
  const { sessionReady, studentSession } = useStudentSessionGuard(router);

  const [leaveRequests, setLeaveRequests] = useState([]);
  const [leaveForm, setLeaveForm] = useState(createLeaveForm());
  const [loadingLeaveRequests, setLoadingLeaveRequests] = useState(true);
  const [submittingLeaveRequest, setSubmittingLeaveRequest] = useState(false);
  const [pageError, setPageError] = useState("");
  const [leaveMessage, setLeaveMessage] = useState(null);

  async function refreshLeaveRequests() {
    if (!studentSession.studentId || !studentSession.studentToken) {
      return;
    }

    setLoadingLeaveRequests(true);
    setPageError("");

    try {
      const records = await fetchStudentLeaveRequests(
        studentSession.studentId,
        studentSession.studentToken,
      );
      setLeaveRequests(records);
    } catch (error) {
      if (isStudentAuthError(error)) {
        redirectStudentToLogin(router);
        return;
      }

      setPageError(error.message || "Could not load leave requests.");
    } finally {
      setLoadingLeaveRequests(false);
    }
  }

  useEffect(() => {
    if (!sessionReady || !studentSession.studentId || !studentSession.studentToken) {
      return;
    }

    let isActive = true;

    async function loadInitialLeaveRequests() {
      try {
        const records = await fetchStudentLeaveRequests(
          studentSession.studentId,
          studentSession.studentToken,
        );

        if (!isActive) {
          return;
        }

        setLeaveRequests(records);
      } catch (error) {
        if (!isActive) {
          return;
        }

        if (isStudentAuthError(error)) {
          redirectStudentToLogin(router);
          return;
        }

        setPageError(error.message || "Could not load leave requests.");
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
  }, [router, sessionReady, studentSession.studentId, studentSession.studentToken]);

  async function handleSubmit(event) {
    event.preventDefault();

    if (!leaveForm.start_date || !leaveForm.end_date || !leaveForm.reason.trim()) {
      setLeaveMessage({
        type: "error",
        message: "Start date, end date, and reason are all required.",
      });
      return;
    }

    if (leaveForm.end_date < leaveForm.start_date) {
      setLeaveMessage({
        type: "error",
        message: "End date cannot be earlier than start date.",
      });
      return;
    }

    setSubmittingLeaveRequest(true);
    setLeaveMessage(null);

    try {
      const response = await submitStudentLeaveRequest(
        studentSession.studentId,
        studentSession.studentToken,
        leaveForm,
      );

      setLeaveForm(createLeaveForm());
      await refreshLeaveRequests();
      setLeaveMessage({
        type: "success",
        message: response.message || "Leave request submitted successfully.",
      });
    } catch (error) {
      if (isStudentAuthError(error)) {
        redirectStudentToLogin(router);
        return;
      }

      setLeaveMessage({
        type: "error",
        message: error.message || "Could not submit your leave request.",
      });
    } finally {
      setSubmittingLeaveRequest(false);
    }
  }

  if (!sessionReady || !studentSession.studentId || !studentSession.studentToken) {
    return <StudentLoadingScreen />;
  }

  const pendingCount = leaveRequests.filter((request) => request.status === "pending").length;
  const approvedCount = leaveRequests.filter((request) => request.status === "approved").length;
  const rejectedCount = leaveRequests.filter((request) => request.status === "rejected").length;

  return (
    <StudentShell
      studentSession={studentSession}
      pageLabel="Leave Requests"
      title="Leave Management"
      subtitle="Submit a new leave request and review the status of your previous requests in one dedicated page."
    >
      <PageCard>
        <SectionIntro
          eyebrow="Leave Summary"
          title="Keep track of your leave requests"
          description="Add the leave dates and a reason, then monitor the request status from the table below."
        />

        {pageError ? (
          <MessageBanner type="error" className="mt-5">
            {pageError}
          </MessageBanner>
        ) : null}

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <StatCard
            label="Pending"
            value={loadingLeaveRequests && leaveRequests.length === 0 ? "..." : pendingCount}
            accentClass="border-amber-200 bg-amber-50 text-slate-900"
          />
          <StatCard
            label="Approved"
            value={loadingLeaveRequests && leaveRequests.length === 0 ? "..." : approvedCount}
            accentClass="border-emerald-200 bg-emerald-50 text-slate-900"
          />
          <StatCard
            label="Rejected"
            value={loadingLeaveRequests && leaveRequests.length === 0 ? "..." : rejectedCount}
            accentClass="border-rose-200 bg-rose-50 text-slate-900"
          />
        </div>
      </PageCard>

      <div className="grid gap-6 xl:grid-cols-[1.01fr,0.99fr]">
        <PageCard>
          <SectionIntro
            eyebrow="New Request"
            title="Submit leave details"
            description="Choose your date range, add a reason, and send the request to the administrator for review."
          />

          {leaveMessage ? (
            <MessageBanner type={leaveMessage.type} className="mt-5">
              {leaveMessage.message}
            </MessageBanner>
          ) : null}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="leave-start-date">Start Date</Label>
                <Input
                  id="leave-start-date"
                  type="date"
                  value={leaveForm.start_date}
                  onChange={(event) =>
                    setLeaveForm((current) => ({
                      ...current,
                      start_date: event.target.value,
                    }))
                  }
                  className="h-12 rounded-2xl border-slate-200 bg-slate-50"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="leave-end-date">End Date</Label>
                <Input
                  id="leave-end-date"
                  type="date"
                  value={leaveForm.end_date}
                  onChange={(event) =>
                    setLeaveForm((current) => ({
                      ...current,
                      end_date: event.target.value,
                    }))
                  }
                  className="h-12 rounded-2xl border-slate-200 bg-slate-50"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="leave-reason">Reason</Label>
              <Textarea
                id="leave-reason"
                rows="5"
                value={leaveForm.reason}
                onChange={(event) =>
                  setLeaveForm((current) => ({
                    ...current,
                    reason: event.target.value,
                  }))
                }
                placeholder="Explain why you are requesting leave..."
                className="rounded-2xl border-slate-200 bg-slate-50"
              />
            </div>

            <div className="flex flex-wrap gap-3 pt-2">
              <Button
                type="submit"
                disabled={submittingLeaveRequest}
                size="lg"
                className="rounded-full bg-sky-600 hover:bg-sky-700"
              >
                <SendHorizontal className="size-4" />
                {submittingLeaveRequest ? "Submitting..." : "Submit Leave Request"}
              </Button>
              <Button
                type="button"
                onClick={() => setLeaveForm(createLeaveForm())}
                variant="outline"
                size="lg"
                className="rounded-full"
              >
                Clear Form
              </Button>
            </div>
          </form>
        </PageCard>

        <PageCard className="overflow-hidden p-0">
          <div className="border-b border-slate-200 px-6 py-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <SectionIntro
                eyebrow="Leave History"
                title="Previous requests"
                description="Every request you have submitted appears below with dates, status, and your original reason."
              />

              <Button
                type="button"
                onClick={refreshLeaveRequests}
                variant="outline"
                size="lg"
                className="rounded-full"
              >
                <RefreshCcw className={`size-4 ${loadingLeaveRequests ? "animate-spin" : ""}`} />
                {loadingLeaveRequests ? "Refreshing..." : "Refresh History"}
              </Button>
            </div>
          </div>

          <Table className="min-w-[42rem]">
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead className="px-6">Dates</TableHead>
                <TableHead className="px-6">Days</TableHead>
                <TableHead className="px-6">Status</TableHead>
                <TableHead className="px-6">Reason</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {leaveRequests.length === 0 ? (
                <TableRow>
                  <TableCell className="px-6 py-8 text-slate-500" colSpan="4">
                    {loadingLeaveRequests
                      ? "Loading leave requests..."
                      : "No leave requests submitted yet."}
                  </TableCell>
                </TableRow>
              ) : (
                leaveRequests.map((leaveRequest) => (
                  <TableRow key={leaveRequest.id}>
                    <TableCell className="px-6">
                      {formatDate(leaveRequest.start_date)} to {formatDate(leaveRequest.end_date)}
                    </TableCell>
                    <TableCell className="px-6">
                      {leaveRequest.days_requested}
                    </TableCell>
                    <TableCell className="px-6">
                      <StatusPill status={leaveRequest.status} />
                    </TableCell>
                    <TableCell className="px-6">
                      <p className="max-w-xs whitespace-pre-wrap text-slate-700">
                        {leaveRequest.reason}
                      </p>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </PageCard>
      </div>
    </StudentShell>
  );
}
