"use client";

import { useEffect, useSyncExternalStore } from "react";

import {
  buildApiUrl,
  buildQueryString,
  getAdminAuthHeaders,
  parseApiResponse,
} from "@/app/lib/api";

export const DEFAULT_ADMIN_SESSION = {
  token: "",
  username: "admin",
};
export const STUDENT_FACE_POSES = ["left", "center", "right"];
export const STUDENT_ROLE_OPTIONS = ["Student", "Staff"];

const ADMIN_SESSION_EVENT = "whoshere-admin-session-change";
let cachedAdminSession = DEFAULT_ADMIN_SESSION;

function buildAdminSessionSnapshot() {
  return {
    token: localStorage.getItem("admin_token") || "",
    username: localStorage.getItem("admin_username") || "admin",
  };
}

function adminSessionsMatch(left, right) {
  return left.token === right.token && left.username === right.username;
}

function subscribeToSessionStore(callback) {
  if (typeof window === "undefined") {
    return () => {};
  }

  const handleStorage = () => callback();
  window.addEventListener("storage", handleStorage);
  window.addEventListener(ADMIN_SESSION_EVENT, handleStorage);

  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(ADMIN_SESSION_EVENT, handleStorage);
  };
}

function getClientReadySnapshot() {
  return true;
}

function getServerReadySnapshot() {
  return false;
}

function getServerAdminSessionSnapshot() {
  return DEFAULT_ADMIN_SESSION;
}

function emitAdminSessionChange() {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new Event(ADMIN_SESSION_EVENT));
}

export function createStudentForm(student = {}) {
  return {
    full_name: student.full_name || "",
    email: student.email || "",
    phone_number: student.phone_number || "",
    role: student.role || "Student",
    password: "",
    face_images: {
      left: null,
      center: null,
      right: null,
    },
  };
}

export function createAdminUserForm() {
  return {
    username: "",
    password: "",
    confirm_password: "",
  };
}

export function createAdminEditForm(adminUser = {}) {
  return {
    username: adminUser.username || "",
    password: "",
    confirm_password: "",
  };
}

export function createAdminPasswordForm() {
  return {
    current_password: "",
    new_password: "",
    confirm_password: "",
  };
}

export function createFilterState() {
  return {
    search: "",
    status: "all",
    studentId: "all",
    dateFrom: "",
    dateTo: "",
    preset: "all",
    sortOrder: "marked_at:desc",
  };
}

export function createLeaveFilterState() {
  return {
    search: "",
    status: "all",
  };
}

export function createAuditLogFilterState() {
  return {
    search: "",
    actorType: "all",
    action: "all",
    dateFrom: "",
    dateTo: "",
    preset: "all",
    sortOrder: "created_at:desc",
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

export function formatPercent(value) {
  return `${Math.round(value)}%`;
}

export function padDateSegment(value) {
  return String(value).padStart(2, "0");
}

export function toDateInputValue(value) {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return `${date.getFullYear()}-${padDateSegment(date.getMonth() + 1)}-${padDateSegment(date.getDate())}`;
}

export function parseDateInputValue(value) {
  if (!value) {
    return null;
  }

  const [year, month, day] = value.split("-").map(Number);

  if (!year || !month || !day) {
    return null;
  }

  return new Date(year, month - 1, day);
}

export function getAttendancePresetDates(preset) {
  const today = new Date();
  const todayValue = toDateInputValue(today);

  if (preset === "today") {
    return { dateFrom: todayValue, dateTo: todayValue };
  }

  if (preset === "last7") {
    const dateFrom = new Date(today);
    dateFrom.setDate(dateFrom.getDate() - 6);
    return { dateFrom: toDateInputValue(dateFrom), dateTo: todayValue };
  }

  if (preset === "last30") {
    const dateFrom = new Date(today);
    dateFrom.setDate(dateFrom.getDate() - 29);
    return { dateFrom: toDateInputValue(dateFrom), dateTo: todayValue };
  }

  if (preset === "thisMonth") {
    const dateFrom = new Date(today.getFullYear(), today.getMonth(), 1);
    return { dateFrom: toDateInputValue(dateFrom), dateTo: todayValue };
  }

  return { dateFrom: "", dateTo: "" };
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

export function getAdminInitials(username) {
  const parts = String(username || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) {
    return "AD";
  }

  return parts
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
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

  if (status === "excused") {
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

export function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Could not preview the selected image."));
    reader.readAsDataURL(file);
  });
}

export function buildAttendanceExportFileName(filters) {
  const nameParts = ["attendance_report"];

  if (filters.dateFrom && filters.dateTo) {
    nameParts.push(`${filters.dateFrom}_to_${filters.dateTo}`);
  } else if (filters.dateFrom) {
    nameParts.push(`from_${filters.dateFrom}`);
  } else if (filters.dateTo) {
    nameParts.push(`until_${filters.dateTo}`);
  } else {
    nameParts.push("all_dates");
  }

  if (filters.status !== "all") {
    nameParts.push(filters.status);
  }

  if (filters.studentId !== "all") {
    nameParts.push(`student_${filters.studentId}`);
  }

  return `${nameParts.join("_")}.csv`;
}

export function getAdminSessionFromStorage() {
  if (typeof window === "undefined") {
    return DEFAULT_ADMIN_SESSION;
  }

  const nextSnapshot = buildAdminSessionSnapshot();

  if (adminSessionsMatch(cachedAdminSession, nextSnapshot)) {
    return cachedAdminSession;
  }

  cachedAdminSession = nextSnapshot;
  return cachedAdminSession;
}

export function setAdminSessionStorage(adminSession) {
  if (typeof window === "undefined") {
    return;
  }

  const previousSnapshot = buildAdminSessionSnapshot();

  localStorage.setItem("admin_token", adminSession.token || "");
  localStorage.setItem("admin_username", adminSession.username || "admin");

  const nextSnapshot = buildAdminSessionSnapshot();
  cachedAdminSession = nextSnapshot;

  if (!adminSessionsMatch(previousSnapshot, nextSnapshot)) {
    emitAdminSessionChange();
  }
}

export function clearAdminSessionStorage() {
  if (typeof window === "undefined") {
    return;
  }

  const previousSnapshot = buildAdminSessionSnapshot();

  localStorage.removeItem("admin_token");
  localStorage.removeItem("admin_username");

  cachedAdminSession = buildAdminSessionSnapshot();

  if (!adminSessionsMatch(previousSnapshot, cachedAdminSession)) {
    emitAdminSessionChange();
  }
}

export function isAdminAuthError(error) {
  const message = String(error?.message || "").toLowerCase();

  return (
    message.includes("admin authentication required") ||
    message.includes("authentication") ||
    message.includes("expired")
  );
}

export function redirectAdminToLogin(router) {
  clearAdminSessionStorage();
  router.replace("/login");
}

export function useAdminSessionGuard(router) {
  const sessionReady = useSyncExternalStore(
    subscribeToSessionStore,
    getClientReadySnapshot,
    getServerReadySnapshot,
  );
  const adminSession = useSyncExternalStore(
    subscribeToSessionStore,
    getAdminSessionFromStorage,
    getServerAdminSessionSnapshot,
  );

  useEffect(() => {
    if (!sessionReady) {
      return;
    }

    if (!adminSession.token) {
      redirectAdminToLogin(router);
    }
  }, [adminSession.token, router, sessionReady]);

  return {
    sessionReady,
    adminSession,
  };
}

async function fetchAdminApi(path, token, fallbackMessage, options = {}) {
  const response = await fetch(buildApiUrl(path), {
    ...options,
    headers: {
      ...getAdminAuthHeaders(token),
      ...(options.headers || {}),
    },
  });

  return parseApiResponse(response, fallbackMessage);
}

export function fetchStudents(adminToken) {
  return fetchAdminApi("/students", adminToken, "Could not load students.");
}

export function fetchAdminUsers(adminToken) {
  return fetchAdminApi("/admin-users", adminToken, "Could not load admin users.");
}

export function fetchAuditLogs(adminToken) {
  return fetchAdminApi("/audit-logs", adminToken, "Could not load audit logs.");
}

export function fetchAttendance(adminToken) {
  return fetchAdminApi("/attendance", adminToken, "Could not load attendance.");
}

export function fetchLeaveRequests(adminToken) {
  return fetchAdminApi(
    "/leave-requests",
    adminToken,
    "Could not load leave requests.",
  );
}

export async function fetchAdminDashboardData(adminToken) {
  const [students, attendance, leaveRequests] = await Promise.all([
    fetchStudents(adminToken),
    fetchAttendance(adminToken),
    fetchLeaveRequests(adminToken),
  ]);

  return {
    students,
    attendance,
    leaveRequests,
  };
}

export function createAdminUser(adminToken, adminForm) {
  const formData = new FormData();
  formData.append("username", adminForm.username.trim());
  formData.append("password", adminForm.password.trim());

  return fetchAdminApi(
    "/admin-users",
    adminToken,
    "Could not create the admin account.",
    {
      method: "POST",
      body: formData,
    },
  );
}

export function changeAdminPassword(adminToken, currentPassword, newPassword) {
  const formData = new FormData();
  formData.append("current_password", currentPassword);
  formData.append("new_password", newPassword);

  return fetchAdminApi(
    "/admin-users/change-password",
    adminToken,
    "Could not change the admin password.",
    {
      method: "POST",
      body: formData,
    },
  );
}

export function updateAdminUser(adminToken, adminUserId, adminForm) {
  const formData = new FormData();
  formData.append("username", adminForm.username.trim());

  if (adminForm.password.trim()) {
    formData.append("password", adminForm.password.trim());
  }

  return fetchAdminApi(
    `/admin-users/${adminUserId}`,
    adminToken,
    "Could not update the admin account.",
    {
      method: "PUT",
      body: formData,
    },
  );
}

export function deleteAdminUser(adminToken, adminUserId) {
  return fetchAdminApi(
    `/admin-users/${adminUserId}`,
    adminToken,
    "Could not delete the admin account.",
    {
      method: "DELETE",
    },
  );
}

export function registerStudent(adminToken, studentForm) {
  const formData = new FormData();
  formData.append("full_name", studentForm.full_name.trim());
  formData.append("email", studentForm.email.trim());
  formData.append("phone_number", studentForm.phone_number.trim());
  formData.append("role", studentForm.role);
  formData.append("password", studentForm.password.trim());

  STUDENT_FACE_POSES.forEach((pose) => {
    if (studentForm.face_images?.[pose]) {
      formData.append(`face_image_${pose}`, studentForm.face_images[pose]);
    }
  });

  return fetchAdminApi(
    "/students/register",
    adminToken,
    "Could not register the student.",
    {
      method: "POST",
      body: formData,
    },
  );
}

export function updateStudent(adminToken, studentId, studentForm) {
  const formData = new FormData();
  formData.append("full_name", studentForm.full_name.trim());
  formData.append("email", studentForm.email.trim());
  formData.append("phone_number", studentForm.phone_number.trim());
  formData.append("role", studentForm.role);

  if (studentForm.password.trim()) {
    formData.append("password", studentForm.password.trim());
  }

  STUDENT_FACE_POSES.forEach((pose) => {
    if (studentForm.face_images?.[pose]) {
      formData.append(`face_image_${pose}`, studentForm.face_images[pose]);
    }
  });

  return fetchAdminApi(
    `/students/${studentId}`,
    adminToken,
    "Could not update the student.",
    {
      method: "PUT",
      body: formData,
    },
  );
}

export function deleteStudentRecord(adminToken, studentId) {
  return fetchAdminApi(
    `/students/${studentId}`,
    adminToken,
    "Could not delete the student.",
    {
      method: "DELETE",
    },
  );
}

export function updateAttendanceRecord(adminToken, recordId, status) {
  const formData = new FormData();
  formData.append("status", status);

  return fetchAdminApi(
    `/attendance/${recordId}`,
    adminToken,
    "Could not update the attendance record.",
    {
      method: "PUT",
      body: formData,
    },
  );
}

export function deleteAttendanceRecord(adminToken, recordId) {
  return fetchAdminApi(
    `/attendance/${recordId}`,
    adminToken,
    "Could not delete the attendance record.",
    {
      method: "DELETE",
    },
  );
}

export async function exportAttendanceCsv(adminToken, filters) {
  const [sortBy, sortDirection] = filters.sortOrder.split(":");
  const queryString = buildQueryString({
    search: filters.search.trim(),
    status: filters.status === "all" ? null : filters.status,
    student_id: filters.studentId === "all" ? null : filters.studentId,
    date_from: filters.dateFrom || null,
    date_to: filters.dateTo || null,
    sort_by: sortBy,
    sort_direction: sortDirection,
  });

  const response = await fetch(buildApiUrl(`/attendance/export${queryString}`), {
    headers: getAdminAuthHeaders(adminToken),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(
      data.detail || data.message || "Could not export the attendance report.",
    );
  }

  return {
    blob: await response.blob(),
    fileName: buildAttendanceExportFileName(filters),
  };
}

export function updateLeaveRequest(adminToken, requestId, status) {
  const formData = new FormData();
  formData.append("status", status);

  return fetchAdminApi(
    `/leave-requests/${requestId}`,
    adminToken,
    "Could not update the leave request.",
    {
      method: "PUT",
      body: formData,
    },
  );
}

export function deleteLeaveRequestRecord(adminToken, requestId) {
  return fetchAdminApi(
    `/leave-requests/${requestId}`,
    adminToken,
    "Could not delete the leave request.",
    {
      method: "DELETE",
    },
  );
}

export async function logoutAdmin(adminToken) {
  if (!adminToken) {
    return;
  }

  await fetch(buildApiUrl("/logout/admin"), {
    method: "POST",
    headers: getAdminAuthHeaders(adminToken),
  });
}
