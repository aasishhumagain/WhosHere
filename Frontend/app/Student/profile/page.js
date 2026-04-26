"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { buildAssetUrl } from "@/app/lib/api";

import StudentShell from "../_components/StudentShell";
import {
  MessageBanner,
  PageCard,
  PhotoPreviewCard,
  StatCard,
  StudentLoadingScreen,
} from "../_components/StudentUI";
import {
  calculateApprovedLeaveDays,
  calculateUniquePresentDays,
  changeStudentPassword,
  fetchStudentDashboardData,
  formatDateTime,
  isStudentAuthError,
  redirectStudentToLogin,
  useStudentSessionGuard,
} from "../_lib/student-portal";

function createPasswordForm() {
  return {
    current_password: "",
    new_password: "",
    confirm_password: "",
  };
}

export default function StudentProfilePage() {
  const router = useRouter();
  const { sessionReady, studentSession } = useStudentSessionGuard(router);

  const [profile, setProfile] = useState(null);
  const [attendance, setAttendance] = useState([]);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [profileError, setProfileError] = useState("");
  const [passwordForm, setPasswordForm] = useState(createPasswordForm());
  const [passwordMessage, setPasswordMessage] = useState(null);
  const [changingPassword, setChangingPassword] = useState(false);

  function applyProfileData(dashboardData) {
    setProfile(dashboardData.profile);
    setAttendance(dashboardData.attendance);
    setLeaveRequests(dashboardData.leaveRequests);
  }

  async function refreshProfilePage() {
    if (!studentSession.studentId || !studentSession.studentToken) {
      return;
    }

    setLoadingProfile(true);
    setProfileError("");

    try {
      const dashboardData = await fetchStudentDashboardData(
        studentSession.studentId,
        studentSession.studentToken,
      );

      applyProfileData(dashboardData);
    } catch (error) {
      if (isStudentAuthError(error)) {
        redirectStudentToLogin(router);
        return;
      }

      setProfileError(error.message || "Could not load your profile.");
    } finally {
      setLoadingProfile(false);
    }
  }

  useEffect(() => {
    if (!sessionReady || !studentSession.studentId || !studentSession.studentToken) {
      return;
    }

    let isActive = true;

    async function loadInitialProfilePage() {
      try {
        const dashboardData = await fetchStudentDashboardData(
          studentSession.studentId,
          studentSession.studentToken,
        );

        if (!isActive) {
          return;
        }

        applyProfileData(dashboardData);
      } catch (error) {
        if (!isActive) {
          return;
        }

        if (isStudentAuthError(error)) {
          redirectStudentToLogin(router);
          return;
        }

        setProfileError(error.message || "Could not load your profile.");
      } finally {
        if (isActive) {
          setLoadingProfile(false);
        }
      }
    }

    loadInitialProfilePage();

    return () => {
      isActive = false;
    };
  }, [router, sessionReady, studentSession.studentId, studentSession.studentToken]);

  async function handleChangePassword(event) {
    event.preventDefault();

    if (
      !passwordForm.current_password.trim() ||
      !passwordForm.new_password.trim() ||
      !passwordForm.confirm_password.trim()
    ) {
      setPasswordMessage({
        type: "error",
        message: "Current password, new password, and confirmation are all required.",
      });
      return;
    }

    if (passwordForm.new_password !== passwordForm.confirm_password) {
      setPasswordMessage({
        type: "error",
        message: "New password and confirmation password do not match.",
      });
      return;
    }

    setChangingPassword(true);
    setPasswordMessage(null);

    try {
      const response = await changeStudentPassword(
        studentSession.studentId,
        studentSession.studentToken,
        passwordForm.current_password,
        passwordForm.new_password,
      );

      setPasswordForm(createPasswordForm());
      setPasswordMessage({
        type: "success",
        message: response.message || "Password changed successfully.",
      });
    } catch (error) {
      if (isStudentAuthError(error)) {
        redirectStudentToLogin(router);
        return;
      }

      setPasswordMessage({
        type: "error",
        message: error.message || "Could not change your password.",
      });
    } finally {
      setChangingPassword(false);
    }
  }

  if (!sessionReady || !studentSession.studentId || !studentSession.studentToken) {
    return <StudentLoadingScreen />;
  }

  const profilePhotoUrl = buildAssetUrl(
    profile?.face_image_url || studentSession.faceImageUrl,
  );
  const uniquePresentDays = calculateUniquePresentDays(attendance);
  const approvedLeaveDays = calculateApprovedLeaveDays(leaveRequests);

  return (
    <StudentShell
      studentSession={studentSession}
      pageLabel="Profile"
      title="Your Student Profile"
      subtitle="Review your registered account details and change your password without waiting for an administrator."
    >
      <div className="grid gap-6 xl:grid-cols-[0.94fr,1.06fr]">
        <PageCard>
          <PhotoPreviewCard
            title="Profile Photo"
            subtitle="This is the face image currently linked to your account for recognition attendance."
            imageUrl={profilePhotoUrl}
            fallbackLabel="Your profile photo will appear here once one is registered by the admin."
          />
        </PageCard>

        <PageCard>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.28em] text-amber-700">
                Account Details
              </p>
              <h2 className="mt-3 text-3xl font-semibold text-slate-950">
                Review your profile information
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                Your personal account details, attendance summary, and leave summary are shown
                below.
              </p>
            </div>

            <button
              type="button"
              onClick={refreshProfilePage}
              className="rounded-2xl border border-slate-300 px-5 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
            >
              {loadingProfile ? "Refreshing..." : "Refresh Profile"}
            </button>
          </div>

          {profileError ? (
            <MessageBanner type="error" className="mt-5">
              {profileError}
            </MessageBanner>
          ) : null}

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                Student Name
              </p>
              <p className="mt-3 text-lg font-semibold text-slate-900">
                {profile?.full_name || studentSession.studentName}
              </p>
            </div>

            <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                Student ID
              </p>
              <p className="mt-3 text-lg font-semibold text-slate-900">
                {studentSession.studentId}
              </p>
            </div>

            <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                Email
              </p>
              <p className="mt-3 text-lg font-semibold text-slate-900">
                {profile?.email || studentSession.studentEmail || "Not provided"}
              </p>
            </div>

            <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                Registered
              </p>
              <p className="mt-3 text-lg font-semibold text-slate-900">
                {formatDateTime(profile?.created_at)}
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <StatCard
              label="Attendance records"
              value={loadingProfile && attendance.length === 0 ? "..." : attendance.length}
            />
            <StatCard
              label="Unique present days"
              value={loadingProfile && attendance.length === 0 ? "..." : uniquePresentDays}
              accentClass="border-emerald-200 bg-emerald-50 text-slate-900"
            />
            <StatCard
              label="Approved leave days"
              value={loadingProfile && leaveRequests.length === 0 ? "..." : approvedLeaveDays}
              accentClass="border-sky-200 bg-sky-50 text-slate-900"
            />
          </div>
        </PageCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.02fr,0.98fr]">
        <div id="change-password-section" className="scroll-mt-28">
          <PageCard>
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-slate-500">
            Password Settings
          </p>
          <h2 className="mt-3 text-3xl font-semibold text-slate-950">Change your password</h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Enter your current password, set a new one, and save it here. You no longer need an
            admin to update your student password.
          </p>

          {passwordMessage ? (
            <MessageBanner type={passwordMessage.type} className="mt-5">
              {passwordMessage.message}
            </MessageBanner>
          ) : null}

          <form onSubmit={handleChangePassword} className="mt-6 space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Current Password
              </label>
              <input
                type="password"
                value={passwordForm.current_password}
                onChange={(event) =>
                  setPasswordForm((current) => ({
                    ...current,
                    current_password: event.target.value,
                  }))
                }
                className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 outline-none transition focus:border-blue-500 focus:bg-white"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                New Password
              </label>
              <input
                type="password"
                value={passwordForm.new_password}
                onChange={(event) =>
                  setPasswordForm((current) => ({
                    ...current,
                    new_password: event.target.value,
                  }))
                }
                className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 outline-none transition focus:border-blue-500 focus:bg-white"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Confirm New Password
              </label>
              <input
                type="password"
                value={passwordForm.confirm_password}
                onChange={(event) =>
                  setPasswordForm((current) => ({
                    ...current,
                    confirm_password: event.target.value,
                  }))
                }
                className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 outline-none transition focus:border-blue-500 focus:bg-white"
              />
            </div>

            <div className="flex flex-wrap gap-3 pt-2">
              <button
                type="submit"
                disabled={changingPassword}
                className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {changingPassword ? "Updating..." : "Change Password"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setPasswordForm(createPasswordForm());
                  setPasswordMessage(null);
                }}
                className="rounded-2xl border border-slate-300 px-5 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
              >
                Clear Form
              </button>
            </div>
          </form>
          </PageCard>
        </div>

        <PageCard>
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-slate-500">
            Security Tips
          </p>
          <h2 className="mt-3 text-3xl font-semibold text-slate-950">Keep your account safe</h2>
          <ul className="mt-5 space-y-3 text-sm leading-6 text-slate-600">
            <li>Use a password that is different from the one used on other sites.</li>
            <li>Do not share your student password with friends or classmates.</li>
            <li>Update your password immediately if you think someone else has seen it.</li>
          </ul>
        </PageCard>
      </div>
    </StudentShell>
  );
}
