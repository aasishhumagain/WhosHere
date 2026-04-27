"use client";

import { Camera, CameraOff, CheckCheck } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import PasswordField from "@/app/_components/PasswordField";

import AdminShell from "../_components/AdminShell";
import {
  ADMIN_FIELD_CLASSNAME,
  AdminLoadingScreen,
  FieldBlock,
  MessageBanner,
  PageCard,
  PhotoPreviewCard,
  SectionIntro,
} from "../_components/AdminUI";
import {
  createStudentForm,
  fileToDataUrl,
  isAdminAuthError,
  redirectAdminToLogin,
  registerStudent,
  useAdminSessionGuard,
} from "../_lib/admin-portal";

export default function AdminRegisterStudentPage() {
  const router = useRouter();
  const { sessionReady, adminSession } = useAdminSessionGuard(router);

  const [studentForm, setStudentForm] = useState(createStudentForm());
  const [studentPreviewUrl, setStudentPreviewUrl] = useState("");
  const [studentMessage, setStudentMessage] = useState(null);
  const [studentCameraOpen, setStudentCameraOpen] = useState(false);
  const [studentCameraError, setStudentCameraError] = useState("");
  const [isSavingStudent, setIsSavingStudent] = useState(false);

  const studentVideoRef = useRef(null);
  const studentCanvasRef = useRef(null);
  const studentStreamRef = useRef(null);

  function stopStudentCamera(updateState = true) {
    if (studentStreamRef.current) {
      studentStreamRef.current.getTracks().forEach((track) => track.stop());
      studentStreamRef.current = null;
    }

    if (studentVideoRef.current) {
      studentVideoRef.current.srcObject = null;
    }

    if (updateState) {
      setStudentCameraOpen(false);
    }
  }

  useEffect(() => () => stopStudentCamera(false), []);

  useEffect(() => {
    if (studentCameraOpen && studentVideoRef.current && studentStreamRef.current) {
      studentVideoRef.current.srcObject = studentStreamRef.current;
    }
  }, [studentCameraOpen]);

  async function startStudentCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setStudentCameraError("Camera access is not supported in this browser.");
      return;
    }

    stopStudentCamera(false);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
        },
      });

      studentStreamRef.current = stream;
      setStudentCameraError("");
      setStudentMessage(null);
      setStudentCameraOpen(true);

      if (studentVideoRef.current) {
        studentVideoRef.current.srcObject = stream;
      }
    } catch {
      setStudentCameraError("Could not access the camera. Please allow camera permission and try again.");
    }
  }

  async function captureStudentFromCamera() {
    if (!studentVideoRef.current || !studentCanvasRef.current) {
      setStudentCameraError("Camera preview is not ready yet.");
      return;
    }

    const video = studentVideoRef.current;
    const canvas = studentCanvasRef.current;
    const context = canvas.getContext("2d");

    if (!context) {
      setStudentCameraError("Could not capture the camera frame.");
      return;
    }

    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", 0.95);
    });

    if (!blob) {
      setStudentCameraError("Could not capture the image.");
      return;
    }

    const cameraFile = new File(
      [blob],
      `student_registration_${Date.now()}.jpg`,
      { type: "image/jpeg" },
    );

    try {
      setStudentForm((current) => ({
        ...current,
        face_image: cameraFile,
      }));
      setStudentPreviewUrl(await fileToDataUrl(cameraFile));
      setStudentCameraError("");
      setStudentMessage(null);
      stopStudentCamera();
    } catch (error) {
      setStudentMessage({
        type: "error",
        message: error.message || "Could not preview the captured image.",
      });
    }
  }

  function clearStudentCapture() {
    setStudentForm((current) => ({
      ...current,
      face_image: null,
    }));
    setStudentPreviewUrl("");
    setStudentCameraError("");
    stopStudentCamera();
  }

  function resetStudentForm() {
    setStudentForm(createStudentForm());
    setStudentPreviewUrl("");
    setStudentCameraError("");
    setStudentMessage(null);
    stopStudentCamera();
  }

  async function handleRegisterStudent(event) {
    event.preventDefault();

    if (!studentForm.full_name.trim()) {
      setStudentMessage({ type: "error", message: "Student name is required." });
      return;
    }

    if (!studentForm.face_image) {
      setStudentMessage({
        type: "error",
        message: "Please capture a face image before registering the student.",
      });
      return;
    }

    setIsSavingStudent(true);
    setStudentMessage(null);

    try {
      const response = await registerStudent(adminSession.token, studentForm);
      resetStudentForm();
      setStudentMessage({
        type: "success",
        message:
          response.message ||
          (response.uses_student_id_password
            ? "Student registered successfully. The initial password is the student ID."
            : "Student registered successfully."),
      });
    } catch (error) {
      if (isAdminAuthError(error)) {
        redirectAdminToLogin(router);
        return;
      }

      setStudentMessage({
        type: "error",
        message: error.message || "Could not register the student.",
      });
    } finally {
      setIsSavingStudent(false);
    }
  }

  if (!sessionReady || !adminSession.token) {
    return <AdminLoadingScreen />;
  }

  return (
    <AdminShell
      adminSession={adminSession}
      pageLabel="Student Enrollment"
      title="Register Student"
      subtitle="Create a student account, capture a live face photo, and save the enrollment details from this dedicated admin page."
    >
      <div className="grid gap-6 lg:grid-cols-[1.04fr,0.96fr]">
        <PageCard>
          <SectionIntro
            eyebrow="Enrollment Form"
            title="Create a new student account"
            description="Capture a clear face image, enter the student details, and submit everything together so the account is ready for recognition-based attendance."
          />

          {studentMessage ? (
            <MessageBanner type={studentMessage.type} className="mt-5">
              {studentMessage.message}
            </MessageBanner>
          ) : null}

          <form onSubmit={handleRegisterStudent} className="mt-6 space-y-5">
            <FieldBlock label="Full Name" htmlFor="student-full-name">
              <input
                id="student-full-name"
                type="text"
                value={studentForm.full_name}
                onChange={(event) =>
                  setStudentForm((current) => ({
                    ...current,
                    full_name: event.target.value,
                  }))
                }
                placeholder="Enter the student's full name"
                className={`w-full ${ADMIN_FIELD_CLASSNAME}`}
              />
            </FieldBlock>

            <div className="grid gap-4 md:grid-cols-2">
              <FieldBlock label="Email" htmlFor="student-email">
                <input
                  id="student-email"
                  type="email"
                  value={studentForm.email}
                  onChange={(event) =>
                    setStudentForm((current) => ({
                      ...current,
                      email: event.target.value,
                    }))
                  }
                  placeholder="student@example.com"
                  className={`w-full ${ADMIN_FIELD_CLASSNAME}`}
                />
              </FieldBlock>

              <FieldBlock label="Phone Number" htmlFor="student-phone-number">
                <input
                  id="student-phone-number"
                  type="text"
                  inputMode="numeric"
                  value={studentForm.phone_number}
                  onChange={(event) =>
                    setStudentForm((current) => ({
                      ...current,
                      phone_number: event.target.value,
                    }))
                  }
                  placeholder="Enter phone number"
                  className={`w-full ${ADMIN_FIELD_CLASSNAME}`}
                />
              </FieldBlock>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <FieldBlock label="Grade" htmlFor="student-grade">
                <input
                  id="student-grade"
                  type="text"
                  value={studentForm.grade}
                  onChange={(event) =>
                    setStudentForm((current) => ({
                      ...current,
                      grade: event.target.value,
                    }))
                  }
                  placeholder="Enter grade or class"
                  className={`w-full ${ADMIN_FIELD_CLASSNAME}`}
                />
              </FieldBlock>

              <PasswordField
                label="Password (Optional)"
                value={studentForm.password}
                onChange={(event) =>
                  setStudentForm((current) => ({
                    ...current,
                    password: event.target.value,
                  }))
                }
                placeholder="Leave blank to use the student ID"
                inputClassName={ADMIN_FIELD_CLASSNAME}
              />
            </div>

            <Card className="rounded-[1.75rem] border-border/80 bg-slate-50/80 shadow-none">
              <CardContent className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <CardTitle className="text-lg">Live Face Capture</CardTitle>
                    <CardDescription className="mt-2 text-sm leading-6">
                      Use the live camera to capture a clear front-facing face photo for enrollment.
                    </CardDescription>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <Button
                      type="button"
                      className="rounded-full bg-sky-600 hover:bg-sky-700"
                      onClick={startStudentCamera}
                    >
                      <Camera className="size-4" />
                      {studentForm.face_image ? "Retake Capture" : "Open Live Camera"}
                    </Button>

                    {studentCameraOpen ? (
                      <Button
                        type="button"
                        variant="outline"
                        className="rounded-full"
                        onClick={() => stopStudentCamera()}
                      >
                        <CameraOff className="size-4" />
                        Close Camera
                      </Button>
                    ) : null}

                    {studentForm.face_image ? (
                      <Button
                        type="button"
                        variant="outline"
                        className="rounded-full"
                        onClick={clearStudentCapture}
                      >
                        Clear Capture
                      </Button>
                    ) : null}
                  </div>
                </div>

                {studentCameraError ? (
                  <MessageBanner type="error" className="mt-4">
                    {studentCameraError}
                  </MessageBanner>
                ) : null}

                {studentCameraOpen ? (
                  <div className="mt-4">
                    <video
                      ref={studentVideoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full rounded-[1.25rem] border border-slate-200 bg-slate-900"
                    />

                    <div className="mt-4 flex flex-wrap gap-3">
                      <Button
                        type="button"
                        className="rounded-full bg-emerald-600 hover:bg-emerald-700"
                        onClick={captureStudentFromCamera}
                      >
                        <CheckCheck className="size-4" />
                        Capture Face Photo
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="rounded-full"
                        onClick={() => stopStudentCamera()}
                      >
                        Cancel Camera
                      </Button>
                    </div>
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <div className="flex flex-wrap gap-3 pt-2">
              <Button
                type="submit"
                disabled={isSavingStudent}
                className="rounded-full bg-emerald-600 hover:bg-emerald-700"
              >
                {isSavingStudent ? "Registering..." : "Register Student"}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="rounded-full"
                onClick={resetStudentForm}
              >
                Clear Form
              </Button>
            </div>
          </form>
        </PageCard>

        <div className="grid gap-6">
          <canvas ref={studentCanvasRef} className="hidden" />

          <PageCard>
            <PhotoPreviewCard
              title="Capture Preview"
              subtitle="The captured face image appears here before you register the student."
              imageUrl={studentPreviewUrl}
              fallbackLabel="Capture a student face image to preview it here."
            />
          </PageCard>

          <PageCard>
            <SectionIntro
              eyebrow="Enrollment Tips"
              title="Prepare a clean student record"
              description="A better enrollment photo and accurate account information make attendance matching and future maintenance much smoother."
            />
            <ul className="mt-5 space-y-3 text-sm leading-6 text-slate-600">
              <li>Ask the student to look straight at the camera in even lighting.</li>
              <li>Leave the password blank if you want the student&apos;s initial password to be their student ID.</li>
              <li>Passwords are hashed on the backend before storage.</li>
              <li>Duplicate student emails are blocked automatically.</li>
            </ul>
          </PageCard>
        </div>
      </div>
    </AdminShell>
  );
}
