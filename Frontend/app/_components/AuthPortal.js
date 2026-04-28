"use client";

import { ArrowRight, Camera, ShieldCheck, Users } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";

import PasswordField from "@/app/_components/PasswordField";
import { buildApiUrl, parseApiResponse } from "@/app/lib/api";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { setAdminSessionStorage } from "@/app/admin/_lib/admin-portal";
import { setStudentSessionStorage } from "@/app/student/_lib/student-portal";

const PLATFORM_FEATURES = [
  {
    icon: Camera,
    label: "Live Face Check",
    detail: "Attendance is marked from a live camera photo matched with the saved student photos.",
  },
  {
    icon: ShieldCheck,
    label: "Admin Tools",
    detail: "Admins can manage students, attendance, leave requests, reports, and logs.",
  },
  {
    icon: Users,
    label: "Student Tools",
    detail: "Students can check attendance history, send leave requests, and change passwords.",
  },
];

function LoginCard({
  accent,
  badgeLabel,
  title,
  description,
  fields,
  submitLabel,
  loadingLabel,
  loading,
  message,
  onSubmit,
}) {
  return (
    <Card className="flex h-full flex-col border-white/80 bg-white/92 shadow-[0_20px_90px_rgba(15,23,42,0.1)] backdrop-blur-sm">
      <CardHeader className="gap-4">
        <Badge
          variant="outline"
          className={`w-fit rounded-full px-3 py-1 ${accent.badge}`}
        >
          {badgeLabel}
        </Badge>
        <div>
          <CardTitle className="text-3xl tracking-tight">{title}</CardTitle>
          <CardDescription className="mt-2 text-sm leading-6">
            {description}
          </CardDescription>
        </div>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit();
          }}
          className="flex flex-1 flex-col space-y-4"
        >
          {fields}

          <Button
            type="submit"
            className={`mt-2 w-full rounded-2xl ${accent.button}`}
            disabled={loading}
          >
            {loading ? loadingLabel : submitLabel}
            {!loading ? <ArrowRight className="size-4" /> : null}
          </Button>
        </form>

        {message ? (
          <Alert variant="destructive" className="mt-5">
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        ) : null}
      </CardContent>
    </Card>
  );
}

export default function AuthPortal() {
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

      setStudentSessionStorage({
        studentToken: data.token || "",
        studentId: String(data.student_id || ""),
        studentName: data.full_name || "Student",
        studentEmail: data.email || "",
        studentPhoneNumber: data.phone_number || "",
        studentRole: data.role || "Student",
        faceImageUrl: data.face_image_url || "",
      });

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

      setAdminSessionStorage({
        token: data.token || "",
        username: data.username || adminUsername,
      });

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
    <section className="grid gap-6 xl:grid-cols-[1.02fr,0.98fr]">
      <Card className="overflow-hidden border-white/70 bg-slate-950 text-white shadow-[0_30px_120px_rgba(15,23,42,0.28)]">
        <CardHeader className="relative gap-5 p-8 pb-0">
          <Badge className="w-fit rounded-full border-0 bg-white/10 px-3 py-1 text-[0.72rem] uppercase tracking-[0.28em] text-blue-100">
            WhosHere Platform
          </Badge>
          <CardTitle className="max-w-2xl text-5xl leading-tight tracking-tight text-white">
            Choose the right login for your role.
          </CardTitle>
          <CardDescription className="max-w-2xl text-base leading-7 text-slate-300">
            Students use this system for daily attendance and leave requests. Admins use it to
            register students, manage records, and review reports.
          </CardDescription>
        </CardHeader>

        <CardContent className="p-8 pt-8">
          <div className="grid gap-4 md:grid-cols-3">
            {PLATFORM_FEATURES.map((feature) => {
              const Icon = feature.icon;

              return (
                <div
                  key={feature.label}
                  className="rounded-[1.75rem] border border-white/10 bg-white/6 p-4"
                >
                  <div className="flex size-11 items-center justify-center rounded-2xl bg-white/10">
                    <Icon className="size-5 text-blue-100" />
                  </div>
                  <p className="mt-4 text-base font-semibold">{feature.label}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-300">
                    {feature.detail}
                  </p>
                </div>
              );
            })}
          </div>

          <Separator className="my-8 bg-white/10" />

          <div className="flex flex-wrap items-center gap-3 text-sm text-slate-300">
            <span className="rounded-full border border-white/10 bg-white/6 px-3 py-1">
              Duplicate attendance blocked
            </span>
            <span className="rounded-full border border-white/10 bg-white/6 px-3 py-1">
              Three face photos per student
            </span>
            <span className="rounded-full border border-white/10 bg-white/6 px-3 py-1">
              Leave request history
            </span>
          </div>
        </CardContent>
      </Card>

      <section className="grid gap-6 lg:grid-cols-2">
        <LoginCard
          accent={{
            badge: "border-blue-200 bg-blue-50 text-blue-700",
            button: "bg-blue-600 hover:bg-blue-700",
          }}
          badgeLabel="Student Access"
          title="Student Login"
          description="Use your student ID and password. If no password was set during registration, your first password is your student ID."
          loading={loadingStudent}
          loadingLabel="Signing In..."
          submitLabel="Login as Student"
          message={studentMessage}
          onSubmit={studentLogin}
          fields={
            <>
              <div className="space-y-2">
                <Label htmlFor="student-id">Student ID</Label>
                <Input
                  id="student-id"
                  type="text"
                  inputMode="numeric"
                  placeholder="Enter student ID"
                  value={studentId}
                  onChange={(event) => setStudentId(event.target.value)}
                  className="h-12 rounded-2xl border-slate-200 bg-slate-50"
                />
              </div>

              <PasswordField
                id="student-password"
                label="Password"
                placeholder="Enter password"
                value={studentPassword}
                onChange={(event) => setStudentPassword(event.target.value)}
                inputClassName="h-12 rounded-2xl border-slate-200 bg-slate-50"
              />
            </>
          }
        />

        <LoginCard
          accent={{
            badge: "border-emerald-200 bg-emerald-50 text-emerald-700",
            button: "bg-emerald-600 hover:bg-emerald-700",
          }}
          badgeLabel="Admin Access"
          title="Administrator Login"
          description="Use your admin username and password to open the admin dashboard."
          loading={loadingAdmin}
          loadingLabel="Signing In..."
          submitLabel="Login as Administrator"
          message={adminMessage}
          onSubmit={adminLogin}
          fields={
            <>
              <div className="space-y-2">
                <Label htmlFor="admin-username">Username</Label>
                <Input
                  id="admin-username"
                  type="text"
                  placeholder="Enter admin username"
                  value={adminUsername}
                  onChange={(event) => setAdminUsername(event.target.value)}
                  className="h-12 rounded-2xl border-slate-200 bg-slate-50"
                />
              </div>

              <PasswordField
                id="admin-password"
                label="Password"
                placeholder="Enter admin password"
                value={adminPassword}
                onChange={(event) => setAdminPassword(event.target.value)}
                inputClassName="h-12 rounded-2xl border-slate-200 bg-slate-50"
              />
            </>
          }
        />
      </section>
    </section>
  );
}
