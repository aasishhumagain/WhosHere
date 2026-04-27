"use client";

import { Camera, CameraOff, CheckCircle2, RotateCcw, UploadCloud } from "lucide-react";
import { useEffect, useRef, useState } from "react";
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

export default function StudentAttendanceCapturePage() {
  const router = useRouter();
  const { sessionReady, studentSession } = useStudentSessionGuard(router);

  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [attendanceResult, setAttendanceResult] = useState(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [loadingAttendance, setLoadingAttendance] = useState(false);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

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

  useEffect(() => () => stopCamera(false), []);

  useEffect(() => {
    if (cameraOpen && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [cameraOpen]);

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
      setCameraError("Could not access the camera. Please allow camera access and try again.");
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

    const cameraFile = new File([blob], `attendance_capture_${Date.now()}.jpg`, {
      type: "image/jpeg",
    });

    try {
      setSelectedFile(cameraFile);
      setPreviewUrl(await fileToDataUrl(cameraFile));
      setCameraError("");
      setAttendanceResult(null);
      stopCamera();
    } catch (error) {
      setAttendanceResult({
        type: "error",
        status: "error",
        message: error.message || "Could not preview the captured image.",
      });
    }
  }

  async function handleMarkAttendance() {
    if (!selectedFile) {
      setAttendanceResult({
        type: "error",
        status: "error",
        message: "Please capture a live face image before marking attendance.",
      });
      return;
    }

    setLoadingAttendance(true);
    setAttendanceResult(null);

    try {
      const data = await markStudentAttendance(studentSession.studentToken, selectedFile);

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
        message: error.message || "Could not connect to the server.",
      });
    } finally {
      setLoadingAttendance(false);
    }
  }

  if (!sessionReady || !studentSession.studentId || !studentSession.studentToken) {
    return <StudentLoadingScreen />;
  }

  return (
    <StudentShell
      studentSession={studentSession}
      pageLabel="Attendance Capture"
      title="Mark Attendance"
      subtitle="Use the live camera to capture a clear front-facing photo and submit it for recognition. This page stays separate so the daily attendance flow remains simple and focused."
    >
      <canvas ref={canvasRef} className="hidden" />

      <div className="grid gap-6 xl:grid-cols-[1.04fr,0.96fr]">
        <PageCard>
          <SectionIntro
            eyebrow="Live Camera"
            title="Capture and submit today's attendance"
            description="Open the camera, take a clear photo, and then submit it. WhosHere will compare the captured image against your enrolled left, center, and right face set."
          />

          <div className="mt-6 flex flex-wrap gap-3">
            <Button
              type="button"
              onClick={startCamera}
              size="lg"
              className="rounded-full bg-sky-600 hover:bg-sky-700"
            >
              <Camera className="size-4" />
              {selectedFile ? "Retake Capture" : "Open Live Camera"}
            </Button>

            {cameraOpen ? (
              <Button
                type="button"
                onClick={() => stopCamera()}
                variant="outline"
                size="lg"
                className="rounded-full"
              >
                <CameraOff className="size-4" />
                Close Camera
              </Button>
            ) : null}
          </div>

          {cameraError ? (
            <MessageBanner type="error" className="mt-4">
              {cameraError}
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
                className="mt-4 w-full rounded-[1.25rem] border border-slate-200 bg-slate-900"
              />

              <div className="mt-4 flex flex-wrap gap-3">
                <Button
                  type="button"
                  onClick={captureFromCamera}
                  size="lg"
                  className="rounded-full bg-emerald-600 hover:bg-emerald-700"
                >
                  <UploadCloud className="size-4" />
                  Capture Photo
                </Button>
                <Button
                  type="button"
                  onClick={() => stopCamera()}
                  variant="outline"
                  size="lg"
                  className="rounded-full"
                >
                  <RotateCcw className="size-4" />
                  Cancel Camera
                </Button>
              </div>
              </CardContent>
            </Card>
          ) : null}

          <div className="mt-6 flex flex-wrap gap-3">
            <Button
              type="button"
              onClick={handleMarkAttendance}
              disabled={!selectedFile || loadingAttendance}
              size="lg"
              className="rounded-full"
            >
              <CheckCircle2 className="size-4" />
              {loadingAttendance ? "Processing..." : "Mark Me Present"}
            </Button>

            <Button
              type="button"
              onClick={() => {
                setSelectedFile(null);
                setPreviewUrl("");
                setAttendanceResult(null);
                setCameraError("");
              }}
              disabled={!selectedFile}
              variant="outline"
              size="lg"
              className="rounded-full"
            >
              <RotateCcw className="size-4" />
              Clear Captured Image
            </Button>
          </div>

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
              subtitle="Review the image you just captured before you submit attendance."
              imageUrl={previewUrl}
              fallbackLabel="Capture a photo from the live camera to preview it here."
            />
          </PageCard>

          <PageCard>
            <SectionIntro
              eyebrow="Attendance Notes"
              title="Tips for accurate capture"
              description="A clearer photo gives the recognition check a better chance of matching your stored face image correctly."
            />
            <ul className="mt-5 space-y-3 text-sm leading-6 text-slate-600">
              <li>Only one present entry is allowed per student per day.</li>
              <li>Use good lighting and face the camera directly for better matching accuracy.</li>
              <li>If your face is not recognized, retake the photo with a clearer front view.</li>
            </ul>
          </PageCard>
        </div>
      </div>
    </StudentShell>
  );
}
