"use client";

import { Camera, LocateFixed, RotateCcw, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

import StudentShell from "../_components/StudentShell";
import {
  MessageBanner,
  PageCard,
  PhotoPreviewCard,
  SectionIntro,
  StudentLoadingScreen,
} from "../_components/StudentUI";
import {
  fileToDataUrl,
  formatDateTime,
  getAttendanceResultHeading,
  isStudentAuthError,
  markStudentAttendance,
  redirectStudentToLogin,
  useStudentSessionGuard,
} from "../_lib/student-portal";

const AUTO_CAPTURE_HOLD_SECONDS = 5;

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
      } else {
        setCameraError(message);
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
    countdownIntervalRef,
    videoReady,
    locationSnapshot,
    preparingLiveCheck,
    loadingAttendance,
    selectedFile,
    studentSession.studentToken,
  ]);

  if (!sessionReady || !studentSession.studentId || !studentSession.studentToken) {
    return <StudentLoadingScreen />;
  }

  const liveCheckStatus = preparingLiveCheck
    ? "Requesting camera and location access..."
    : loadingAttendance
      ? "Submitting your live capture..."
      : cameraOpen && videoReady && locationSnapshot
        ? `Hold steady. Automatic capture starts in ${countdownSeconds}s.`
        : cameraOpen
          ? "Preparing the live camera preview..."
          : "Restart the live check if you need another automatic capture.";

  return (
    <StudentShell
      studentSession={studentSession}
      pageLabel="Attendance Capture"
      title="Live Attendance Check"
      subtitle="Your camera opens automatically, your location is verified, and attendance is submitted after a five-second live hold."
    >
      <canvas ref={canvasRef} className="hidden" />

      <div className="grid gap-6 xl:grid-cols-[1.04fr,0.96fr]">
        <PageCard>
          <SectionIntro
            eyebrow="Automatic Verification"
            title="Stay in frame for five seconds"
            description="This page uses a live front-camera capture and a location check. Gallery-style uploads are not used here."
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
              {selectedFile || attendanceResult ? "Restart Live Check" : "Start Live Check Again"}
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
                    <p className="text-sm font-semibold text-slate-900">Live camera status</p>
                    <p className="mt-1 text-sm leading-6 text-slate-600">{liveCheckStatus}</p>
                  </div>
                </div>

                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <div className="rounded-2xl bg-emerald-100 p-3 text-emerald-700">
                    <LocateFixed className="size-5" />
                  </div>

                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900">Geofence status</p>
                    <p className="mt-1 text-sm leading-6 text-slate-600">
                      {locationSnapshot
                        ? `Location verified with approximately ${Math.round(locationSnapshot.accuracyMeters || 0)} meters accuracy.`
                        : "Location access is required before attendance can be captured."}
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
                    Live camera only
                  </span>
                  <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-700">
                    Geofence required
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
              title="Captured Image Preview"
              subtitle="This preview shows the most recent automatic live capture sent for attendance."
              imageUrl={previewUrl}
              fallbackLabel="The automatic capture preview will appear here after the five-second live check finishes."
            />
          </PageCard>

          <PageCard>
            <SectionIntro
              eyebrow="Verification Rules"
              title="What changed for attendance"
              description="The capture step is now stricter so attendance behaves more like a live check-in."
            />
            <ul className="mt-5 space-y-3 text-sm leading-6 text-slate-600">
              <li>The page requests the front camera automatically instead of waiting for a manual open step.</li>
              <li>Attendance capture waits for a five-second live hold before sending the image.</li>
              <li>Location permission is required so the backend can enforce the attendance geofence.</li>
              <li>If the match fails, restart the live check and stay centered with good lighting.</li>
            </ul>
          </PageCard>

          <PageCard>
            <div className="flex items-start gap-3">
              <div className="rounded-2xl bg-slate-900 p-3 text-white">
                <ShieldCheck className="size-5" />
              </div>

              <div>
                <p className="text-sm font-semibold text-slate-900">Important limitation</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  This hardens browser attendance by forcing a live capture path, but browsers still
                  cannot completely block advanced virtual camera or GPS spoofing tools on compromised devices.
                </p>
              </div>
            </div>
          </PageCard>
        </div>
      </div>
    </StudentShell>
  );
}
