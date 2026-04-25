"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";

import {
  buildApiUrl,
  buildAssetUrl,
  buildQueryString,
  getAdminAuthHeaders,
  parseApiResponse,
} from "@/app/lib/api";

function createStudentForm(student = {}) {
  return {
    full_name: student.full_name || "",
    email: student.email || "",
    password: "",
    face_image: null,
  };
}

function createFilterState() {
  return {
    search: "",
    status: "all",
    studentId: "all",
    date: "",
  };
}

function createLeaveFilterState() {
  return {
    search: "",
    status: "all",
  };
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Could not preview the selected image."));
    reader.readAsDataURL(file);
  });
}

function formatDateTime(value) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleString();
}

function formatDate(value) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleDateString();
}

function formatPercent(value) {
  return `${Math.round(value)}%`;
}

function capitalizeWords(value) {
  if (!value) {
    return "";
  }

  return value
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function buildAttendanceExportFileName(filters) {
  const nameParts = ["attendance_report", filters.date || "all_dates"];

  if (filters.status !== "all") {
    nameParts.push(filters.status);
  }

  if (filters.studentId !== "all") {
    nameParts.push(`student_${filters.studentId}`);
  }

  return `${nameParts.join("_")}.csv`;
}

function getBannerClass(type) {
  if (type === "error") {
    return "border border-red-200 bg-red-50 text-red-700";
  }

  if (type === "success") {
    return "border border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  return "border border-blue-200 bg-blue-50 text-blue-700";
}

function getStatusPillClass(status) {
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

function PhotoPreviewCard({
  title,
  subtitle,
  imageUrl,
  fallbackLabel,
}) {
  return (
    <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
        {title}
      </p>
      <p className="mt-1 text-sm text-slate-600">{subtitle}</p>

      {imageUrl ? (
        <div
          role="img"
          aria-label={title}
          className="mt-4 h-52 rounded-[1.25rem] border border-slate-200 bg-cover bg-center shadow-inner"
          style={{ backgroundImage: `url(${imageUrl})` }}
        />
      ) : (
        <div className="mt-4 flex h-52 items-center justify-center rounded-[1.25rem] border border-dashed border-slate-300 bg-white text-center text-sm text-slate-400">
          {fallbackLabel}
        </div>
      )}
    </div>
  );
}

function SidebarButton({ label, sectionId, accentClass }) {
  return (
    <button
      type="button"
      onClick={() =>
        document
          .getElementById(sectionId)
          ?.scrollIntoView({ behavior: "smooth", block: "start" })
      }
      className={`w-full rounded-2xl px-4 py-3 text-left text-sm font-medium transition hover:translate-x-1 ${accentClass}`}
    >
      {label}
    </button>
  );
}

function EditStudentModal({
  student,
  form,
  previewUrl,
  isSaving,
  onClose,
  onFieldChange,
  onImageChange,
  onSubmit,
}) {
  if (!student) {
    return null;
  }

  const currentPhotoUrl = buildAssetUrl(student.face_image_url);
  const visiblePhotoUrl = previewUrl || currentPhotoUrl;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 px-4 py-8">
      <div className="max-h-full w-full max-w-4xl overflow-y-auto rounded-[2rem] border border-white/10 bg-white shadow-[0_35px_120px_rgba(15,23,42,0.35)]">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.32em] text-blue-700">
              Edit Student
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-900">
              {student.full_name}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Student ID #{student.student_id}. Update details and preview the face image before
              saving.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
          >
            Close
          </button>
        </div>

        <div className="grid gap-6 px-6 py-6 lg:grid-cols-[0.88fr,1.12fr]">
          <PhotoPreviewCard
            title="Face Preview"
            subtitle="Current student photo or the new uploaded replacement."
            imageUrl={visiblePhotoUrl}
            fallbackLabel="No face image is stored for this student yet."
          />

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Full Name
              </label>
              <input
                type="text"
                value={form.full_name}
                onChange={(event) => onFieldChange("full_name", event.target.value)}
                className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 outline-none transition focus:border-blue-500 focus:bg-white"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Email
              </label>
              <input
                type="email"
                value={form.email}
                onChange={(event) => onFieldChange("email", event.target.value)}
                className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 outline-none transition focus:border-blue-500 focus:bg-white"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Password
              </label>
              <input
                type="password"
                value={form.password}
                onChange={(event) => onFieldChange("password", event.target.value)}
                placeholder="Leave blank to keep the existing password"
                className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 outline-none transition focus:border-blue-500 focus:bg-white"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Replace Face Image
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={onImageChange}
                className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm outline-none transition file:mr-4 file:rounded-xl file:border-0 file:bg-slate-900 file:px-3 file:py-2 file:text-white hover:file:bg-slate-700"
              />
              <p className="mt-2 text-xs text-slate-500">
                Upload a new image only if you want to update the stored face profile.
              </p>
            </div>

            <div className="grid gap-4 rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4 md:grid-cols-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                  Student Email
                </p>
                <p className="mt-2 text-sm text-slate-700">{student.email || "Not provided"}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                  Registered
                </p>
                <p className="mt-2 text-sm text-slate-700">{formatDateTime(student.created_at)}</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3 pt-2">
              <button
                type="submit"
                disabled={isSaving}
                className="rounded-2xl bg-blue-600 px-5 py-3 font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
              >
                {isSaving ? "Saving Changes..." : "Save Changes"}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-2xl border border-slate-300 px-5 py-3 font-medium text-slate-700 transition hover:bg-slate-100"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

const DEFAULT_ADMIN_SESSION = {
  token: "",
  username: "admin",
};

function subscribeToSessionStore() {
  return () => {};
}

function getClientReadySnapshot() {
  return true;
}

function getServerReadySnapshot() {
  return false;
}

function getAdminSessionFromStorage() {
  if (typeof window === "undefined") {
    return DEFAULT_ADMIN_SESSION;
  }

  return {
    token: localStorage.getItem("admin_token") || "",
    username: localStorage.getItem("admin_username") || "admin",
  };
}

export default function AdminPage() {
  const router = useRouter();
  const sessionReady = useSyncExternalStore(
    subscribeToSessionStore,
    getClientReadySnapshot,
    getServerReadySnapshot,
  );
  const adminSession = sessionReady
    ? getAdminSessionFromStorage()
    : DEFAULT_ADMIN_SESSION;

  const [students, setStudents] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [studentForm, setStudentForm] = useState(createStudentForm());
  const [studentPreviewUrl, setStudentPreviewUrl] = useState("");
  const [editModalStudent, setEditModalStudent] = useState(null);
  const [editStudentForm, setEditStudentForm] = useState(createStudentForm());
  const [editStudentPreviewUrl, setEditStudentPreviewUrl] = useState("");
  const [studentSearch, setStudentSearch] = useState("");
  const [studentSortField, setStudentSortField] = useState("full_name");
  const [studentSortDirection, setStudentSortDirection] = useState("asc");
  const [attendanceFilters, setAttendanceFilters] = useState(createFilterState());
  const [leaveFilters, setLeaveFilters] = useState(createLeaveFilterState());
  const [studentMessage, setStudentMessage] = useState(null);
  const [attendanceMessage, setAttendanceMessage] = useState(null);
  const [leaveMessage, setLeaveMessage] = useState(null);
  const [dashboardError, setDashboardError] = useState("");
  const [isLoadingDashboard, setIsLoadingDashboard] = useState(true);
  const [isSavingStudent, setIsSavingStudent] = useState(false);
  const [isSavingEditStudent, setIsSavingEditStudent] = useState(false);
  const [deletingStudentId, setDeletingStudentId] = useState(null);
  const [attendanceDrafts, setAttendanceDrafts] = useState({});
  const [updatingAttendanceId, setUpdatingAttendanceId] = useState(null);
  const [deletingAttendanceId, setDeletingAttendanceId] = useState(null);
  const [isExportingAttendance, setIsExportingAttendance] = useState(false);
  const [leaveDrafts, setLeaveDrafts] = useState({});
  const [updatingLeaveId, setUpdatingLeaveId] = useState(null);
  const [deletingLeaveId, setDeletingLeaveId] = useState(null);

  const adminHeaders = getAdminAuthHeaders(adminSession.token);
  const totalPendingLeaveRequests = leaveRequests.filter(
    (leaveRequest) => leaveRequest.status === "pending",
  ).length;

  async function fetchStudents() {
    const response = await fetch(buildApiUrl("/students"), {
      headers: adminHeaders,
    });
    const data = await parseApiResponse(response, "Could not load students.");
    setStudents(data);
    return data;
  }

  async function fetchAttendance() {
    const response = await fetch(buildApiUrl("/attendance"), {
      headers: adminHeaders,
    });
    const data = await parseApiResponse(response, "Could not load attendance.");
    setAttendance(data);
    return data;
  }

  async function fetchLeaveRequests() {
    const response = await fetch(buildApiUrl("/leave-requests"), {
      headers: adminHeaders,
    });
    const data = await parseApiResponse(response, "Could not load leave requests.");
    setLeaveRequests(data);
    return data;
  }

  async function loadDashboard() {
    setIsLoadingDashboard(true);
    setDashboardError("");

    try {
      await Promise.all([fetchStudents(), fetchAttendance(), fetchLeaveRequests()]);
    } catch (error) {
      setDashboardError(error.message || "Could not load the admin dashboard.");

      if ((error.message || "").toLowerCase().includes("admin")) {
        localStorage.removeItem("admin_token");
        localStorage.removeItem("admin_username");
        router.replace("/");
      }
    } finally {
      setIsLoadingDashboard(false);
    }
  }

  useEffect(() => {
    if (!sessionReady) {
      return undefined;
    }

    if (!adminSession.token) {
      router.replace("/");
      return undefined;
    }

    let isActive = true;

    async function loadInitialDashboard() {
      try {
        const headers = getAdminAuthHeaders(adminSession.token);
        const [studentData, attendanceData, leaveRequestData] = await Promise.all([
          fetch(buildApiUrl("/students"), { headers }).then((response) =>
            parseApiResponse(response, "Could not load students."),
          ),
          fetch(buildApiUrl("/attendance"), { headers }).then((response) =>
            parseApiResponse(response, "Could not load attendance."),
          ),
          fetch(buildApiUrl("/leave-requests"), { headers }).then((response) =>
            parseApiResponse(response, "Could not load leave requests."),
          ),
        ]);

        if (!isActive) {
          return;
        }

        setStudents(studentData);
        setAttendance(attendanceData);
        setLeaveRequests(leaveRequestData);
        setDashboardError("");
      } catch (error) {
        if (!isActive) {
          return;
        }

        setDashboardError(error.message || "Could not load the admin dashboard.");

        if ((error.message || "").toLowerCase().includes("admin")) {
          localStorage.removeItem("admin_token");
          localStorage.removeItem("admin_username");
          router.replace("/");
        }
      } finally {
        if (isActive) {
          setIsLoadingDashboard(false);
        }
      }
    }

    loadInitialDashboard();

    return () => {
      isActive = false;
    };
  }, [adminSession.token, router, sessionReady]);

  async function handleStudentImageChange(event) {
    const selectedFile = event.target.files?.[0] || null;

    setStudentForm((current) => ({
      ...current,
      face_image: selectedFile,
    }));

    if (!selectedFile) {
      setStudentPreviewUrl("");
      return;
    }

    try {
      setStudentPreviewUrl(await fileToDataUrl(selectedFile));
    } catch (error) {
      setStudentMessage({
        type: "error",
        message: error.message || "Could not preview the selected image.",
      });
    }
  }

  async function handleEditImageChange(event) {
    const selectedFile = event.target.files?.[0] || null;

    setEditStudentForm((current) => ({
      ...current,
      face_image: selectedFile,
    }));

    if (!selectedFile) {
      setEditStudentPreviewUrl("");
      return;
    }

    try {
      setEditStudentPreviewUrl(await fileToDataUrl(selectedFile));
    } catch (error) {
      setStudentMessage({
        type: "error",
        message: error.message || "Could not preview the selected image.",
      });
    }
  }

  function resetStudentForm() {
    setStudentForm(createStudentForm());
    setStudentPreviewUrl("");
  }

  function openEditModal(student) {
    setEditModalStudent(student);
    setEditStudentForm(createStudentForm(student));
    setEditStudentPreviewUrl("");
  }

  function closeEditModal() {
    setEditModalStudent(null);
    setEditStudentForm(createStudentForm());
    setEditStudentPreviewUrl("");
  }

  async function handleRegisterStudent(event) {
    event.preventDefault();

    if (!studentForm.full_name.trim()) {
      setStudentMessage({ type: "error", message: "Student name is required." });
      return;
    }

    if (!studentForm.password.trim()) {
      setStudentMessage({ type: "error", message: "Password is required." });
      return;
    }

    if (!studentForm.face_image) {
      setStudentMessage({
        type: "error",
        message: "Please upload a face image before registering the student.",
      });
      return;
    }

    setIsSavingStudent(true);
    setStudentMessage(null);

    const formData = new FormData();
    formData.append("full_name", studentForm.full_name.trim());
    formData.append("email", studentForm.email.trim());
    formData.append("password", studentForm.password.trim());
    formData.append("face_image", studentForm.face_image);

    try {
      const response = await fetch(buildApiUrl("/students/register"), {
        method: "POST",
        headers: adminHeaders,
        body: formData,
      });

      const data = await parseApiResponse(
        response,
        "Could not register the student.",
      );

      await fetchStudents();
      resetStudentForm();
      setStudentMessage({
        type: "success",
        message: data.message || "Student registered successfully.",
      });
    } catch (error) {
      setStudentMessage({
        type: "error",
        message: error.message || "Could not register the student.",
      });
    } finally {
      setIsSavingStudent(false);
    }
  }

  async function handleEditStudent(event) {
    event.preventDefault();

    if (!editModalStudent) {
      return;
    }

    if (!editStudentForm.full_name.trim()) {
      setStudentMessage({ type: "error", message: "Student name is required." });
      return;
    }

    setIsSavingEditStudent(true);
    setStudentMessage(null);

    const formData = new FormData();
    formData.append("full_name", editStudentForm.full_name.trim());
    formData.append("email", editStudentForm.email.trim());

    if (editStudentForm.password.trim()) {
      formData.append("password", editStudentForm.password.trim());
    }

    if (editStudentForm.face_image) {
      formData.append("face_image", editStudentForm.face_image);
    }

    try {
      const response = await fetch(
        buildApiUrl(`/students/${editModalStudent.student_id}`),
        {
          method: "PUT",
          headers: adminHeaders,
          body: formData,
        },
      );

      const data = await parseApiResponse(
        response,
        "Could not update the student.",
      );

      await fetchStudents();
      closeEditModal();
      setStudentMessage({
        type: "success",
        message: data.message || "Student updated successfully.",
      });
    } catch (error) {
      setStudentMessage({
        type: "error",
        message: error.message || "Could not update the student.",
      });
    } finally {
      setIsSavingEditStudent(false);
    }
  }

  async function handleDeleteStudent(student) {
    const confirmed = window.confirm(
      `Delete ${student.full_name}? This will also remove that student's attendance and leave records.`,
    );

    if (!confirmed) {
      return;
    }

    setDeletingStudentId(student.student_id);
    setStudentMessage(null);

    try {
      const response = await fetch(buildApiUrl(`/students/${student.student_id}`), {
        method: "DELETE",
        headers: adminHeaders,
      });

      const data = await parseApiResponse(
        response,
        "Could not delete the student.",
      );

      if (editModalStudent?.student_id === student.student_id) {
        closeEditModal();
      }

      await Promise.all([fetchStudents(), fetchAttendance(), fetchLeaveRequests()]);
      setStudentMessage({
        type: "success",
        message: data.message || "Student deleted successfully.",
      });
    } catch (error) {
      setStudentMessage({
        type: "error",
        message: error.message || "Could not delete the student.",
      });
    } finally {
      setDeletingStudentId(null);
    }
  }

  async function handleUpdateAttendance(record) {
    const nextStatus = attendanceDrafts[record.id] || record.status;
    setUpdatingAttendanceId(record.id);
    setAttendanceMessage(null);

    const formData = new FormData();
    formData.append("status", nextStatus);

    try {
      const response = await fetch(buildApiUrl(`/attendance/${record.id}`), {
        method: "PUT",
        headers: adminHeaders,
        body: formData,
      });

      const data = await parseApiResponse(
        response,
        "Could not update the attendance record.",
      );

      await fetchAttendance();
      setAttendanceMessage({
        type: "success",
        message: data.message || "Attendance updated successfully.",
      });
    } catch (error) {
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
      const response = await fetch(buildApiUrl(`/attendance/${record.id}`), {
        method: "DELETE",
        headers: adminHeaders,
      });

      const data = await parseApiResponse(
        response,
        "Could not delete the attendance record.",
      );

      await fetchAttendance();
      setAttendanceMessage({
        type: "success",
        message: data.message || "Attendance deleted successfully.",
      });
    } catch (error) {
      setAttendanceMessage({
        type: "error",
        message: error.message || "Could not delete the attendance record.",
      });
    } finally {
      setDeletingAttendanceId(null);
    }
  }

  async function handleExportAttendanceCsv() {
    setIsExportingAttendance(true);
    setAttendanceMessage(null);

    try {
      const queryString = buildQueryString({
        search: attendanceFilters.search.trim(),
        status: attendanceFilters.status === "all" ? null : attendanceFilters.status,
        student_id:
          attendanceFilters.studentId === "all" ? null : attendanceFilters.studentId,
        date: attendanceFilters.date || null,
      });
      const response = await fetch(buildApiUrl(`/attendance/export${queryString}`), {
        headers: adminHeaders,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.detail || errorData.message || "Could not export the attendance report.",
        );
      }

      const csvBlob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(csvBlob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = buildAttendanceExportFileName(attendanceFilters);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);

      setAttendanceMessage({
        type: "success",
        message: "Attendance CSV exported successfully.",
      });
    } catch (error) {
      setAttendanceMessage({
        type: "error",
        message: error.message || "Could not export the attendance report.",
      });
    } finally {
      setIsExportingAttendance(false);
    }
  }

  async function handleUpdateLeaveRequest(leaveRequest) {
    const nextStatus = leaveDrafts[leaveRequest.id] || leaveRequest.status;
    setUpdatingLeaveId(leaveRequest.id);
    setLeaveMessage(null);

    const formData = new FormData();
    formData.append("status", nextStatus);

    try {
      const response = await fetch(
        buildApiUrl(`/leave-requests/${leaveRequest.id}`),
        {
          method: "PUT",
          headers: adminHeaders,
          body: formData,
        },
      );

      const data = await parseApiResponse(
        response,
        "Could not update the leave request.",
      );

      await fetchLeaveRequests();
      setLeaveMessage({
        type: "success",
        message: data.message || "Leave request updated successfully.",
      });
    } catch (error) {
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
      const response = await fetch(
        buildApiUrl(`/leave-requests/${leaveRequest.id}`),
        {
          method: "DELETE",
          headers: adminHeaders,
        },
      );

      const data = await parseApiResponse(
        response,
        "Could not delete the leave request.",
      );

      await fetchLeaveRequests();
      setLeaveMessage({
        type: "success",
        message: data.message || "Leave request deleted successfully.",
      });
    } catch (error) {
      setLeaveMessage({
        type: "error",
        message: error.message || "Could not delete the leave request.",
      });
    } finally {
      setDeletingLeaveId(null);
    }
  }

  async function logout() {
    try {
      await fetch(buildApiUrl("/logout/admin"), {
        method: "POST",
        headers: adminHeaders,
      });
    } catch {
      // Best effort logout.
    }

    localStorage.removeItem("admin_token");
    localStorage.removeItem("admin_username");
    router.push("/");
  }

  const filteredStudents = students.filter((student) =>
    `${student.student_id} ${student.full_name} ${student.email || ""}`
      .toLowerCase()
      .includes(studentSearch.toLowerCase()),
  );

  const sortedStudents = [...filteredStudents].sort((leftStudent, rightStudent) => {
    let leftValue = leftStudent[studentSortField];
    let rightValue = rightStudent[studentSortField];

    if (studentSortField === "student_id") {
      leftValue = leftStudent.student_id;
      rightValue = rightStudent.student_id;
    }

    if (studentSortField === "created_at") {
      leftValue = new Date(leftStudent.created_at).getTime();
      rightValue = new Date(rightStudent.created_at).getTime();
    }

    if (typeof leftValue === "string" || typeof rightValue === "string") {
      leftValue = String(leftValue || "").toLowerCase();
      rightValue = String(rightValue || "").toLowerCase();
    }

    if (leftValue < rightValue) {
      return studentSortDirection === "asc" ? -1 : 1;
    }

    if (leftValue > rightValue) {
      return studentSortDirection === "asc" ? 1 : -1;
    }

    return 0;
  });

  const filteredAttendance = attendance.filter((record) => {
    const matchesSearch = `${record.student_name} ${record.student_id} ${record.status}`
      .toLowerCase()
      .includes(attendanceFilters.search.toLowerCase());
    const matchesStatus =
      attendanceFilters.status === "all" || record.status === attendanceFilters.status;
    const matchesStudent =
      attendanceFilters.studentId === "all" ||
      String(record.student_id) === attendanceFilters.studentId;
    const matchesDate =
      !attendanceFilters.date ||
      new Date(record.marked_at).toISOString().slice(0, 10) === attendanceFilters.date;

    return matchesSearch && matchesStatus && matchesStudent && matchesDate;
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

    const reportDateKey = new Date(record.marked_at).toISOString().slice(0, 10);
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

  const filteredLeaveRequests = leaveRequests.filter((leaveRequest) => {
    const matchesSearch = `${leaveRequest.student_name} ${leaveRequest.reason} ${leaveRequest.start_date} ${leaveRequest.end_date}`
      .toLowerCase()
      .includes(leaveFilters.search.toLowerCase());
    const matchesStatus =
      leaveFilters.status === "all" || leaveRequest.status === leaveFilters.status;

    return matchesSearch && matchesStatus;
  });

  if (!sessionReady) {
    return (
      <main className="min-h-screen bg-[linear-gradient(135deg,#eff6ff_0%,#f8fafc_55%,#fef3c7_100%)] px-4 py-6 text-slate-900 md:px-6">
        <div className="mx-auto flex min-h-[80vh] max-w-7xl items-center justify-center">
          <div className="rounded-[2rem] border border-white/70 bg-white/85 px-8 py-10 text-center shadow-[0_25px_80px_rgba(15,23,42,0.08)] backdrop-blur">
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-blue-700">
              WhosHere
            </p>
            <h1 className="mt-3 text-3xl font-semibold">Loading admin dashboard...</h1>
          </div>
        </div>
      </main>
    );
  }

  return (
    <>
      <main className="min-h-screen bg-[linear-gradient(135deg,#eff6ff_0%,#f8fafc_55%,#fef3c7_100%)] px-4 py-6 text-slate-900 md:px-6">
        <div className="mx-auto grid max-w-7xl gap-6 xl:grid-cols-[18rem,1fr]">
          <aside className="h-fit rounded-[2rem] border border-white/60 bg-slate-950 p-6 text-white shadow-[0_30px_120px_rgba(15,23,42,0.25)] xl:sticky xl:top-6">
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-amber-300">
              Admin Workspace
            </p>
            <h1 className="mt-4 text-3xl font-semibold">WhosHere</h1>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              Signed in as <span className="font-semibold text-white">{adminSession.username}</span>.
            </p>

            <div className="mt-8 space-y-3">
              <SidebarButton
                label="Overview"
                sectionId="overview-section"
                accentClass="bg-white/8 text-white"
              />
              <SidebarButton
                label="Register Student"
                sectionId="register-section"
                accentClass="bg-blue-500/15 text-blue-100"
              />
              <SidebarButton
                label="Student Directory"
                sectionId="directory-section"
                accentClass="bg-emerald-500/15 text-emerald-100"
              />
              <SidebarButton
                label="Attendance Control"
                sectionId="attendance-section"
                accentClass="bg-amber-500/15 text-amber-100"
              />
              <SidebarButton
                label="Leave Requests"
                sectionId="leave-section"
                accentClass="bg-sky-500/15 text-sky-100"
              />
            </div>

            <button
              type="button"
              onClick={logout}
              className="mt-8 w-full rounded-2xl bg-red-600 px-4 py-3 font-medium text-white transition hover:bg-red-700"
            >
              Logout
            </button>
          </aside>

          <div className="space-y-6">
            <section
              id="overview-section"
              className="rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-[0_25px_80px_rgba(15,23,42,0.08)] backdrop-blur"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.28em] text-blue-700">
                    Dashboard Overview
                  </p>
                  <h2 className="mt-3 text-4xl font-semibold">Admin control with live student data</h2>
                  <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
                    Manage students, prevent duplicate attendance, review leave requests, and
                    correct attendance records from one place.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={loadDashboard}
                  className="rounded-2xl bg-slate-900 px-5 py-3 font-medium text-white transition hover:bg-slate-700"
                >
                  Refresh Dashboard
                </button>
              </div>

              {dashboardError ? (
                <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {dashboardError}
                </div>
              ) : null}

              <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-[1.6rem] border border-slate-200 bg-slate-50 p-5">
                  <p className="text-sm text-slate-500">Registered Students</p>
                  <p className="mt-3 text-3xl font-semibold">{students.length}</p>
                </div>
                <div className="rounded-[1.6rem] border border-slate-200 bg-slate-50 p-5">
                  <p className="text-sm text-slate-500">Attendance Entries</p>
                  <p className="mt-3 text-3xl font-semibold">{attendance.length}</p>
                </div>
                <div className="rounded-[1.6rem] border border-slate-200 bg-slate-50 p-5">
                  <p className="text-sm text-slate-500">Pending Leave Requests</p>
                  <p className="mt-3 text-3xl font-semibold">{totalPendingLeaveRequests}</p>
                </div>
                <div className="rounded-[1.6rem] border border-slate-200 bg-slate-50 p-5">
                  <p className="text-sm text-slate-500">Dashboard Status</p>
                  <p className="mt-3 text-3xl font-semibold">
                    {isLoadingDashboard ? "Loading" : "Ready"}
                  </p>
                </div>
              </div>
            </section>

            <section
              id="register-section"
              className="rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-[0_25px_80px_rgba(15,23,42,0.08)] backdrop-blur"
            >
              <div className="grid gap-6 lg:grid-cols-[1.08fr,0.92fr]">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.28em] text-emerald-700">
                    Student Enrollment
                  </p>
                  <h2 className="mt-3 text-3xl font-semibold">Register a new student</h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                    Create a student account, upload a face image, and immediately preview the
                    image before saving.
                  </p>

                  {studentMessage ? (
                    <div className={`mt-5 rounded-2xl px-4 py-3 text-sm ${getBannerClass(studentMessage.type)}`}>
                      {studentMessage.message}
                    </div>
                  ) : null}

                  <form onSubmit={handleRegisterStudent} className="mt-6 space-y-4">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">
                        Full Name
                      </label>
                      <input
                        type="text"
                        value={studentForm.full_name}
                        onChange={(event) =>
                          setStudentForm((current) => ({
                            ...current,
                            full_name: event.target.value,
                          }))
                        }
                        placeholder="Enter the student's full name"
                        className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 outline-none transition focus:border-emerald-500 focus:bg-white"
                      />
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <label className="mb-2 block text-sm font-medium text-slate-700">
                          Email
                        </label>
                        <input
                          type="email"
                          value={studentForm.email}
                          onChange={(event) =>
                            setStudentForm((current) => ({
                              ...current,
                              email: event.target.value,
                            }))
                          }
                          placeholder="student@example.com"
                          className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 outline-none transition focus:border-emerald-500 focus:bg-white"
                        />
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-medium text-slate-700">
                          Password
                        </label>
                        <input
                          type="password"
                          value={studentForm.password}
                          onChange={(event) =>
                            setStudentForm((current) => ({
                              ...current,
                              password: event.target.value,
                            }))
                          }
                          placeholder="Create a secure password"
                          className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 outline-none transition focus:border-emerald-500 focus:bg-white"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">
                        Face Image
                      </label>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleStudentImageChange}
                        className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm outline-none transition file:mr-4 file:rounded-xl file:border-0 file:bg-slate-900 file:px-3 file:py-2 file:text-white hover:file:bg-slate-700"
                      />
                      <p className="mt-2 text-xs text-slate-500">
                        Upload a clear front-facing photo so the recognition model can match it reliably.
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-3 pt-2">
                      <button
                        type="submit"
                        disabled={isSavingStudent}
                        className="rounded-2xl bg-emerald-600 px-5 py-3 font-medium text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-300"
                      >
                        {isSavingStudent ? "Registering..." : "Register Student"}
                      </button>

                      <button
                        type="button"
                        onClick={resetStudentForm}
                        className="rounded-2xl border border-slate-300 px-5 py-3 font-medium text-slate-700 transition hover:bg-slate-100"
                      >
                        Clear Form
                      </button>
                    </div>
                  </form>
                </div>

                <div className="grid gap-4">
                  <PhotoPreviewCard
                    title="Upload Preview"
                    subtitle="The selected face image appears here before you register the student."
                    imageUrl={studentPreviewUrl}
                    fallbackLabel="Upload a student image to preview it here."
                  />

                  <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                      Enrollment Tips
                    </p>
                    <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
                      <li>Use one clear face per photo with good lighting.</li>
                      <li>Passwords are hashed on the backend before storage.</li>
                      <li>Duplicate student emails are blocked automatically.</li>
                    </ul>
                  </div>
                </div>
              </div>
            </section>

            <section
              id="directory-section"
              className="rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-[0_25px_80px_rgba(15,23,42,0.08)] backdrop-blur"
            >
              <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.28em] text-sky-700">
                    Student Directory
                  </p>
                  <h2 className="mt-3 text-3xl font-semibold">View, sort, edit, and delete students</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Sort the directory in ascending or descending order and open the edit popup to
                    review each student photo and detail set.
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <input
                    type="text"
                    placeholder="Search students..."
                    value={studentSearch}
                    onChange={(event) => setStudentSearch(event.target.value)}
                    className="rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 outline-none transition focus:border-sky-500 focus:bg-white"
                  />

                  <select
                    value={studentSortField}
                    onChange={(event) => setStudentSortField(event.target.value)}
                    className="rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 outline-none transition focus:border-sky-500 focus:bg-white"
                  >
                    <option value="full_name">Sort by Name</option>
                    <option value="student_id">Sort by ID</option>
                    <option value="email">Sort by Email</option>
                    <option value="created_at">Sort by Created Date</option>
                  </select>

                  <select
                    value={studentSortDirection}
                    onChange={(event) => setStudentSortDirection(event.target.value)}
                    className="rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 outline-none transition focus:border-sky-500 focus:bg-white"
                  >
                    <option value="asc">Ascending</option>
                    <option value="desc">Descending</option>
                  </select>
                </div>
              </div>

              <div className="mt-6 overflow-x-auto rounded-[1.5rem] border border-slate-200">
                <table className="w-full min-w-[70rem] text-sm">
                  <thead className="bg-slate-100 text-left">
                    <tr>
                      <th className="border-b border-slate-200 p-3">Photo</th>
                      <th className="border-b border-slate-200 p-3">ID</th>
                      <th className="border-b border-slate-200 p-3">Name</th>
                      <th className="border-b border-slate-200 p-3">Email</th>
                      <th className="border-b border-slate-200 p-3">Registered</th>
                      <th className="border-b border-slate-200 p-3">Actions</th>
                    </tr>
                  </thead>

                  <tbody>
                    {sortedStudents.length === 0 ? (
                      <tr>
                        <td className="p-4 text-slate-500" colSpan="6">
                          No students matched the current search and sort settings.
                        </td>
                      </tr>
                    ) : (
                      sortedStudents.map((student) => {
                        const photoUrl = buildAssetUrl(student.face_image_url);

                        return (
                          <tr key={student.student_id} className="odd:bg-white even:bg-slate-50">
                            <td className="border-b border-slate-100 p-3">
                              {photoUrl ? (
                                <div
                                  role="img"
                                  aria-label={`${student.full_name} face preview`}
                                  className="h-14 w-14 rounded-2xl border border-slate-200 bg-cover bg-center"
                                  style={{ backgroundImage: `url(${photoUrl})` }}
                                />
                              ) : (
                                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white text-[11px] text-slate-400">
                                  No image
                                </div>
                              )}
                            </td>
                            <td className="border-b border-slate-100 p-3 font-medium">
                              {student.student_id}
                            </td>
                            <td className="border-b border-slate-100 p-3">{student.full_name}</td>
                            <td className="border-b border-slate-100 p-3">
                              {student.email || "-"}
                            </td>
                            <td className="border-b border-slate-100 p-3">
                              {formatDateTime(student.created_at)}
                            </td>
                            <td className="border-b border-slate-100 p-3">
                              <div className="flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  onClick={() => openEditModal(student)}
                                  className="rounded-xl bg-blue-600 px-3 py-2 text-white transition hover:bg-blue-700"
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteStudent(student)}
                                  disabled={deletingStudentId === student.student_id}
                                  className="rounded-xl bg-red-600 px-3 py-2 text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-red-300"
                                >
                                  {deletingStudentId === student.student_id ? "Deleting..." : "Delete"}
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section
              id="attendance-section"
              className="rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-[0_25px_80px_rgba(15,23,42,0.08)] backdrop-blur"
            >
              <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.28em] text-amber-700">
                    Attendance Control
                  </p>
                  <h2 className="mt-3 text-3xl font-semibold">Filter, correct, and remove attendance</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Search by student, narrow by date or status, then update or delete incorrect
                    attendance records.
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <input
                    type="text"
                    placeholder="Search attendance..."
                    value={attendanceFilters.search}
                    onChange={(event) =>
                      setAttendanceFilters((current) => ({
                        ...current,
                        search: event.target.value,
                      }))
                    }
                    className="rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 outline-none transition focus:border-amber-500 focus:bg-white"
                  />

                  <select
                    value={attendanceFilters.status}
                    onChange={(event) =>
                      setAttendanceFilters((current) => ({
                        ...current,
                        status: event.target.value,
                      }))
                    }
                    className="rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 outline-none transition focus:border-amber-500 focus:bg-white"
                  >
                    <option value="all">All Statuses</option>
                    <option value="present">Present</option>
                    <option value="late">Late</option>
                    <option value="absent">Absent</option>
                    <option value="excused">Excused</option>
                  </select>

                  <select
                    value={attendanceFilters.studentId}
                    onChange={(event) =>
                      setAttendanceFilters((current) => ({
                        ...current,
                        studentId: event.target.value,
                      }))
                    }
                    className="rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 outline-none transition focus:border-amber-500 focus:bg-white"
                  >
                    <option value="all">All Students</option>
                    {students.map((student) => (
                      <option key={student.student_id} value={String(student.student_id)}>
                        #{student.student_id} {student.full_name}
                      </option>
                    ))}
                  </select>

                  <input
                    type="date"
                    value={attendanceFilters.date}
                    onChange={(event) =>
                      setAttendanceFilters((current) => ({
                        ...current,
                        date: event.target.value,
                      }))
                    }
                    className="rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 outline-none transition focus:border-amber-500 focus:bg-white"
                  />
                </div>
              </div>

              {attendanceMessage ? (
                <div className={`mt-5 rounded-2xl px-4 py-3 text-sm ${getBannerClass(attendanceMessage.type)}`}>
                  {attendanceMessage.message}
                </div>
              ) : null}

              <div className="mt-6 rounded-[1.75rem] border border-amber-200 bg-amber-50/70 p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.28em] text-amber-700">
                      Attendance Report
                    </p>
                    <h3 className="mt-2 text-2xl font-semibold text-slate-900">
                      Live summary for the current filters
                    </h3>
                    <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                      Review the filtered attendance breakdown below, then export the same dataset
                      as CSV for your report, records, or presentation demo.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleExportAttendanceCsv}
                    disabled={isExportingAttendance}
                    className="rounded-2xl bg-amber-500 px-5 py-3 font-medium text-white transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:bg-amber-300"
                  >
                    {isExportingAttendance ? "Exporting CSV..." : "Export CSV Report"}
                  </button>
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-6">
                  <div className="rounded-[1.4rem] border border-amber-200 bg-white p-4">
                    <p className="text-sm text-slate-500">Filtered Records</p>
                    <p className="mt-3 text-3xl font-semibold text-slate-900">
                      {filteredAttendance.length}
                    </p>
                  </div>
                  <div className="rounded-[1.4rem] border border-amber-200 bg-white p-4">
                    <p className="text-sm text-slate-500">Unique Students</p>
                    <p className="mt-3 text-3xl font-semibold text-slate-900">
                      {attendanceUniqueStudents}
                    </p>
                  </div>
                  <div className="rounded-[1.4rem] border border-emerald-200 bg-white p-4">
                    <p className="text-sm text-slate-500">Present</p>
                    <p className="mt-3 text-3xl font-semibold text-emerald-700">
                      {attendanceStatusSummary.present}
                    </p>
                  </div>
                  <div className="rounded-[1.4rem] border border-amber-200 bg-white p-4">
                    <p className="text-sm text-slate-500">Late</p>
                    <p className="mt-3 text-3xl font-semibold text-amber-700">
                      {attendanceStatusSummary.late}
                    </p>
                  </div>
                  <div className="rounded-[1.4rem] border border-red-200 bg-white p-4">
                    <p className="text-sm text-slate-500">Absent</p>
                    <p className="mt-3 text-3xl font-semibold text-red-700">
                      {attendanceStatusSummary.absent}
                    </p>
                  </div>
                  <div className="rounded-[1.4rem] border border-sky-200 bg-white p-4">
                    <p className="text-sm text-slate-500">Coverage Rate</p>
                    <p className="mt-3 text-3xl font-semibold text-sky-700">
                      {formatPercent(attendanceCoverageRate)}
                    </p>
                  </div>
                </div>

                <div className="mt-6 grid gap-6 xl:grid-cols-2">
                  <div className="rounded-[1.5rem] border border-slate-200 bg-white p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                          Daily Breakdown
                        </p>
                        <p className="mt-2 text-sm text-slate-600">
                          Attendance totals grouped by marked date.
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 overflow-x-auto rounded-[1.25rem] border border-slate-200">
                      <table className="w-full min-w-[32rem] text-sm">
                        <thead className="bg-slate-100 text-left">
                          <tr>
                            <th className="border-b border-slate-200 p-3">Date</th>
                            <th className="border-b border-slate-200 p-3">Total</th>
                            <th className="border-b border-slate-200 p-3">Present</th>
                            <th className="border-b border-slate-200 p-3">Late</th>
                            <th className="border-b border-slate-200 p-3">Absent</th>
                            <th className="border-b border-slate-200 p-3">Excused</th>
                          </tr>
                        </thead>
                        <tbody>
                          {attendanceDailyReportRows.length === 0 ? (
                            <tr>
                              <td className="p-4 text-slate-500" colSpan="6">
                                No attendance records are available for this report.
                              </td>
                            </tr>
                          ) : (
                            attendanceDailyReportRows.map((row) => (
                              <tr key={row.date} className="odd:bg-white even:bg-slate-50">
                                <td className="border-b border-slate-100 p-3">
                                  {formatDate(row.date)}
                                </td>
                                <td className="border-b border-slate-100 p-3">{row.total}</td>
                                <td className="border-b border-slate-100 p-3">{row.present}</td>
                                <td className="border-b border-slate-100 p-3">{row.late}</td>
                                <td className="border-b border-slate-100 p-3">{row.absent}</td>
                                <td className="border-b border-slate-100 p-3">{row.excused}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="rounded-[1.5rem] border border-slate-200 bg-white p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                          Student Breakdown
                        </p>
                        <p className="mt-2 text-sm text-slate-600">
                          Per-student attendance totals for the current report.
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 overflow-x-auto rounded-[1.25rem] border border-slate-200">
                      <table className="w-full min-w-[42rem] text-sm">
                        <thead className="bg-slate-100 text-left">
                          <tr>
                            <th className="border-b border-slate-200 p-3">Student</th>
                            <th className="border-b border-slate-200 p-3">Total</th>
                            <th className="border-b border-slate-200 p-3">Present</th>
                            <th className="border-b border-slate-200 p-3">Late</th>
                            <th className="border-b border-slate-200 p-3">Absent</th>
                            <th className="border-b border-slate-200 p-3">Excused</th>
                            <th className="border-b border-slate-200 p-3">Last Marked</th>
                          </tr>
                        </thead>
                        <tbody>
                          {attendanceStudentReportRows.length === 0 ? (
                            <tr>
                              <td className="p-4 text-slate-500" colSpan="7">
                                No student attendance data is available for this report.
                              </td>
                            </tr>
                          ) : (
                            attendanceStudentReportRows.map((row) => (
                              <tr
                                key={row.student_id}
                                className="odd:bg-white even:bg-slate-50"
                              >
                                <td className="border-b border-slate-100 p-3">
                                  <div>
                                    <p className="font-medium text-slate-900">
                                      {row.student_name}
                                    </p>
                                    <p className="text-xs text-slate-500">
                                      ID #{row.student_id}
                                    </p>
                                  </div>
                                </td>
                                <td className="border-b border-slate-100 p-3">{row.total}</td>
                                <td className="border-b border-slate-100 p-3">{row.present}</td>
                                <td className="border-b border-slate-100 p-3">{row.late}</td>
                                <td className="border-b border-slate-100 p-3">{row.absent}</td>
                                <td className="border-b border-slate-100 p-3">{row.excused}</td>
                                <td className="border-b border-slate-100 p-3">
                                  {formatDateTime(row.latest_marked_at)}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 overflow-x-auto rounded-[1.5rem] border border-slate-200">
                <table className="w-full min-w-[78rem] text-sm">
                  <thead className="bg-slate-100 text-left">
                    <tr>
                      <th className="border-b border-slate-200 p-3">Student</th>
                      <th className="border-b border-slate-200 p-3">ID</th>
                      <th className="border-b border-slate-200 p-3">Current Status</th>
                      <th className="border-b border-slate-200 p-3">Marked At</th>
                      <th className="border-b border-slate-200 p-3">Edit Status</th>
                      <th className="border-b border-slate-200 p-3">Actions</th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredAttendance.length === 0 ? (
                      <tr>
                        <td className="p-4 text-slate-500" colSpan="6">
                          No attendance records matched the selected filters.
                        </td>
                      </tr>
                    ) : (
                      filteredAttendance.map((record) => (
                        <tr key={record.id} className="odd:bg-white even:bg-slate-50">
                          <td className="border-b border-slate-100 p-3">{record.student_name}</td>
                          <td className="border-b border-slate-100 p-3">{record.student_id}</td>
                          <td className="border-b border-slate-100 p-3">
                            <span
                              className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getStatusPillClass(record.status)}`}
                            >
                              {capitalizeWords(record.status)}
                            </span>
                          </td>
                          <td className="border-b border-slate-100 p-3">
                            {formatDateTime(record.marked_at)}
                          </td>
                          <td className="border-b border-slate-100 p-3">
                            <select
                              value={attendanceDrafts[record.id] || record.status}
                              onChange={(event) =>
                                setAttendanceDrafts((current) => ({
                                  ...current,
                                  [record.id]: event.target.value,
                                }))
                              }
                              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 outline-none transition focus:border-amber-500"
                            >
                              <option value="present">Present</option>
                              <option value="late">Late</option>
                              <option value="absent">Absent</option>
                              <option value="excused">Excused</option>
                            </select>
                          </td>
                          <td className="border-b border-slate-100 p-3">
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => handleUpdateAttendance(record)}
                                disabled={updatingAttendanceId === record.id}
                                className="rounded-xl bg-amber-500 px-3 py-2 text-white transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:bg-amber-300"
                              >
                                {updatingAttendanceId === record.id ? "Saving..." : "Save"}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteAttendance(record)}
                                disabled={deletingAttendanceId === record.id}
                                className="rounded-xl bg-red-600 px-3 py-2 text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-red-300"
                              >
                                {deletingAttendanceId === record.id ? "Deleting..." : "Delete"}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section
              id="leave-section"
              className="rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-[0_25px_80px_rgba(15,23,42,0.08)] backdrop-blur"
            >
              <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.28em] text-blue-700">
                    Leave Requests
                  </p>
                  <h2 className="mt-3 text-3xl font-semibold">Review and decide student leave requests</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Pending requests can be approved or rejected here, and old requests can be
                    removed if needed.
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <input
                    type="text"
                    placeholder="Search leave requests..."
                    value={leaveFilters.search}
                    onChange={(event) =>
                      setLeaveFilters((current) => ({
                        ...current,
                        search: event.target.value,
                      }))
                    }
                    className="rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 outline-none transition focus:border-blue-500 focus:bg-white"
                  />

                  <select
                    value={leaveFilters.status}
                    onChange={(event) =>
                      setLeaveFilters((current) => ({
                        ...current,
                        status: event.target.value,
                      }))
                    }
                    className="rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 outline-none transition focus:border-blue-500 focus:bg-white"
                  >
                    <option value="all">All Statuses</option>
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>
              </div>

              {leaveMessage ? (
                <div className={`mt-5 rounded-2xl px-4 py-3 text-sm ${getBannerClass(leaveMessage.type)}`}>
                  {leaveMessage.message}
                </div>
              ) : null}

              <div className="mt-6 overflow-x-auto rounded-[1.5rem] border border-slate-200">
                <table className="w-full min-w-[82rem] text-sm">
                  <thead className="bg-slate-100 text-left">
                    <tr>
                      <th className="border-b border-slate-200 p-3">Student</th>
                      <th className="border-b border-slate-200 p-3">Dates</th>
                      <th className="border-b border-slate-200 p-3">Days</th>
                      <th className="border-b border-slate-200 p-3">Reason</th>
                      <th className="border-b border-slate-200 p-3">Current Status</th>
                      <th className="border-b border-slate-200 p-3">Update Status</th>
                      <th className="border-b border-slate-200 p-3">Actions</th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredLeaveRequests.length === 0 ? (
                      <tr>
                        <td className="p-4 text-slate-500" colSpan="7">
                          No leave requests matched the current filters.
                        </td>
                      </tr>
                    ) : (
                      filteredLeaveRequests.map((leaveRequest) => (
                        <tr key={leaveRequest.id} className="odd:bg-white even:bg-slate-50">
                          <td className="border-b border-slate-100 p-3">
                            <div>
                              <p className="font-medium text-slate-900">{leaveRequest.student_name}</p>
                              <p className="text-xs text-slate-500">ID #{leaveRequest.student_id}</p>
                            </div>
                          </td>
                          <td className="border-b border-slate-100 p-3">
                            {formatDate(leaveRequest.start_date)} to {formatDate(leaveRequest.end_date)}
                          </td>
                          <td className="border-b border-slate-100 p-3">
                            {leaveRequest.days_requested}
                          </td>
                          <td className="border-b border-slate-100 p-3">
                            <p className="max-w-xs whitespace-pre-wrap text-slate-700">
                              {leaveRequest.reason}
                            </p>
                          </td>
                          <td className="border-b border-slate-100 p-3">
                            <span
                              className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getStatusPillClass(leaveRequest.status)}`}
                            >
                              {capitalizeWords(leaveRequest.status)}
                            </span>
                          </td>
                          <td className="border-b border-slate-100 p-3">
                            <select
                              value={leaveDrafts[leaveRequest.id] || leaveRequest.status}
                              onChange={(event) =>
                                setLeaveDrafts((current) => ({
                                  ...current,
                                  [leaveRequest.id]: event.target.value,
                                }))
                              }
                              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 outline-none transition focus:border-blue-500"
                            >
                              <option value="pending">Pending</option>
                              <option value="approved">Approved</option>
                              <option value="rejected">Rejected</option>
                            </select>
                          </td>
                          <td className="border-b border-slate-100 p-3">
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => handleUpdateLeaveRequest(leaveRequest)}
                                disabled={updatingLeaveId === leaveRequest.id}
                                className="rounded-xl bg-blue-600 px-3 py-2 text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
                              >
                                {updatingLeaveId === leaveRequest.id ? "Saving..." : "Save"}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteLeaveRequest(leaveRequest)}
                                disabled={deletingLeaveId === leaveRequest.id}
                                className="rounded-xl bg-red-600 px-3 py-2 text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-red-300"
                              >
                                {deletingLeaveId === leaveRequest.id ? "Deleting..." : "Delete"}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </div>
      </main>

      <EditStudentModal
        student={editModalStudent}
        form={editStudentForm}
        previewUrl={editStudentPreviewUrl}
        isSaving={isSavingEditStudent}
        onClose={closeEditModal}
        onFieldChange={(field, value) =>
          setEditStudentForm((current) => ({
            ...current,
            [field]: value,
          }))
        }
        onImageChange={handleEditImageChange}
        onSubmit={handleEditStudent}
      />
    </>
  );
}
