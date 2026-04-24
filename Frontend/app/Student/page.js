"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";

import { buildApiUrl, buildAssetUrl, parseApiResponse } from "@/app/lib/api";

function createLeaveForm() {
  return {
    start_date: "",
    end_date: "",
    reason: "",
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

function capitalizeWords(value) {
  if (!value) {
    return "";
  }

  return value
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
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

  if (status === "duplicate") {
    return "bg-sky-100 text-sky-700";
  }

  return "bg-slate-100 text-slate-700";
}

function getMessageClass(type) {
  if (type === "error") {
    return "border border-red-200 bg-red-50 text-red-700";
  }

  if (type === "success") {
    return "border border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  return "border border-blue-200 bg-blue-50 text-blue-700";
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
          className="mt-4 h-56 rounded-[1.25rem] border border-slate-200 bg-cover bg-center"
          style={{ backgroundImage: `url(${imageUrl})` }}
        />
      ) : (
        <div className="mt-4 flex h-56 items-center justify-center rounded-[1.25rem] border border-dashed border-slate-300 bg-white text-center text-sm text-slate-400">
          {fallbackLabel}
        </div>
      )}
    </div>
  );
}

const DEFAULT_STUDENT_SESSION = {
  studentId: "",
  studentName: "Student",
  studentEmail: "",
  faceImageUrl: "",
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

function getStudentSessionFromStorage() {
  if (typeof window === "undefined") {
    return DEFAULT_STUDENT_SESSION;
  }

  return {
    studentId: localStorage.getItem("student_id") || "",
    studentName: localStorage.getItem("student_name") || "Student",
    studentEmail: localStorage.getItem("student_email") || "",
    faceImageUrl: localStorage.getItem("student_face_image_url") || "",
  };
}

export default function StudentPage() {
  const router = useRouter();
  const sessionReady = useSyncExternalStore(
    subscribeToSessionStore,
    getClientReadySnapshot,
    getServerReadySnapshot,
  );
  const studentSession = sessionReady
    ? getStudentSessionFromStorage()
    : DEFAULT_STUDENT_SESSION;

  const [profile, setProfile] = useState(null);
  const [attendance, setAttendance] = useState([]);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [attendanceResult, setAttendanceResult] = useState(null);
  const [leaveMessage, setLeaveMessage] = useState(null);
  const [leaveForm, setLeaveForm] = useState(createLeaveForm());
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [loadingAttendance, setLoadingAttendance] = useState(false);
  const [loadingLeaveRequest, setLoadingLeaveRequest] = useState(false);
  const [loadingDashboard, setLoadingDashboard] = useState(true);
  const [dashboardError, setDashboardError] = useState("");

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  async function fetchStudentProfile(studentId) {
    const response = await fetch(buildApiUrl(`/students/${studentId}`));
    const data = await parseApiResponse(response, "Could not load your profile.");
    setProfile(data);
    return data;
  }

  async function fetchStudentAttendance(studentId) {
    const response = await fetch(buildApiUrl(`/attendance/student/${studentId}`));
    const data = await parseApiResponse(response, "Could not load attendance history.");
    setAttendance(data);
    return data;
  }

  async function fetchStudentLeaveRequests(studentId) {
    const response = await fetch(buildApiUrl(`/leave-requests/student/${studentId}`));
    const data = await parseApiResponse(response, "Could not load leave requests.");
    setLeaveRequests(data);
    return data;
  }

  async function loadStudentDashboard(studentId) {
    setLoadingDashboard(true);
    setDashboardError("");

    try {
      await Promise.all([
        fetchStudentProfile(studentId),
        fetchStudentAttendance(studentId),
        fetchStudentLeaveRequests(studentId),
      ]);
    } catch (error) {
      setDashboardError(error.message || "Could not load the student dashboard.");
    } finally {
      setLoadingDashboard(false);
    }
  }

  function stopCamera(updateState = true) {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    if (updateState) {
      setCameraOpen(false);
    }
  }

  useEffect(() => {
    if (!sessionReady) {
      return undefined;
    }

    if (!studentSession.studentId) {
      router.replace("/");
      return undefined;
    }

    let isActive = true;

    async function loadInitialStudentDashboard() {
      try {
        const [profileData, attendanceData, leaveRequestData] = await Promise.all([
          fetch(buildApiUrl(`/students/${studentSession.studentId}`)).then((response) =>
            parseApiResponse(response, "Could not load your profile."),
          ),
          fetch(buildApiUrl(`/attendance/student/${studentSession.studentId}`)).then(
            (response) =>
              parseApiResponse(response, "Could not load attendance history."),
          ),
          fetch(buildApiUrl(`/leave-requests/student/${studentSession.studentId}`)).then(
            (response) => parseApiResponse(response, "Could not load leave requests."),
          ),
        ]);

        if (!isActive) {
          return;
        }

        setProfile(profileData);
        setAttendance(attendanceData);
        setLeaveRequests(leaveRequestData);
        setDashboardError("");
      } catch (error) {
        if (!isActive) {
          return;
        }

        setDashboardError(error.message || "Could not load the student dashboard.");
      } finally {
        if (isActive) {
          setLoadingDashboard(false);
        }
      }
    }

    loadInitialStudentDashboard();

    return () => {
      isActive = false;
      stopCamera(false);
    };
  }, [router, sessionReady, studentSession.studentId]);

  useEffect(() => {
    if (cameraOpen && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [cameraOpen]);

  async function handleFileChange(event) {
    const file = event.target.files?.[0] || null;
    setSelectedFile(file);

    if (!file) {
      setPreviewUrl("");
      return;
    }

    try {
      setPreviewUrl(await fileToDataUrl(file));
    } catch (error) {
      setAttendanceResult({
        type: "error",
        status: "error",
        message: error.message || "Could not preview the selected image.",
      });
    }
  }

  async function startCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("Camera access is not supported in this browser.");
      return;
    }

    stopCamera(false);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
        },
      });

      streamRef.current = stream;
      setCameraError("");
      setCameraOpen(true);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch {
      setCameraError("Could not access the camera. Please allow camera access or upload a photo.");
    }
  }

  async function captureFromCamera() {
    if (!videoRef.current || !canvasRef.current) {
      setCameraError("Camera preview is not ready yet.");
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");

    if (!context) {
      setCameraError("Could not capture the camera frame.");
      return;
    }

    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", 0.95);
    });

    if (!blob) {
      setCameraError("Could not capture the image.");
      return;
    }

    const cameraFile = new File(
      [blob],
      `attendance_capture_${Date.now()}.jpg`,
      { type: "image/jpeg" },
    );

    setSelectedFile(cameraFile);
    setPreviewUrl(await fileToDataUrl(cameraFile));
    setCameraError("");
    stopCamera();
  }

  async function markAttendance() {
    if (!selectedFile) {
      setAttendanceResult({
        type: "error",
        status: "error",
        message: "Please choose an image or capture one using the live camera.",
      });
      return;
    }

    setLoadingAttendance(true);
    setAttendanceResult(null);

    const formData = new FormData();
    formData.append("face_image", selectedFile);

    try {
      const response = await fetch(buildApiUrl("/attendance/mark"), {
        method: "POST",
        body: formData,
      });

      const data = await parseApiResponse(
        response,
        "Could not mark attendance right now.",
      );

      setAttendanceResult({
        type: data.status === "present" || data.status === "duplicate" ? "success" : "error",
        ...data,
      });

      if (studentSession.studentId) {
        await fetchStudentAttendance(studentSession.studentId);
      }
    } catch (error) {
      setAttendanceResult({
        type: "error",
        status: "error",
        message: error.message || "Could not connect to the server.",
      });
    } finally {
      setLoadingAttendance(false);
    }
  }

  async function submitLeaveRequest(event) {
    event.preventDefault();

    if (!leaveForm.start_date || !leaveForm.end_date || !leaveForm.reason.trim()) {
      setLeaveMessage({
        type: "error",
        message: "Start date, end date, and reason are all required.",
      });
      return;
    }

    setLoadingLeaveRequest(true);
    setLeaveMessage(null);

    const formData = new FormData();
    formData.append("student_id", studentSession.studentId);
    formData.append("start_date", leaveForm.start_date);
    formData.append("end_date", leaveForm.end_date);
    formData.append("reason", leaveForm.reason.trim());

    try {
      const response = await fetch(buildApiUrl("/leave-requests"), {
        method: "POST",
        body: formData,
      });

      const data = await parseApiResponse(
        response,
        "Could not submit your leave request.",
      );

      setLeaveForm(createLeaveForm());
      await fetchStudentLeaveRequests(studentSession.studentId);
      setLeaveMessage({
        type: "success",
        message: data.message || "Leave request submitted successfully.",
      });
    } catch (error) {
      setLeaveMessage({
        type: "error",
        message: error.message || "Could not submit your leave request.",
      });
    } finally {
      setLoadingLeaveRequest(false);
    }
  }

  function logout() {
    stopCamera(false);
    localStorage.removeItem("student_id");
    localStorage.removeItem("student_name");
    localStorage.removeItem("student_email");
    localStorage.removeItem("student_face_image_url");
    router.push("/");
  }

  const profilePhotoUrl = buildAssetUrl(
    profile?.face_image_url || studentSession.faceImageUrl,
  );
  const uniquePresentDays = new Set(
    attendance
      .filter((record) => record.status === "present" || record.status === "late")
      .map((record) => new Date(record.marked_at).toISOString().slice(0, 10)),
  ).size;
  const approvedLeaveDays = leaveRequests
    .filter((leaveRequest) => leaveRequest.status === "approved")
    .reduce((total, leaveRequest) => total + leaveRequest.days_requested, 0);

  if (!sessionReady) {
    return (
      <main className="min-h-screen bg-[linear-gradient(140deg,#f8fafc_0%,#e0f2fe_52%,#fef3c7_100%)] px-4 py-6 text-slate-900 md:px-6">
        <div className="mx-auto flex min-h-[80vh] max-w-7xl items-center justify-center">
          <div className="rounded-[2rem] border border-white/70 bg-white/85 px-8 py-10 text-center shadow-[0_25px_80px_rgba(15,23,42,0.08)] backdrop-blur">
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-blue-700">
              WhosHere
            </p>
            <h1 className="mt-3 text-3xl font-semibold">Loading student dashboard...</h1>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[linear-gradient(140deg,#f8fafc_0%,#e0f2fe_52%,#fef3c7_100%)] px-4 py-6 text-slate-900 md:px-6">
      <canvas ref={canvasRef} className="hidden" />

      <div className="mx-auto grid max-w-7xl gap-6 xl:grid-cols-[18rem,1fr]">
        <aside className="h-fit rounded-[2rem] border border-white/60 bg-slate-950 p-6 text-white shadow-[0_30px_120px_rgba(15,23,42,0.25)] xl:sticky xl:top-6">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-amber-300">
            Student Portal
          </p>
          <h1 className="mt-4 text-3xl font-semibold">WhosHere</h1>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            Welcome back, <span className="font-semibold text-white">{studentSession.studentName}</span>.
          </p>

          <div className="mt-8 space-y-3">
            <SidebarButton
              label="Attendance Capture"
              sectionId="attendance-capture-section"
              accentClass="bg-white/8 text-white"
            />
            <SidebarButton
              label="Attendance History"
              sectionId="attendance-history-section"
              accentClass="bg-emerald-500/15 text-emerald-100"
            />
            <SidebarButton
              label="Leave Requests"
              sectionId="leave-request-section"
              accentClass="bg-sky-500/15 text-sky-100"
            />
            <SidebarButton
              label="Profile"
              sectionId="profile-section"
              accentClass="bg-amber-500/15 text-amber-100"
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
          <section className="rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-[0_25px_80px_rgba(15,23,42,0.08)] backdrop-blur">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.28em] text-blue-700">
                  Student Dashboard
                </p>
                <h2 className="mt-3 text-4xl font-semibold">Track attendance and manage leave easily</h2>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
                  Use a live camera or uploaded image to mark attendance, then review your records
                  and submit leave requests from the same dashboard.
                </p>
              </div>

              <button
                type="button"
                onClick={() => loadStudentDashboard(studentSession.studentId)}
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
                <p className="text-sm text-slate-500">Unique Present Days</p>
                <p className="mt-3 text-3xl font-semibold">{uniquePresentDays}</p>
              </div>
              <div className="rounded-[1.6rem] border border-slate-200 bg-slate-50 p-5">
                <p className="text-sm text-slate-500">Leave Requests</p>
                <p className="mt-3 text-3xl font-semibold">{leaveRequests.length}</p>
              </div>
              <div className="rounded-[1.6rem] border border-slate-200 bg-slate-50 p-5">
                <p className="text-sm text-slate-500">Approved Leave Days</p>
                <p className="mt-3 text-3xl font-semibold">{approvedLeaveDays}</p>
              </div>
              <div className="rounded-[1.6rem] border border-slate-200 bg-slate-50 p-5">
                <p className="text-sm text-slate-500">Dashboard Status</p>
                <p className="mt-3 text-3xl font-semibold">
                  {loadingDashboard ? "Loading" : "Ready"}
                </p>
              </div>
            </div>
          </section>

          <section
            id="attendance-capture-section"
            className="rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-[0_25px_80px_rgba(15,23,42,0.08)] backdrop-blur"
          >
            <div className="grid gap-6 lg:grid-cols-[1.04fr,0.96fr]">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.28em] text-emerald-700">
                  Attendance Capture
                </p>
                <h2 className="mt-3 text-3xl font-semibold">Mark attendance with upload or live camera</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Upload a clear image or capture one from the live camera, then submit it for face
                  recognition attendance matching.
                </p>

                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">
                      Upload Face Image
                    </label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                      className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm outline-none transition file:mr-4 file:rounded-xl file:border-0 file:bg-slate-900 file:px-3 file:py-2 file:text-white hover:file:bg-slate-700"
                    />
                  </div>

                  <div className="flex flex-wrap items-end gap-3">
                    <button
                      type="button"
                      onClick={startCamera}
                      className="rounded-2xl bg-sky-600 px-4 py-3 font-medium text-white transition hover:bg-sky-700"
                    >
                      Open Live Camera
                    </button>
                    {cameraOpen ? (
                      <button
                        type="button"
                        onClick={() => stopCamera()}
                        className="rounded-2xl border border-slate-300 px-4 py-3 font-medium text-slate-700 transition hover:bg-slate-100"
                      >
                        Close Camera
                      </button>
                    ) : null}
                  </div>
                </div>

                {cameraError ? (
                  <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {cameraError}
                  </div>
                ) : null}

                {cameraOpen ? (
                  <div className="mt-6 rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                      Live Camera
                    </p>
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="mt-4 w-full rounded-[1.25rem] border border-slate-200 bg-slate-900"
                    />
                    <div className="mt-4 flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={captureFromCamera}
                        className="rounded-2xl bg-emerald-600 px-4 py-3 font-medium text-white transition hover:bg-emerald-700"
                      >
                        Capture Photo
                      </button>
                      <button
                        type="button"
                        onClick={() => stopCamera()}
                        className="rounded-2xl border border-slate-300 px-4 py-3 font-medium text-slate-700 transition hover:bg-slate-100"
                      >
                        Cancel Camera
                      </button>
                    </div>
                  </div>
                ) : null}

                <div className="mt-6 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={markAttendance}
                    disabled={!selectedFile || loadingAttendance}
                    className="rounded-2xl bg-blue-600 px-5 py-3 font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
                  >
                    {loadingAttendance ? "Processing..." : "Mark Me Present"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedFile(null);
                      setPreviewUrl("");
                      setAttendanceResult(null);
                    }}
                    className="rounded-2xl border border-slate-300 px-5 py-3 font-medium text-slate-700 transition hover:bg-slate-100"
                  >
                    Clear Selected Image
                  </button>
                </div>

                {attendanceResult ? (
                  <div className={`mt-5 rounded-2xl px-4 py-3 text-sm ${getMessageClass(attendanceResult.type)}`}>
                    <p className="font-semibold">
                      {attendanceResult.status === "present"
                        ? "Attendance marked successfully."
                        : attendanceResult.status === "duplicate"
                          ? "Attendance already recorded today."
                          : attendanceResult.status === "unknown"
                            ? "Face was not recognized."
                            : "Attendance could not be marked."}
                    </p>
                    <p className="mt-1">{attendanceResult.message}</p>
                    {attendanceResult.student ? (
                      <p className="mt-2">
                        Student: {attendanceResult.student} ({attendanceResult.student_id})
                      </p>
                    ) : null}
                    {attendanceResult.marked_at ? (
                      <p className="mt-1">Time: {formatDateTime(attendanceResult.marked_at)}</p>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <div className="grid gap-4">
                <PhotoPreviewCard
                  title="Selected Image Preview"
                  subtitle="Review the current upload or camera capture before submitting attendance."
                  imageUrl={previewUrl}
                  fallbackLabel="Choose an image or capture one from the live camera."
                />

                <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                    Attendance Notes
                  </p>
                  <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
                    <li>Only one present entry is allowed per student per day.</li>
                    <li>Use good lighting for better matching accuracy.</li>
                    <li>If your face is not recognized, retry with a clearer front-facing image.</li>
                  </ul>
                </div>
              </div>
            </div>
          </section>

          <section
            id="attendance-history-section"
            className="rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-[0_25px_80px_rgba(15,23,42,0.08)] backdrop-blur"
          >
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.28em] text-amber-700">
                  Attendance History
                </p>
                <h2 className="mt-3 text-3xl font-semibold">Review your attendance timeline</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Every attendance entry is shown below so you can quickly confirm dates and status.
                </p>
              </div>

              <button
                type="button"
                onClick={() => fetchStudentAttendance(studentSession.studentId)}
                className="rounded-2xl bg-slate-900 px-5 py-3 font-medium text-white transition hover:bg-slate-700"
              >
                Refresh Attendance
              </button>
            </div>

            <div className="mt-6 overflow-x-auto rounded-[1.5rem] border border-slate-200">
              <table className="w-full min-w-[52rem] text-sm">
                <thead className="bg-slate-100 text-left">
                  <tr>
                    <th className="border-b border-slate-200 p-3">Status</th>
                    <th className="border-b border-slate-200 p-3">Date</th>
                    <th className="border-b border-slate-200 p-3">Time</th>
                    <th className="border-b border-slate-200 p-3">Full Timestamp</th>
                  </tr>
                </thead>

                <tbody>
                  {attendance.length === 0 ? (
                    <tr>
                      <td className="p-4 text-slate-500" colSpan="4">
                        No attendance records found yet.
                      </td>
                    </tr>
                  ) : (
                    attendance.map((record) => (
                      <tr key={record.id} className="odd:bg-white even:bg-slate-50">
                        <td className="border-b border-slate-100 p-3">
                          <span
                            className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getStatusPillClass(record.status)}`}
                          >
                            {capitalizeWords(record.status)}
                          </span>
                        </td>
                        <td className="border-b border-slate-100 p-3">
                          {new Date(record.marked_at).toLocaleDateString()}
                        </td>
                        <td className="border-b border-slate-100 p-3">
                          {new Date(record.marked_at).toLocaleTimeString()}
                        </td>
                        <td className="border-b border-slate-100 p-3">
                          {formatDateTime(record.marked_at)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section
            id="leave-request-section"
            className="rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-[0_25px_80px_rgba(15,23,42,0.08)] backdrop-blur"
          >
            <div className="grid gap-6 lg:grid-cols-[1.02fr,0.98fr]">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.28em] text-sky-700">
                  Leave Requests
                </p>
                <h2 className="mt-3 text-3xl font-semibold">Submit a leave request</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Add the leave period and a reason. Your request will be reviewed by the admin.
                </p>

                {leaveMessage ? (
                  <div className={`mt-5 rounded-2xl px-4 py-3 text-sm ${getMessageClass(leaveMessage.type)}`}>
                    {leaveMessage.message}
                  </div>
                ) : null}

                <form onSubmit={submitLeaveRequest} className="mt-6 space-y-4">
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
                    <label className="mb-2 block text-sm font-medium text-slate-700">
                      Reason
                    </label>
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
                      disabled={loadingLeaveRequest}
                      className="rounded-2xl bg-sky-600 px-5 py-3 font-medium text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-sky-300"
                    >
                      {loadingLeaveRequest ? "Submitting..." : "Submit Leave Request"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setLeaveForm(createLeaveForm())}
                      className="rounded-2xl border border-slate-300 px-5 py-3 font-medium text-slate-700 transition hover:bg-slate-100"
                    >
                      Clear Form
                    </button>
                  </div>
                </form>
              </div>

              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.28em] text-slate-500">
                  Leave History
                </p>
                <div className="mt-4 overflow-x-auto rounded-[1.5rem] border border-slate-200">
                  <table className="w-full min-w-[36rem] text-sm">
                    <thead className="bg-slate-100 text-left">
                      <tr>
                        <th className="border-b border-slate-200 p-3">Dates</th>
                        <th className="border-b border-slate-200 p-3">Days</th>
                        <th className="border-b border-slate-200 p-3">Status</th>
                        <th className="border-b border-slate-200 p-3">Reason</th>
                      </tr>
                    </thead>

                    <tbody>
                      {leaveRequests.length === 0 ? (
                        <tr>
                          <td className="p-4 text-slate-500" colSpan="4">
                            No leave requests submitted yet.
                          </td>
                        </tr>
                      ) : (
                        leaveRequests.map((leaveRequest) => (
                          <tr key={leaveRequest.id} className="odd:bg-white even:bg-slate-50">
                            <td className="border-b border-slate-100 p-3">
                              {formatDate(leaveRequest.start_date)} to {formatDate(leaveRequest.end_date)}
                            </td>
                            <td className="border-b border-slate-100 p-3">
                              {leaveRequest.days_requested}
                            </td>
                            <td className="border-b border-slate-100 p-3">
                              <span
                                className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getStatusPillClass(leaveRequest.status)}`}
                              >
                                {capitalizeWords(leaveRequest.status)}
                              </span>
                            </td>
                            <td className="border-b border-slate-100 p-3">
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
              </div>
            </div>
          </section>

          <section
            id="profile-section"
            className="rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-[0_25px_80px_rgba(15,23,42,0.08)] backdrop-blur"
          >
            <div className="grid gap-6 lg:grid-cols-[0.94fr,1.06fr]">
              <PhotoPreviewCard
                title="Profile Photo"
                subtitle="This is the face image currently linked to your student profile."
                imageUrl={profilePhotoUrl}
                fallbackLabel="Your profile photo will appear here once one is registered by admin."
              />

              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.28em] text-amber-700">
                  Student Profile
                </p>
                <h2 className="mt-3 text-3xl font-semibold">Your account details</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  View your registered profile data, student ID, email, and attendance summary.
                </p>

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

                <div className="mt-6 rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                    Quick Summary
                  </p>
                  <div className="mt-4 grid gap-4 sm:grid-cols-3">
                    <div>
                      <p className="text-sm text-slate-500">Attendance records</p>
                      <p className="mt-2 text-2xl font-semibold text-slate-900">{attendance.length}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">Unique present days</p>
                      <p className="mt-2 text-2xl font-semibold text-slate-900">{uniquePresentDays}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">Leave requests</p>
                      <p className="mt-2 text-2xl font-semibold text-slate-900">{leaveRequests.length}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
