"use client";

import { RefreshCcw } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import FacePosePreviewCard from "@/app/_components/FacePosePreviewCard";
import PasswordField from "@/app/_components/PasswordField";
import { buildAssetUrl } from "@/app/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

import StudentShell from "../_components/StudentShell";
import {
  MessageBanner,
  PageCard,
  SectionIntro,
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

const FACE_CAPTURE_OPTIONS = [
  { pose: "left", title: "Left Pose" },
  { pose: "center", title: "Center Pose" },
  { pose: "right", title: "Right Pose" },
];

function buildFaceImageMap(profile, fallbackImageUrl) {
  const faceImageMap = {
    left: "",
    center: fallbackImageUrl || "",
    right: "",
  };

  (profile?.face_images || []).forEach((faceImage) => {
    if (faceImage?.pose && faceImage?.image_url) {
      faceImageMap[faceImage.pose] = buildAssetUrl(faceImage.image_url);
    }
  });

  return faceImageMap;
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
  const faceImageMap = buildFaceImageMap(profile, profilePhotoUrl);
  const uniquePresentDays = calculateUniquePresentDays(attendance);
  const approvedLeaveDays = calculateApprovedLeaveDays(leaveRequests);

  return (
    <StudentShell
      studentSession={studentSession}
      pageLabel="Profile"
      title="Profile"
      subtitle="See your saved details, check your face photos, and change your password here."
    >
      <div className="grid gap-6 xl:grid-cols-[0.94fr,1.06fr]">
        <PageCard>
          <SectionIntro
            eyebrow="Enrollment Set"
            title="Registered face photos"
            description="These are the photos saved for face matching."
          />

          <div className="mt-6 grid gap-4">
            {FACE_CAPTURE_OPTIONS.map((captureOption) => (
              <FacePosePreviewCard
                key={captureOption.pose}
                title={captureOption.title}
                subtitle={
                  captureOption.pose === "center"
                    ? "Main photo used for the student profile"
                    : "Extra pose saved to improve matching"
                }
                statusLabel={faceImageMap[captureOption.pose] ? "Saved" : "Missing"}
                imageUrl={faceImageMap[captureOption.pose]}
                emptyLabel={`No ${captureOption.pose} pose photo has been enrolled yet.`}
                alt={`${captureOption.title} profile preview`}
              />
            ))}
          </div>
        </PageCard>

        <PageCard>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <SectionIntro
              eyebrow="Account Details"
              title="Review your profile information"
              description="Your saved account details and summary numbers are shown below."
            />

            <Button
              type="button"
              onClick={refreshProfilePage}
              variant="outline"
              size="lg"
              className="rounded-full"
            >
              <RefreshCcw className={`size-4 ${loadingProfile ? "animate-spin" : ""}`} />
              {loadingProfile ? "Refreshing..." : "Refresh Profile"}
            </Button>
          </div>

          {profileError ? (
            <MessageBanner type="error" className="mt-5">
              {profileError}
            </MessageBanner>
          ) : null}

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {[
              {
                label: "Student Name",
                value: profile?.full_name || studentSession.studentName,
              },
              {
                label: "Student ID",
                value: studentSession.studentId,
              },
              {
                label: "Email",
                value: profile?.email || studentSession.studentEmail || "Not provided",
              },
              {
                label: "Phone Number",
                value: profile?.phone_number || studentSession.studentPhoneNumber || "Not provided",
              },
              {
                label: "Registered",
                value: formatDateTime(profile?.created_at),
              },
            ].map((item) => (
              <Card
                key={item.label}
                className="rounded-[1.75rem] border-border/80 bg-slate-50/80 shadow-none"
              >
                <CardContent className="p-4">
                  <Badge variant="outline" className="rounded-full px-3 py-1">
                    {item.label}
                  </Badge>
                  <p className="mt-4 text-lg font-semibold text-slate-900">{item.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <StatCard
              label="Attendance records"
              value={loadingProfile && attendance.length === 0 ? "..." : attendance.length}
            />
            <StatCard
              label="Unique present days"
              value={loadingProfile && attendance.length === 0 ? "..." : uniquePresentDays}
              accentClass="border-emerald-200/80 bg-emerald-50/80 text-slate-900"
            />
            <StatCard
              label="Approved leave days"
              value={loadingProfile && leaveRequests.length === 0 ? "..." : approvedLeaveDays}
              accentClass="border-sky-200/80 bg-sky-50/80 text-slate-900"
            />
          </div>
        </PageCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.02fr,0.98fr]">
        <div id="change-password-section" className="scroll-mt-28">
          <PageCard>
            <SectionIntro
              eyebrow="Password Settings"
              title="Change your password"
              description="Enter your current password and set a new one."
            />

            {passwordMessage ? (
              <MessageBanner type={passwordMessage.type} className="mt-5">
                {passwordMessage.message}
              </MessageBanner>
            ) : null}

            <form onSubmit={handleChangePassword} className="mt-6 space-y-4">
              <PasswordField
                label="Current Password"
                value={passwordForm.current_password}
                onChange={(event) =>
                  setPasswordForm((current) => ({
                    ...current,
                    current_password: event.target.value,
                  }))
                }
                inputClassName="h-12 rounded-2xl border-slate-200 bg-slate-50"
              />

              <PasswordField
                label="New Password"
                value={passwordForm.new_password}
                onChange={(event) =>
                  setPasswordForm((current) => ({
                    ...current,
                    new_password: event.target.value,
                  }))
                }
                inputClassName="h-12 rounded-2xl border-slate-200 bg-slate-50"
              />

              <PasswordField
                label="Confirm New Password"
                value={passwordForm.confirm_password}
                onChange={(event) =>
                  setPasswordForm((current) => ({
                    ...current,
                    confirm_password: event.target.value,
                  }))
                }
                inputClassName="h-12 rounded-2xl border-slate-200 bg-slate-50"
              />

              <div className="flex flex-wrap gap-3 pt-2">
                <Button type="submit" disabled={changingPassword} size="lg" className="rounded-full">
                  {changingPassword ? "Updating..." : "Change Password"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  className="rounded-full"
                  onClick={() => {
                    setPasswordForm(createPasswordForm());
                    setPasswordMessage(null);
                  }}
                >
                  Clear Form
                </Button>
              </div>
            </form>
          </PageCard>
        </div>

        <PageCard>
          <SectionIntro
            eyebrow="Security Tips"
            title="Keep your password safe"
            description="A few simple steps can help protect your account."
          />
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
