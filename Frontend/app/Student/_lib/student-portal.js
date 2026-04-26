"use client";

import { useEffect, useSyncExternalStore } from "react";

import {
  buildApiUrl,
  getStudentAuthHeaders,
  parseApiResponse,
} from "@/app/lib/api";

export const DEFAULT_STUDENT_SESSION = {
  studentToken: "",
  studentId: "",
  studentName: "Student",
  studentEmail: "",
  faceImageUrl: "",
};

const STUDENT_SESSION_EVENT = "whoshere-student-session-change";
let cachedStudentSession = DEFAULT_STUDENT_SESSION;

function buildStudentSessionSnapshot() {
  return {
    studentToken: localStorage.getItem("student_token") || "",
    studentId: localStorage.getItem("student_id") || "",
    studentName: localStorage.getItem("student_name") || "Student",
    studentEmail: localStorage.getItem("student_email") || "",
    faceImageUrl: localStorage.getItem("student_face_image_url") || "",
  };
}

function studentSessionsMatch(left, right) {
  return (
    left.studentToken === right.studentToken &&
    left.studentId === right.studentId &&
    left.studentName === right.studentName &&
    left.studentEmail === right.studentEmail &&
    left.faceImageUrl === right.faceImageUrl
  );
}

function subscribeToSessionStore(callback) {
  if (typeof window === "undefined") {
    return () => {};
  }

  const handleStorage = () => callback();
  window.addEventListener("storage", handleStorage);
  window.addEventListener(STUDENT_SESSION_EVENT, handleStorage);

  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(STUDENT_SESSION_EVENT, handleStorage);
  };
}

function getClientReadySnapshot() {
  return true;
}

function getServerReadySnapshot() {
  return false;
}

function getServerStudentSessionSnapshot() {
  return DEFAULT_STUDENT_SESSION;
}

function emitStudentSessionChange() {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new Event(STUDENT_SESSION_EVENT));
}

export function createLeaveForm() {
  return {
    start_date: "",
    end_date: "",
    reason: "",
  };
}

export function formatDateTime(value) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleString();
}

export function formatDate(value) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleDateString();
}

export function toLocalDayKey(value) {
  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return "";
  }

  return `${parsedDate.getFullYear()}-${String(parsedDate.getMonth() + 1).padStart(2, "0")}-${String(
    parsedDate.getDate(),
  ).padStart(2, "0")}`;
}

export function capitalizeWords(value) {
  if (!value) {
    return "";
  }

  return value
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function getStatusPillClass(status) {
  if (status === "approved" || status === "present") {
    return "bg-emerald-100 text-emerald-700";
  }

  if (status === "rejected" || status === "absent") {
    return "bg-red-100 text-red-700";
  }

  if (status === "late") {
    return "bg-amber-100 text-amber-700";
  }

  if (status === "duplicate") {
    return "bg-sky-100 text-sky-700";
  }

  return "bg-slate-100 text-slate-700";
}

export function getMessageClass(type) {
  if (type === "error") {
    return "border border-red-200 bg-red-50 text-red-700";
  }

  if (type === "success") {
    return "border border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  return "border border-blue-200 bg-blue-50 text-blue-700";
}

export function getAttendanceResultHeading(status) {
  if (status === "present") {
    return "Attendance marked successfully.";
  }

  if (status === "duplicate") {
    return "Attendance already recorded today.";
  }

  if (status === "unknown") {
    return "Face was not recognized.";
  }

  return "Attendance could not be marked.";
}

export function calculateUniquePresentDays(attendance) {
  return new Set(
    attendance
      .filter((record) => record.status === "present" || record.status === "late")
      .map((record) => toLocalDayKey(record.marked_at))
      .filter(Boolean),
  ).size;
}

export function calculateApprovedLeaveDays(leaveRequests) {
  return leaveRequests
    .filter((leaveRequest) => leaveRequest.status === "approved")
    .reduce((total, leaveRequest) => total + leaveRequest.days_requested, 0);
}

export function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Could not preview the selected image."));
    reader.readAsDataURL(file);
  });
}

export function getStudentSessionFromStorage() {
  if (typeof window === "undefined") {
    return DEFAULT_STUDENT_SESSION;
  }

  const nextSnapshot = buildStudentSessionSnapshot();

  if (studentSessionsMatch(cachedStudentSession, nextSnapshot)) {
    return cachedStudentSession;
  }

  cachedStudentSession = nextSnapshot;
  return cachedStudentSession;
}

export function setStudentSessionStorage(studentSession) {
  if (typeof window === "undefined") {
    return;
  }

  const previousSnapshot = buildStudentSessionSnapshot();

  localStorage.setItem("student_token", studentSession.studentToken || "");
  localStorage.setItem("student_id", studentSession.studentId || "");
  localStorage.setItem("student_name", studentSession.studentName || "Student");
  localStorage.setItem("student_email", studentSession.studentEmail || "");
  localStorage.setItem("student_face_image_url", studentSession.faceImageUrl || "");

  const nextSnapshot = buildStudentSessionSnapshot();
  cachedStudentSession = nextSnapshot;

  if (!studentSessionsMatch(previousSnapshot, nextSnapshot)) {
    emitStudentSessionChange();
  }
}

export function clearStudentSessionStorage() {
  if (typeof window === "undefined") {
    return;
  }

  const previousSnapshot = buildStudentSessionSnapshot();

  localStorage.removeItem("student_token");
  localStorage.removeItem("student_id");
  localStorage.removeItem("student_name");
  localStorage.removeItem("student_email");
  localStorage.removeItem("student_face_image_url");

  cachedStudentSession = buildStudentSessionSnapshot();

  if (!studentSessionsMatch(previousSnapshot, cachedStudentSession)) {
    emitStudentSessionChange();
  }
}

export function isStudentAuthError(error) {
  const message = String(error?.message || "").toLowerCase();

  return (
    message.includes("authentication") ||
    message.includes("session is invalid or expired") ||
    message.includes("student authentication required")
  );
}

export function redirectStudentToLogin(router) {
  clearStudentSessionStorage();
  router.replace("/login");
}

export function useStudentSessionGuard(router) {
  const sessionReady = useSyncExternalStore(
    subscribeToSessionStore,
    getClientReadySnapshot,
    getServerReadySnapshot,
  );
  const studentSession = useSyncExternalStore(
    subscribeToSessionStore,
    getStudentSessionFromStorage,
    getServerStudentSessionSnapshot,
  );

  useEffect(() => {
    if (!sessionReady) {
      return;
    }

    if (!studentSession.studentId || !studentSession.studentToken) {
      redirectStudentToLogin(router);
    }
  }, [router, sessionReady, studentSession.studentId, studentSession.studentToken]);

  return {
    sessionReady,
    studentSession,
  };
}

async function fetchStudentApi(path, token, fallbackMessage, options = {}) {
  const response = await fetch(buildApiUrl(path), {
    ...options,
    headers: {
      ...getStudentAuthHeaders(token),
      ...(options.headers || {}),
    },
  });

  return parseApiResponse(response, fallbackMessage);
}

export function fetchStudentProfile(studentId, studentToken) {
  return fetchStudentApi(
    `/students/${studentId}`,
    studentToken,
    "Could not load your profile.",
  );
}

export function fetchStudentAttendance(studentId, studentToken) {
  return fetchStudentApi(
    `/attendance/student/${studentId}`,
    studentToken,
    "Could not load attendance history.",
  );
}

export function fetchStudentLeaveRequests(studentId, studentToken) {
  return fetchStudentApi(
    `/leave-requests/student/${studentId}`,
    studentToken,
    "Could not load leave requests.",
  );
}

export async function fetchStudentDashboardData(studentId, studentToken) {
  const [profile, attendance, leaveRequests] = await Promise.all([
    fetchStudentProfile(studentId, studentToken),
    fetchStudentAttendance(studentId, studentToken),
    fetchStudentLeaveRequests(studentId, studentToken),
  ]);

  return {
    profile,
    attendance,
    leaveRequests,
  };
}

export function markStudentAttendance(studentToken, faceImage) {
  const formData = new FormData();
  formData.append("face_image", faceImage);

  return fetchStudentApi(
    "/attendance/mark",
    studentToken,
    "Could not mark attendance right now.",
    {
      method: "POST",
      body: formData,
    },
  );
}

export function submitStudentLeaveRequest(studentId, studentToken, leaveForm) {
  const formData = new FormData();
  formData.append("student_id", studentId);
  formData.append("start_date", leaveForm.start_date);
  formData.append("end_date", leaveForm.end_date);
  formData.append("reason", leaveForm.reason.trim());

  return fetchStudentApi(
    "/leave-requests",
    studentToken,
    "Could not submit your leave request.",
    {
      method: "POST",
      body: formData,
    },
  );
}

export function changeStudentPassword(
  studentId,
  studentToken,
  currentPassword,
  newPassword,
) {
  const formData = new FormData();
  formData.append("current_password", currentPassword);
  formData.append("new_password", newPassword);

  return fetchStudentApi(
    `/students/${studentId}/change-password`,
    studentToken,
    "Could not change your password.",
    {
      method: "POST",
      body: formData,
    },
  );
}

export async function logoutStudent(studentToken) {
  if (!studentToken) {
    return;
  }

  await fetch(buildApiUrl("/logout/student"), {
    method: "POST",
    headers: getStudentAuthHeaders(studentToken),
  });
}
