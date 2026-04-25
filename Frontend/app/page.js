"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { buildApiUrl, parseApiResponse } from "@/app/lib/api";

export default function WelcomePage() {
  const router = useRouter();

  const [studentId, setStudentId] = useState("");
  const [studentPassword, setStudentPassword] = useState("");
  const [adminUsername, setAdminUsername] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [studentMessage, setStudentMessage] = useState("");
  const [adminMessage, setAdminMessage] = useState("");
  const [loadingStudent, setLoadingStudent] = useState(false);
  const [loadingAdmin, setLoadingAdmin] = useState(false);

  async function studentLogin() {
    setStudentMessage("");
    setLoadingStudent(true);

    const formData = new FormData();
    formData.append("student_id", studentId);
    formData.append("password", studentPassword);

    try {
      const response = await fetch(buildApiUrl("/login/student"), {
        method: "POST",
        body: formData,
      });

      const data = await parseApiResponse(
        response,
        "Invalid student ID or password.",
      );

      localStorage.setItem("student_id", String(data.student_id));
      localStorage.setItem("student_name", data.full_name || "Student");
      localStorage.setItem("student_email", data.email || "");
      localStorage.setItem("student_face_image_url", data.face_image_url || "");

      router.push("/student");
    } catch (error) {
      setStudentMessage(
        error.message ||
          "Invalid ID or password. Please contact admin if you are not registered.",
      );
    } finally {
      setLoadingStudent(false);
    }
  }

  async function adminLogin() {
    setAdminMessage("");
    setLoadingAdmin(true);

    const formData = new FormData();
    formData.append("username", adminUsername);
    formData.append("password", adminPassword);

    try {
      const response = await fetch(buildApiUrl("/login/admin"), {
        method: "POST",
        body: formData,
      });

      const data = await parseApiResponse(
        response,
        "Invalid administrator credentials.",
      );

      localStorage.setItem("admin_token", data.token);
      localStorage.setItem("admin_username", data.username || adminUsername);

      router.push("/admin");
    } catch (error) {
      setAdminMessage(
        error.message || "Invalid admin credentials. Please try again.",
      );
    } finally {
      setLoadingAdmin(false);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[linear-gradient(135deg,#f7efe5_0%,#f6f9fc_52%,#dbeafe_100%)] px-6 py-10 text-slate-900">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-8rem] top-[-5rem] h-72 w-72 rounded-full bg-amber-300/20 blur-3xl" />
        <div className="absolute right-[-6rem] top-24 h-80 w-80 rounded-full bg-sky-400/20 blur-3xl" />
        <div className="absolute bottom-[-8rem] left-1/3 h-96 w-96 rounded-full bg-emerald-300/20 blur-3xl" />
      </div>

      <div className="relative mx-auto flex min-h-[calc(100vh-5rem)] max-w-6xl items-center">
        <div className="grid w-full gap-6 xl:grid-cols-[0.95fr,1.05fr]">
          <section className="rounded-[2rem] border border-white/60 bg-slate-950 px-8 py-10 text-white shadow-[0_30px_120px_rgba(15,23,42,0.25)]">
            <p className="text-sm font-semibold uppercase tracking-[0.35em] text-amber-300">
              WhosHere
            </p>
            <h1 className="mt-5 max-w-lg text-5xl font-semibold leading-tight">
              Smart attendance with face recognition, admin control, and live student tracking.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-slate-300">
              Sign in as a student to mark attendance or use the admin workspace to manage
              students, attendance records, and leave requests from one dashboard.
            </p>

            <div className="mt-10 grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-sm text-slate-300">Face recognition</p>
                <p className="mt-2 text-lg font-semibold">Upload or live camera</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-sm text-slate-300">Admin tools</p>
                <p className="mt-2 text-lg font-semibold">Students, attendance, leave</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-sm text-slate-300">Data quality</p>
                <p className="mt-2 text-lg font-semibold">Duplicate attendance blocked</p>
              </div>
            </div>
          </section>

          <section className="grid gap-6 md:grid-cols-2">
            <div className="rounded-[2rem] border border-slate-200/70 bg-white/90 p-8 shadow-[0_25px_80px_rgba(15,23,42,0.08)] backdrop-blur">
              <p className="text-sm font-semibold uppercase tracking-[0.28em] text-blue-700">
                Student Access
              </p>
              <h2 className="mt-4 text-3xl font-semibold">Student Login</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Use your student ID and password provided by the administrator.
              </p>

              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  studentLogin();
                }}
                className="mt-8 space-y-4"
              >
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Student ID
                  </label>
                  <input
                    type="number"
                    placeholder="Enter student ID"
                    value={studentId}
                    onChange={(event) => setStudentId(event.target.value)}
                    className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 outline-none transition focus:border-blue-500 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Password
                  </label>
                  <input
                    type="password"
                    placeholder="Enter password"
                    value={studentPassword}
                    onChange={(event) => setStudentPassword(event.target.value)}
                    className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 outline-none transition focus:border-blue-500 focus:bg-white"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loadingStudent}
                  className="w-full rounded-2xl bg-blue-600 px-4 py-3 font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
                >
                  {loadingStudent ? "Signing In..." : "Login as Student"}
                </button>
              </form>

              {studentMessage ? (
                <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {studentMessage}
                </div>
              ) : null}
            </div>

            <div className="rounded-[2rem] border border-slate-200/70 bg-white/90 p-8 shadow-[0_25px_80px_rgba(15,23,42,0.08)] backdrop-blur">
              <p className="text-sm font-semibold uppercase tracking-[0.28em] text-emerald-700">
                Admin Access
              </p>
              <h2 className="mt-4 text-3xl font-semibold">Administrator Login</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Admin login is now verified by the backend instead of a frontend-only password.
              </p>

              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  adminLogin();
                }}
                className="mt-8 space-y-4"
              >
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Username
                  </label>
                  <input
                    type="text"
                    placeholder="Enter admin username"
                    value={adminUsername}
                    onChange={(event) => setAdminUsername(event.target.value)}
                    className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 outline-none transition focus:border-emerald-500 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Password
                  </label>
                  <input
                    type="password"
                    placeholder="Enter admin password"
                    value={adminPassword}
                    onChange={(event) => setAdminPassword(event.target.value)}
                    className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 outline-none transition focus:border-emerald-500 focus:bg-white"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loadingAdmin}
                  className="w-full rounded-2xl bg-emerald-600 px-4 py-3 font-medium text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-300"
                >
                  {loadingAdmin ? "Signing In..." : "Login as Administrator"}
                </button>
              </form>

              {adminMessage ? (
                <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {adminMessage}
                </div>
              ) : null}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
