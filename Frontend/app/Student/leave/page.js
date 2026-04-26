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
        <p className="text-sm font-semibold uppercase tracking-[0.28em] text-sky-700">
          Leave Summary
        </p>
        <h2 className="mt-3 text-3xl font-semibold text-slate-950">
          Keep track of your leave requests
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
          Add the leave dates and a reason, then monitor the request status from the table below.
        </p>

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
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-sky-700">
            New Request
          </p>
          <h2 className="mt-3 text-3xl font-semibold text-slate-950">Submit leave details</h2>

          {leaveMessage ? (
            <MessageBanner type={leaveMessage.type} className="mt-5">
              {leaveMessage.message}
            </MessageBanner>
          ) : null}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Start Date
                </label>
                <input
                  type="date"
                  value={leaveForm.start_date}
                  onChange={(event) =>
                    setLeaveForm((current) => ({
                      ...current,
                      start_date: event.target.value,
                    }))
                  }
                  className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 outline-none transition focus:border-sky-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  End Date
                </label>
                <input
                  type="date"
                  value={leaveForm.end_date}
                  onChange={(event) =>
                    setLeaveForm((current) => ({
                      ...current,
                      end_date: event.target.value,
                    }))
                  }
                  className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 outline-none transition focus:border-sky-500 focus:bg-white"
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Reason</label>
              <textarea
                rows="5"
                value={leaveForm.reason}
                onChange={(event) =>
                  setLeaveForm((current) => ({
                    ...current,
                    reason: event.target.value,
                  }))
                }
                placeholder="Explain why you are requesting leave..."
                className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 outline-none transition focus:border-sky-500 focus:bg-white"
              />
            </div>

            <div className="flex flex-wrap gap-3 pt-2">
              <button
                type="submit"
                disabled={submittingLeaveRequest}
                className="rounded-2xl bg-sky-600 px-5 py-3 text-sm font-medium text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-sky-300"
              >
                {submittingLeaveRequest ? "Submitting..." : "Submit Leave Request"}
              </button>
              <button
                type="button"
                onClick={() => setLeaveForm(createLeaveForm())}
                className="rounded-2xl border border-slate-300 px-5 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
              >
                Clear Form
              </button>
            </div>
          </form>
        </PageCard>

        <PageCard className="overflow-hidden p-0">
          <div className="border-b border-slate-200 px-6 py-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.28em] text-slate-500">
                  Leave History
                </p>
                <h2 className="mt-3 text-3xl font-semibold text-slate-950">Previous requests</h2>
              </div>

              <button
                type="button"
                onClick={refreshLeaveRequests}
                className="rounded-2xl border border-slate-300 px-5 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
              >
                {loadingLeaveRequests ? "Refreshing..." : "Refresh History"}
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[42rem] text-sm">
              <thead className="bg-slate-100 text-left">
                <tr>
                  <th className="border-b border-slate-200 px-6 py-4">Dates</th>
                  <th className="border-b border-slate-200 px-6 py-4">Days</th>
                  <th className="border-b border-slate-200 px-6 py-4">Status</th>
                  <th className="border-b border-slate-200 px-6 py-4">Reason</th>
                </tr>
              </thead>

              <tbody>
                {leaveRequests.length === 0 ? (
                  <tr>
                    <td className="px-6 py-8 text-slate-500" colSpan="4">
                      {loadingLeaveRequests
                        ? "Loading leave requests..."
                        : "No leave requests submitted yet."}
                    </td>
                  </tr>
                ) : (
                  leaveRequests.map((leaveRequest) => (
                    <tr key={leaveRequest.id} className="odd:bg-white even:bg-slate-50">
                      <td className="border-b border-slate-100 px-6 py-4">
                        {formatDate(leaveRequest.start_date)} to {formatDate(leaveRequest.end_date)}
                      </td>
                      <td className="border-b border-slate-100 px-6 py-4">
                        {leaveRequest.days_requested}
                      </td>
                      <td className="border-b border-slate-100 px-6 py-4">
                        <StatusPill status={leaveRequest.status} />
                      </td>
                      <td className="border-b border-slate-100 px-6 py-4">
                        <p className="max-w-xs whitespace-pre-wrap text-slate-700">
                          {leaveRequest.reason}
                        </p>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </PageCard>
      </div>
    </StudentShell>
  );
}
