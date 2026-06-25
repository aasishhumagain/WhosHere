"use client";

import { Camera, LocateFixed, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
  PhotoPreviewCard,
  SectionIntro,
  StatusPill,
  StudentLoadingScreen,
} from "../_components/StudentUI";
import {
  capitalizeWords,
  createFallbackAttendanceForm,
  fetchStudentFallbackAttendanceRequests,
  fileToDataUrl,
  formatDate,
  formatDateTime,
  getAttendanceResultHeading,
  isStudentAuthError,
  markStudentAttendance,
  redirectStudentToLogin,
  submitAttendanceFallbackRequest,
  toLocalDayKey,
  useStudentSessionGuard,
} from "../_lib/student-portal";

const AUTO_CAPTURE_HOLD_SECONDS = 5;
const FALLBACK_SELECT_CLASSNAME =
  "h-12 w-full appearance-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-ring focus:ring-[3px] focus:ring-ring/20 dark:border-white/12 dark:bg-slate-950/72 dark:text-slate-100";

const CAMERA_CONSTRAINTS = {
  audio: false,
  video: {
    facingMode: "user",
    width: { ideal: 1280 },
    height: { ideal: 720 },
  },
};

const GEOLOCATION_OPTIONS = {
  enableHighAccuracy: true,
  timeout: 15000,
  maximumAge: 0,
};

function getGeolocationErrorMessage(error) {
  if (!error) {
    return "Could not verify your location. Please try again.";
  }

  if (error.code === error.PERMISSION_DENIED) {
    return "Location access is required to mark attendance inside the campus geofence.";
  }

  if (error.code === error.POSITION_UNAVAILABLE) {
    return "Could not determine your current location. Move to an open area and try again.";
  }

  if (error.code === error.TIMEOUT) {
    return "Location verification took too long. Please try again.";
  }

  return error.message || "Could not verify your location. Please try again.";
}

function getCameraErrorMessage(error) {
  const message = String(error?.message || "").toLowerCase();

  if (message.includes("permission")) {
    return "Camera access is required to complete the live attendance check.";
  }

  if (message.includes("notfound") || message.includes("devicesnotfound")) {
    return "No front camera was detected on this device.";
  }

  if (message.includes("notreadable") || message.includes("trackstart")) {
    return "The camera is already in use by another app. Close it and try again.";
  }

  return error?.message || "Could not open the live camera. Please try again.";
}

function resolveFallbackIssueType({ cameraError, locationError, attendanceResult }) {
  if (cameraError) {
    return "camera";
  }

  if (locationError) {
    return "location";
  }

  if (attendanceResult?.status === "unknown") {
    return "recognition";
  }

  return "other";
}

export default function StudentAttendanceCapturePage() {
  const router = useRouter();
  const { sessionReady, studentSession } = useStudentSessionGuard(router);

  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [attendanceResult, setAttendanceResult] = useState(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [locationError, setLocationError] = useState("");
  const [locationSnapshot, setLocationSnapshot] = useState(null);
  const [loadingAttendance, setLoadingAttendance] = useState(false);
  const [preparingLiveCheck, setPreparingLiveCheck] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const [countdownSeconds, setCountdownSeconds] = useState(AUTO_CAPTURE_HOLD_SECONDS);
  const [fallbackRequests, setFallbackRequests] = useState([]);
  const [loadingFallbackRequests, setLoadingFallbackRequests] = useState(true);
  const [fallbackForm, setFallbackForm] = useState(createFallbackAttendanceForm());
  const [fallbackMessage, setFallbackMessage] = useState(null);
  const [submittingFallbackRequest, setSubmittingFallbackRequest] = useState(false);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const hasAutoStartedRef = useRef(false);
  const countdownIntervalRef = useRef(null);
  const captureStartedAtRef = useRef("");
  const autoCapturePendingRef = useRef(false);

  const clearCountdownTimer = useCallback(({ resetCountdown = false } = {}) => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }

    autoCapturePendingRef.current = false;
    captureStartedAtRef.current = "";

    if (resetCountdown) {
      setCountdownSeconds(AUTO_CAPTURE_HOLD_SECONDS);
    }
  }, []);

  const stopCamera = useCallback((updateState = true, { resetCountdown = true } = {}) => {
    clearCountdownTimer({ resetCountdown });
    setVideoReady(false);

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
  }, [clearCountdownTimer]);

  useEffect(() => () => stopCamera(false, { resetCountdown: false }), [stopCamera]);

  useEffect(() => {
    if (cameraOpen && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [cameraOpen]);

  const requestCameraStream = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("Camera access is not supported in this browser.");
    }

    return navigator.mediaDevices.getUserMedia(CAMERA_CONSTRAINTS);
  }, []);

  const requestLocationSnapshot = useCallback(async () => {
    if (!navigator.geolocation) {
      throw new Error("Location access is not supported in this browser.");
    }

    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracyMeters: position.coords.accuracy || 0,
            capturedAt: new Date().toISOString(),
          });
        },
        (error) => reject(new Error(getGeolocationErrorMessage(error))),
        GEOLOCATION_OPTIONS,
      );
    });
  }, []);

  const buildCameraCaptureFile = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) {
      throw new Error("Camera preview is not ready yet.");
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error("Could not capture the camera frame.");
    }

    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", 0.95);
    });

    if (!blob) {
      throw new Error("Could not capture the image.");
    }

    return new File([blob], `attendance_capture_${Date.now()}.jpg`, {
      type: "image/jpeg",
    });
  }, []);

  async function refreshFallbackRequests() {
    if (!studentSession.studentId || !studentSession.studentToken) {
      return;
    }

    setLoadingFallbackRequests(true);

    try {
      const requests = await fetchStudentFallbackAttendanceRequests(
        studentSession.studentId,
        studentSession.studentToken,
      );
      setFallbackRequests(requests);
    } catch (error) {
      if (isStudentAuthError(error)) {
        redirectStudentToLogin(router);
        return;
      }

      setFallbackMessage({
        type: "error",
        message: error.message || "Could not load fallback attendance requests.",
      });
    } finally {
      setLoadingFallbackRequests(false);
    }
  }

  const runAutomaticAttendanceCheck = useCallback(async () => {
    clearCountdownTimer({ resetCountdown: true });
    stopCamera(true, { resetCountdown: true });

    setSelectedFile(null);
    setPreviewUrl("");
    setAttendanceResult(null);
    setCameraError("");
    setLocationError("");
    setLocationSnapshot(null);
    setPreparingLiveCheck(true);

    try {
      const [cameraResult, locationResult] = await Promise.allSettled([
        requestCameraStream(),
        requestLocationSnapshot(),
      ]);

      if (cameraResult.status === "rejected") {
        throw new Error(getCameraErrorMessage(cameraResult.reason));
      }

      if (locationResult.status === "rejected") {
        cameraResult.value.getTracks().forEach((track) => track.stop());
        throw new Error(locationResult.reason?.message || "Could not verify your location.");
      }

      const stream = cameraResult.value;
      const location = locationResult.value;

      streamRef.current = stream;
      setLocationSnapshot(location);
      setCameraOpen(true);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
    } catch (error) {
      stopCamera(true, { resetCountdown: true });

      const message = error?.message || "Could not start the live attendance check.";

      if (message.toLowerCase().includes("location")) {
        setLocationError(message);
        setFallbackForm((current) => ({
          ...current,
          issue_type: "location",
        }));
      } else {
        setCameraError(message);
        setFallbackForm((current) => ({
          ...current,
          issue_type: "camera",
        }));
      }
    } finally {
      setPreparingLiveCheck(false);
    }
  }, [clearCountdownTimer, requestCameraStream, requestLocationSnapshot, stopCamera]);

  const captureAndSubmitAttendance = useCallback(async (captureStartedAt) => {
    try {
      const cameraFile = await buildCameraCaptureFile();
      const preview = await fileToDataUrl(cameraFile);

      setSelectedFile(cameraFile);
      setPreviewUrl(preview);
      setAttendanceResult(null);
      setCameraError("");

      stopCamera(true, { resetCountdown: true });
      setLoadingAttendance(true);

      const data = await markStudentAttendance(studentSession.studentToken, cameraFile, {
        latitude: locationSnapshot?.latitude,
        longitude: locationSnapshot?.longitude,
        accuracyMeters: locationSnapshot?.accuracyMeters,
        captureStartedAt,
        captureCompletedAt: new Date().toISOString(),
      });

      setAttendanceResult({
        type: data.status === "present" || data.status === "duplicate" ? "success" : "error",
        ...data,
      });

      if (data.status === "unknown") {
        setFallbackForm((current) => ({
          ...current,
          issue_type: "recognition",
        }));
      }
    } catch (error) {
      if (isStudentAuthError(error)) {
        redirectStudentToLogin(router);
        return;
      }

      setAttendanceResult({
        type: "error",
        status: "error",
        message: error.message || "Could not complete the live attendance check.",
      });
      setFallbackForm((current) => ({
        ...current,
        issue_type: "other",
      }));
    } finally {
      setLoadingAttendance(false);
      autoCapturePendingRef.current = false;
    }
  }, [buildCameraCaptureFile, locationSnapshot, router, stopCamera, studentSession.studentToken]);

  useEffect(() => {
    if (!sessionReady || !studentSession.studentId || !studentSession.studentToken) {
      return;
    }

    if (hasAutoStartedRef.current) {
      return;
    }

    hasAutoStartedRef.current = true;
    void runAutomaticAttendanceCheck();
  }, [
    runAutomaticAttendanceCheck,
    sessionReady,
    studentSession.studentId,
    studentSession.studentToken,
  ]);

  useEffect(() => {
    if (!sessionReady || !studentSession.studentId || !studentSession.studentToken) {
      return;
    }

    let isActive = true;

    async function loadInitialFallbackRequests() {
      try {
        const requests = await fetchStudentFallbackAttendanceRequests(
          studentSession.studentId,
          studentSession.studentToken,
        );

        if (!isActive) {
          return;
        }

        setFallbackRequests(requests);
      } catch (error) {
        if (!isActive) {
          return;
        }

        if (isStudentAuthError(error)) {
          redirectStudentToLogin(router);
          return;
        }

        setFallbackMessage({
          type: "error",
          message: error.message || "Could not load fallback attendance requests.",
        });
      } finally {
        if (isActive) {
          setLoadingFallbackRequests(false);
        }
      }
    }

    loadInitialFallbackRequests();

    return () => {
      isActive = false;
    };
  }, [router, sessionReady, studentSession.studentId, studentSession.studentToken]);

  useEffect(() => {
    if (
      !cameraOpen ||
      !videoReady ||
      !locationSnapshot ||
      preparingLiveCheck ||
      loadingAttendance ||
      selectedFile ||
      autoCapturePendingRef.current
    ) {
      return;
    }

    const startedAtMs = Date.now();
    const holdDurationMs = AUTO_CAPTURE_HOLD_SECONDS * 1000;

    autoCapturePendingRef.current = true;
    captureStartedAtRef.current = new Date(startedAtMs).toISOString();
    setCountdownSeconds(AUTO_CAPTURE_HOLD_SECONDS);

    countdownIntervalRef.current = setInterval(() => {
      const elapsedMs = Date.now() - startedAtMs;
      const remainingMs = Math.max(0, holdDurationMs - elapsedMs);
      setCountdownSeconds(Math.max(0, Math.ceil(remainingMs / 1000)));

      if (elapsedMs >= holdDurationMs) {
        const captureStartedAt = captureStartedAtRef.current;
        clearCountdownTimer();
        void captureAndSubmitAttendance(captureStartedAt);
      }
    }, 200);

    return () => clearCountdownTimer({ resetCountdown: false });
  }, [
    cameraOpen,
    captureAndSubmitAttendance,
    clearCountdownTimer,
    loadingAttendance,
    locationSnapshot,
    preparingLiveCheck,
    selectedFile,
    videoReady,
  ]);

  async function handleSubmitFallbackRequest(event) {
    event.preventDefault();

    if (!fallbackForm.reason.trim()) {
      setFallbackMessage({
        type: "error",
        message: "Explain why you need a fallback attendance review.",
      });
      return;
    }

    if (hasRecordedAttendanceToday) {
      setFallbackMessage({
        type: "error",
        message: "Attendance is already recorded for today. A fallback request is not needed.",
      });
      return;
    }

    if (pendingFallbackRequestToday) {
      setFallbackMessage({
        type: "error",
        message: "A fallback attendance request for today is already pending review.",
      });
      return;
    }

    setSubmittingFallbackRequest(true);
    setFallbackMessage(null);

    const fallbackContext = [
      cameraError,
      locationError,
      attendanceResult?.message,
      attendanceResult?.confidence !== undefined && attendanceResult?.confidence !== null
        ? `Recognition confidence: ${attendanceResult.confidence}`
        : "",
      locationSnapshot
        ? `Location accuracy: ${Math.round(locationSnapshot.accuracyMeters || 0)}m`
        : "",
    ]
      .filter(Boolean)
      .join(" | ");

    try {
      const response = await submitAttendanceFallbackRequest(
        studentSession.studentToken,
        fallbackForm,
        fallbackContext,
        todayKey,
      );

      setFallbackForm(createFallbackAttendanceForm());
      await refreshFallbackRequests();
      setFallbackMessage({
        type: "success",
        message: response.message || "Fallback attendance request submitted successfully.",
      });
    } catch (error) {
      if (isStudentAuthError(error)) {
        redirectStudentToLogin(router);
        return;
      }

      setFallbackMessage({
        type: "error",
        message: error.message || "Could not submit the fallback attendance request.",
      });
    } finally {
      setSubmittingFallbackRequest(false);
    }
  }

  if (!sessionReady || !studentSession.studentId || !studentSession.studentToken) {
    return <StudentLoadingScreen />;
  }

  const todayKey = toLocalDayKey(new Date());
  const pendingFallbackRequestToday = fallbackRequests.find(
    (request) => request.attendance_date === todayKey && request.status === "pending",
  );
  const hasRecordedAttendanceToday =
    attendanceResult?.status === "present" || attendanceResult?.status === "duplicate";
  const suggestedFallbackIssueType = resolveFallbackIssueType({
    cameraError,
    locationError,
    attendanceResult,
  });

  const liveCheckStatus = preparingLiveCheck
    ? "Requesting camera and location access..."
    : loadingAttendance
      ? "Submitting your live capture..."
      : cameraOpen && videoReady && locationSnapshot
        ? `Hold steady. Automatic capture starts in ${countdownSeconds}s.`
        : cameraOpen
          ? "Preparing the live camera preview..."
          : "Restart the check-in if you need another capture.";

  return (
    <StudentShell
      studentSession={studentSession}
      pageLabel="Attendance Capture"
      title="Attendance Check-In"
      subtitle="Camera access starts automatically, location is verified, and attendance is submitted after a five-second hold."
    >
      <canvas ref={canvasRef} className="hidden" />

      <div className="grid gap-6 xl:grid-cols-[1.04fr,0.96fr]">
        <PageCard>
          <SectionIntro
            eyebrow="Check-In"
            title="Hold position for five seconds"
            description="Attendance uses a live front-camera capture together with location verification."
          />

          <div className="mt-6 flex flex-wrap gap-3">
            <Button
              type="button"
              onClick={() => void runAutomaticAttendanceCheck()}
              size="lg"
              className="rounded-full bg-sky-600 hover:bg-sky-700"
              disabled={preparingLiveCheck || loadingAttendance}
            >
              <RotateCcw className="size-4" />
              {selectedFile || attendanceResult ? "Restart Check-In" : "Start Check-In"}
            </Button>
          </div>

          <Card className="mt-6 rounded-[1.75rem] border-border/80 bg-slate-50/80 shadow-none">
            <CardContent className="p-5">
              <div className="flex flex-wrap items-start gap-4">
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <div className="rounded-2xl bg-sky-100 p-3 text-sky-700">
                    <Camera className="size-5" />
                  </div>

                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900">Camera status</p>
                    <p className="mt-1 text-sm leading-6 text-slate-600">{liveCheckStatus}</p>
                  </div>
                </div>

                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <div className="rounded-2xl bg-emerald-100 p-3 text-emerald-700">
                    <LocateFixed className="size-5" />
                  </div>

                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900">Location status</p>
                    <p className="mt-1 text-sm leading-6 text-slate-600">
                      {locationSnapshot
                        ? `Location verified with approximately ${Math.round(locationSnapshot.accuracyMeters || 0)} meters accuracy.`
                        : "Location access must be approved before check-in can continue."}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {cameraError ? (
            <MessageBanner type="error" className="mt-4">
              {cameraError}
            </MessageBanner>
          ) : null}

          {locationError ? (
            <MessageBanner type="error" className="mt-4">
              {locationError}
            </MessageBanner>
          ) : null}

          {cameraOpen ? (
            <Card className="mt-6 rounded-[1.75rem] border-border/80 bg-slate-50/80 shadow-none">
              <CardContent className="p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                  Live Preview
                </p>

                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  onLoadedMetadata={() => setVideoReady(true)}
                  className="mt-4 w-full rounded-[1.25rem] border border-slate-200 bg-slate-900"
                />

                <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-slate-600">
                  <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-sky-700">
                    Live capture
                  </span>
                  <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-700">
                    Location verified
                  </span>
                  <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-amber-700">
                    {countdownSeconds}s hold
                  </span>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {attendanceResult ? (
            <MessageBanner type={attendanceResult.type} className="mt-5">
              <p className="font-semibold">
                {getAttendanceResultHeading(attendanceResult.status)}
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
            </MessageBanner>
          ) : null}
        </PageCard>

        <div className="grid gap-6">
          <PageCard>
            <PhotoPreviewCard
              title="Latest capture"
              subtitle="Most recent frame submitted for attendance."
              imageUrl={previewUrl}
              fallbackLabel="The submitted capture will appear here after check-in completes."
            />
          </PageCard>

          <PageCard>
            <SectionIntro
              eyebrow="Requirements"
              title="Check-in requirements"
              description="Attendance is submitted only after the full live verification flow completes."
            />
            <ul className="mt-5 space-y-3 text-sm leading-6 text-slate-600">
              <li>Camera access opens automatically for the check-in flow.</li>
              <li>Attendance capture waits for a five-second hold before sending the image.</li>
              <li>Location permission is required so the backend can apply the attendance geofence.</li>
              <li>If matching fails, restart the check-in and stay centered with steady lighting.</li>
            </ul>
          </PageCard>

          <PageCard>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <SectionIntro
                eyebrow="Manual Review"
                title="Fallback attendance request"
                description="If automated verification cannot be completed, send a request for admin review."
              />

              <Button
                type="button"
                variant="outline"
                size="lg"
                className="rounded-full"
                onClick={refreshFallbackRequests}
              >
                {loadingFallbackRequests ? "Refreshing..." : "Refresh Requests"}
              </Button>
            </div>

            {fallbackMessage ? (
              <MessageBanner type={fallbackMessage.type} className="mt-5">
                {fallbackMessage.message}
              </MessageBanner>
            ) : null}

            {hasRecordedAttendanceToday ? (
              <MessageBanner type="success" className="mt-5">
                Attendance is already recorded for today. No fallback request is needed.
              </MessageBanner>
            ) : null}

            {pendingFallbackRequestToday ? (
              <MessageBanner type="info" className="mt-5">
                A fallback request for today is already pending review.
              </MessageBanner>
            ) : null}

            <form onSubmit={handleSubmitFallbackRequest} className="mt-6 space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="fallback-issue-type">Issue type</Label>
                  <p className="text-xs text-slate-500">
                    Suggested: {capitalizeWords(suggestedFallbackIssueType)}
                  </p>
                  <select
                    id="fallback-issue-type"
                    value={fallbackForm.issue_type}
                    onChange={(event) =>
                      setFallbackForm((current) => ({
                        ...current,
                        issue_type: event.target.value,
                      }))
                    }
                    className={FALLBACK_SELECT_CLASSNAME}
                  >
                    <option value="recognition">Face not recognized</option>
                    <option value="camera">Camera problem</option>
                    <option value="location">Location problem</option>
                    <option value="device">Device/browser problem</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="fallback-requested-status">Requested attendance status</Label>
                  <select
                    id="fallback-requested-status"
                    value={fallbackForm.requested_status}
                    onChange={(event) =>
                      setFallbackForm((current) => ({
                        ...current,
                        requested_status: event.target.value,
                      }))
                    }
                    className={FALLBACK_SELECT_CLASSNAME}
                  >
                    <option value="present">Present</option>
                    <option value="late">Late</option>
                    <option value="excused">Excused</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="fallback-reason">Reason for review</Label>
                <Textarea
                  id="fallback-reason"
                  rows="4"
                  value={fallbackForm.reason}
                  onChange={(event) =>
                    setFallbackForm((current) => ({
                      ...current,
                      reason: event.target.value,
                    }))
                  }
                  placeholder="Explain what prevented the live attendance check from completing."
                  className="rounded-2xl border-slate-200 bg-slate-50"
                />
              </div>

              <div className="flex flex-wrap gap-3 pt-2">
                <Button
                  type="submit"
                  size="lg"
                  className="rounded-full bg-sky-600 hover:bg-sky-700"
                  disabled={submittingFallbackRequest || hasRecordedAttendanceToday || Boolean(pendingFallbackRequestToday)}
                >
                  {submittingFallbackRequest ? "Submitting..." : "Submit Fallback Request"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  className="rounded-full"
                  onClick={() => setFallbackForm(createFallbackAttendanceForm())}
                >
                  Clear Form
                </Button>
              </div>
            </form>
          </PageCard>

          <PageCard className="overflow-hidden p-0">
            <div className="border-b border-slate-200 px-6 py-6">
              <SectionIntro
                eyebrow="Fallback History"
                title="Submitted review requests"
                description="See previous fallback attendance requests and the latest admin decision."
              />
            </div>

            <Table className="min-w-[42rem]">
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="px-6">Requested</TableHead>
                  <TableHead className="px-6">Issue</TableHead>
                  <TableHead className="px-6">Requested Status</TableHead>
                  <TableHead className="px-6">Review Status</TableHead>
                  <TableHead className="px-6">Admin Note</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {fallbackRequests.length === 0 ? (
                  <TableRow>
                    <TableCell className="px-6 py-8 text-slate-500" colSpan="5">
                      {loadingFallbackRequests
                        ? "Loading fallback requests..."
                        : "No fallback attendance requests submitted yet."}
                    </TableCell>
                  </TableRow>
                ) : (
                  fallbackRequests.map((request) => (
                    <TableRow key={request.id}>
                      <TableCell className="px-6">
                        <div>
                          <p className="font-medium text-slate-900">{formatDate(request.attendance_date)}</p>
                          <p className="text-xs text-slate-500">{formatDateTime(request.created_at)}</p>
                        </div>
                      </TableCell>
                      <TableCell className="px-6">{capitalizeWords(request.issue_type)}</TableCell>
                      <TableCell className="px-6">
                        <StatusPill status={request.requested_status} />
                      </TableCell>
                      <TableCell className="px-6">
                        <div className="space-y-2">
                          <StatusPill status={request.status} />
                          {request.approved_attendance_status ? (
                            <p className="text-xs text-slate-500">
                              Final status: {capitalizeWords(request.approved_attendance_status)}
                            </p>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="px-6">
                        <p className="max-w-xs whitespace-pre-wrap text-sm text-slate-600">
                          {request.admin_note || "No admin note yet."}
                        </p>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </PageCard>
        </div>
      </div>
    </StudentShell>
  );
}
