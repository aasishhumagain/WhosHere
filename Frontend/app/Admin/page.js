"use client";

import Image from "next/image";
import {
  Camera,
  CameraOff,
  CheckCheck,
  ChevronDown,
  ClipboardCheck,
  Download,
  LayoutDashboard,
  LogOut,
  PencilLine,
  RefreshCcw,
  Trash2,
  UserPlus,
  Users,
  Waves,
} from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";

import PasswordField from "@/app/_components/PasswordField";
import {
  buildApiUrl,
  buildAssetUrl,
  buildQueryString,
  getAdminAuthHeaders,
  parseApiResponse,
} from "@/app/lib/api";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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
    dateFrom: "",
    dateTo: "",
    preset: "all",
    sortOrder: "marked_at:desc",
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

function getAdminInitials(username) {
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

function padDateSegment(value) {
  return String(value).padStart(2, "0");
}

function toDateInputValue(value) {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return `${date.getFullYear()}-${padDateSegment(date.getMonth() + 1)}-${padDateSegment(date.getDate())}`;
}

function parseDateInputValue(value) {
  if (!value) {
    return null;
  }

  const [year, month, day] = value.split("-").map(Number);

  if (!year || !month || !day) {
    return null;
  }

  return new Date(year, month - 1, day);
}

function getAttendancePresetDates(preset) {
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

function capitalizeWords(value) {
  if (!value) {
    return "";
  }

  return value
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function scrollToSection(sectionId) {
  const section = document.getElementById(sectionId);

  if (!section) {
    return;
  }

  const topOffset = 24;
  const nextScrollTop =
    section.getBoundingClientRect().top + window.scrollY - topOffset;

  window.scrollTo({
    top: Math.max(nextScrollTop, 0),
    behavior: "smooth",
  });
}

function buildAttendanceExportFileName(filters) {
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

const ADMIN_SHELL_CLASSNAME =
  "min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(191,219,254,0.7),transparent_24%),radial-gradient(circle_at_85%_18%,rgba(254,240,138,0.45),transparent_20%),linear-gradient(180deg,#f8fbff_0%,#eef4ff_54%,#f9fafb_100%)] px-4 py-6 text-slate-900 md:px-6";

const ADMIN_SECTION_CLASSNAME =
  "rounded-[2rem] border border-white/80 bg-white/92 p-6 shadow-[0_18px_60px_rgba(15,23,42,0.08)] backdrop-blur-sm";

const ADMIN_FIELD_CLASSNAME =
  "h-12 rounded-2xl border-slate-200 bg-slate-50 shadow-none focus-visible:border-ring";

const ADMIN_SELECT_CLASSNAME =
  "h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-ring focus:ring-[3px] focus:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-50";

const ADMIN_FILE_INPUT_CLASSNAME =
  "h-auto rounded-2xl border-slate-200 bg-slate-50 py-3 file:mr-4 file:rounded-xl file:border-0 file:bg-slate-950 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-slate-800";

const SECTION_LINKS = [
  {
    label: "Overview",
    sectionId: "overview-section",
    icon: LayoutDashboard,
    description: "Dashboard summary",
    accentClass: "border-slate-200 bg-slate-50/90",
    iconClass: "bg-slate-100 text-slate-600",
  },
  {
    label: "Register Student",
    sectionId: "register-section",
    icon: UserPlus,
    description: "Create new account",
    accentClass: "border-blue-200 bg-blue-50/90",
    iconClass: "bg-blue-100 text-blue-700",
  },
  {
    label: "Student Directory",
    sectionId: "directory-section",
    icon: Users,
    description: "View and edit students",
    accentClass: "border-emerald-200 bg-emerald-50/90",
    iconClass: "bg-emerald-100 text-emerald-700",
  },
  {
    label: "Attendance Control",
    sectionId: "attendance-section",
    icon: ClipboardCheck,
    description: "Manage attendance",
    accentClass: "border-amber-200 bg-amber-50/90",
    iconClass: "bg-amber-100 text-amber-700",
  },
  {
    label: "Leave Requests",
    sectionId: "leave-section",
    icon: Waves,
    description: "Review student leave",
    accentClass: "border-sky-200 bg-sky-50/90",
    iconClass: "bg-sky-100 text-sky-700",
  },
];

function getBannerVariant(type) {
  if (type === "error") {
    return "destructive";
  }

  if (type === "success") {
    return "success";
  }

  return "default";
}

function AdminMessage({ message, className = "" }) {
  if (!message) {
    return null;
  }

  return (
    <Alert
      variant={getBannerVariant(message.type)}
      className={cn("rounded-2xl", getBannerClass(message.type), className)}
    >
      <AlertDescription>{message.message}</AlertDescription>
    </Alert>
  );
}

function StatusPill({ status }) {
  return (
    <Badge
      className={cn(
        "rounded-full px-3 py-1 text-[0.72rem] font-semibold",
        getStatusPillClass(status),
      )}
    >
      {capitalizeWords(status)}
    </Badge>
  );
}

function SectionIntro({ eyebrow, title, description, className = "" }) {
  return (
    <div className={className}>
      <p className="text-xs font-semibold uppercase tracking-[0.32em] text-primary/90">
        {eyebrow}
      </p>
      <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
        {title}
      </h2>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
        {description}
      </p>
    </div>
  );
}

function SectionPanel({ id, className = "", children }) {
  return (
    <section id={id} className={cn(ADMIN_SECTION_CLASSNAME, className)}>
      {children}
    </section>
  );
}

function MetricCard({ label, value, accentClass = "" }) {
  return (
    <Card className={cn("rounded-[1.75rem] border-border/80 bg-slate-50/80 shadow-none", accentClass)}>
      <CardContent className="p-5">
        <p className="text-sm text-slate-500">{label}</p>
        <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">{value}</p>
      </CardContent>
    </Card>
  );
}

function FieldBlock({ label, htmlFor, hint, children }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint ? <p className="text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

function NativeSelect({ className = "", ...props }) {
  return <select className={cn(ADMIN_SELECT_CLASSNAME, className)} {...props} />;
}

function PhotoThumb({ imageUrl, alt }) {
  if (!imageUrl) {
    return (
      <div className="flex size-14 items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white text-[11px] text-slate-400">
        No image
      </div>
    );
  }

  return (
    <div className="relative size-14 overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <Image
        src={imageUrl}
        alt={alt}
        fill
        unoptimized
        sizes="56px"
        className="object-cover object-center"
      />
    </div>
  );
}

function PhotoPreviewCard({
  title,
  subtitle,
  imageUrl,
  fallbackLabel,
}) {
  return (
    <Card className="rounded-[1.75rem] border-border/80 bg-slate-50/80 shadow-none">
      <CardHeader className="gap-2">
        <CardTitle className="text-lg">{title}</CardTitle>
        <CardDescription>{subtitle}</CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <Separator className="mb-4" />

        {imageUrl ? (
          <div className="flex h-64 items-center justify-center overflow-hidden rounded-[1.25rem] border border-slate-200 bg-white p-3 shadow-inner">
            <div className="relative h-full w-full">
              <Image
                src={imageUrl}
                alt={title}
                fill
                unoptimized
                sizes="(max-width: 1024px) 100vw, 40vw"
                className="rounded-[1rem] object-contain object-center"
              />
            </div>
          </div>
        ) : (
          <div className="flex h-64 items-center justify-center rounded-[1.25rem] border border-dashed border-slate-300 bg-white text-center text-sm text-slate-400">
            {fallbackLabel}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AdminMenuLinkRow({
  label,
  sectionId,
  accentClass,
  iconClass,
  icon: Icon,
  description,
}) {
  return (
    <DropdownMenuItem
      onSelect={(event) => {
        event.preventDefault();
        scrollToSection(sectionId);
      }}
      className="rounded-2xl px-3 py-3 focus:bg-accent/70"
    >
      {Icon ? (
        <span
          className={cn(
            "flex size-10 items-center justify-center rounded-2xl border",
            accentClass,
            iconClass,
          )}
        >
          <Icon className="size-4" />
        </span>
      ) : null}

      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-slate-900">{label}</span>
        {description ? (
          <span className="mt-0.5 block text-xs text-slate-500">{description}</span>
        ) : null}
      </span>
    </DropdownMenuItem>
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
      <Card className="max-h-full w-full max-w-4xl overflow-y-auto rounded-[2rem] border-white/80 bg-white/95 shadow-[0_35px_120px_rgba(15,23,42,0.35)] backdrop-blur-sm">
        <CardHeader className="flex flex-row items-start justify-between gap-4 border-b border-slate-200 p-6">
          <div>
            <Badge variant="outline" className="rounded-full border-blue-200 bg-blue-50 px-3 py-1 text-blue-700">
              Edit Student
            </Badge>
            <CardTitle className="mt-4 text-2xl">{student.full_name}</CardTitle>
            <CardDescription className="mt-1 text-sm">
              Student ID #{student.student_id}. Update details and preview the face image before
              saving.
            </CardDescription>
          </div>

          <Button type="button" variant="outline" className="rounded-full" onClick={onClose}>
            Close
          </Button>
        </CardHeader>

        <CardContent className="grid gap-6 p-6 lg:grid-cols-[0.88fr,1.12fr]">
          <PhotoPreviewCard
            title="Face Preview"
            subtitle="Current student photo or the new uploaded replacement."
            imageUrl={visiblePhotoUrl}
            fallbackLabel="No face image is stored for this student yet."
          />

          <form onSubmit={onSubmit} className="space-y-4">
            <FieldBlock label="Full Name" htmlFor="edit-student-name">
              <Input
                id="edit-student-name"
                type="text"
                value={form.full_name}
                onChange={(event) => onFieldChange("full_name", event.target.value)}
                className={ADMIN_FIELD_CLASSNAME}
              />
            </FieldBlock>

            <FieldBlock label="Email" htmlFor="edit-student-email">
              <Input
                id="edit-student-email"
                type="email"
                value={form.email}
                onChange={(event) => onFieldChange("email", event.target.value)}
                className={ADMIN_FIELD_CLASSNAME}
              />
            </FieldBlock>

            <PasswordField
              label="Password"
              value={form.password}
              onChange={(event) => onFieldChange("password", event.target.value)}
              placeholder="Leave blank to keep the existing password"
              inputClassName={ADMIN_FIELD_CLASSNAME}
            />

            <FieldBlock
              label="Replace Face Image"
              htmlFor="edit-student-face-image"
              hint="Upload a new image only if you want to update the stored face profile."
            >
              <Input
                id="edit-student-face-image"
                type="file"
                accept="image/*"
                onChange={onImageChange}
                className={ADMIN_FILE_INPUT_CLASSNAME}
              />
            </FieldBlock>

            <div className="grid gap-4 rounded-[1.5rem] border border-slate-200 bg-slate-50/80 p-4 md:grid-cols-2">
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
              <Button
                type="submit"
                disabled={isSaving}
                className="rounded-full bg-blue-600 hover:bg-blue-700"
              >
                {isSaving ? "Saving Changes..." : "Save Changes"}
              </Button>
              <Button
                type="button"
                onClick={onClose}
                variant="outline"
                className="rounded-full"
              >
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
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
  const [studentCameraOpen, setStudentCameraOpen] = useState(false);
  const [studentCameraError, setStudentCameraError] = useState("");
  const [deletingStudentId, setDeletingStudentId] = useState(null);
  const [attendanceDrafts, setAttendanceDrafts] = useState({});
  const [updatingAttendanceId, setUpdatingAttendanceId] = useState(null);
  const [deletingAttendanceId, setDeletingAttendanceId] = useState(null);
  const [isExportingAttendance, setIsExportingAttendance] = useState(false);
  const [leaveDrafts, setLeaveDrafts] = useState({});
  const [updatingLeaveId, setUpdatingLeaveId] = useState(null);
  const [deletingLeaveId, setDeletingLeaveId] = useState(null);
  const studentVideoRef = useRef(null);
  const studentCanvasRef = useRef(null);
  const studentStreamRef = useRef(null);

  const adminHeaders = getAdminAuthHeaders(adminSession.token);
  const totalPendingLeaveRequests = leaveRequests.filter(
    (leaveRequest) => leaveRequest.status === "pending",
  ).length;
  const attendancePresetOptions = [
    { label: "Today", value: "today" },
    { label: "Last 7 Days", value: "last7" },
    { label: "Last 30 Days", value: "last30" },
    { label: "This Month", value: "thisMonth" },
  ];

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

  useEffect(() => {
    if (studentCameraOpen && studentVideoRef.current && studentStreamRef.current) {
      studentVideoRef.current.srcObject = studentStreamRef.current;
    }
  }, [studentCameraOpen]);

  useEffect(() => () => {
    stopStudentCamera(false);
  }, []);

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
    setStudentCameraError("");
    stopStudentCamera();
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
        message: "Please capture a face image before registering the student.",
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
      const [sortBy, sortDirection] = attendanceFilters.sortOrder.split(":");
      const queryString = buildQueryString({
        search: attendanceFilters.search.trim(),
        status: attendanceFilters.status === "all" ? null : attendanceFilters.status,
        student_id:
          attendanceFilters.studentId === "all" ? null : attendanceFilters.studentId,
        date_from: normalizedDateFrom || null,
        date_to: normalizedDateTo || null,
        sort_by: sortBy,
        sort_direction: sortDirection,
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
      link.download = buildAttendanceExportFileName({
        ...attendanceFilters,
        dateFrom: normalizedDateFrom,
        dateTo: normalizedDateTo,
      });
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

  function applyAttendancePreset(preset) {
    const presetDates = getAttendancePresetDates(preset);

    setAttendanceFilters((current) => ({
      ...current,
      ...presetDates,
      preset,
    }));
  }

  function clearAttendanceFilters() {
    setAttendanceFilters(createFilterState());
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

  const parsedDateFrom = parseDateInputValue(attendanceFilters.dateFrom);
  const parsedDateTo = parseDateInputValue(attendanceFilters.dateTo);
  const normalizedDateFrom =
    parsedDateFrom && parsedDateTo && parsedDateFrom > parsedDateTo
      ? attendanceFilters.dateTo
      : attendanceFilters.dateFrom;
  const normalizedDateTo =
    parsedDateFrom && parsedDateTo && parsedDateFrom > parsedDateTo
      ? attendanceFilters.dateFrom
      : attendanceFilters.dateTo;

  const filteredAttendance = attendance.filter((record) => {
    const matchesSearch = `${record.student_name} ${record.student_id} ${record.status}`
      .toLowerCase()
      .includes(attendanceFilters.search.toLowerCase());
    const matchesStatus =
      attendanceFilters.status === "all" || record.status === attendanceFilters.status;
    const matchesStudent =
      attendanceFilters.studentId === "all" ||
      String(record.student_id) === attendanceFilters.studentId;
    const recordDate = toDateInputValue(record.marked_at);
    const matchesDateFrom = !normalizedDateFrom || recordDate >= normalizedDateFrom;
    const matchesDateTo = !normalizedDateTo || recordDate <= normalizedDateTo;

    return matchesSearch && matchesStatus && matchesStudent && matchesDateFrom && matchesDateTo;
  });

  const [attendanceSortBy, attendanceSortDirection] = attendanceFilters.sortOrder.split(":");
  const sortedAttendance = [...filteredAttendance].sort((leftRecord, rightRecord) => {
    let leftValue;
    let rightValue;

    if (attendanceSortBy === "student_name") {
      leftValue = leftRecord.student_name;
      rightValue = rightRecord.student_name;
    } else if (attendanceSortBy === "status") {
      leftValue = leftRecord.status;
      rightValue = rightRecord.status;
    } else if (attendanceSortBy === "student_id") {
      leftValue = leftRecord.student_id;
      rightValue = rightRecord.student_id;
    } else {
      leftValue = new Date(leftRecord.marked_at).getTime();
      rightValue = new Date(rightRecord.marked_at).getTime();
    }

    if (typeof leftValue === "string" || typeof rightValue === "string") {
      leftValue = String(leftValue || "").toLowerCase();
      rightValue = String(rightValue || "").toLowerCase();
    }

    if (leftValue < rightValue) {
      return attendanceSortDirection === "asc" ? -1 : 1;
    }

    if (leftValue > rightValue) {
      return attendanceSortDirection === "asc" ? 1 : -1;
    }

    return 0;
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

    const reportDateKey = toDateInputValue(record.marked_at);
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

  const filteredPendingLeaveRequests = filteredLeaveRequests.filter(
    (leaveRequest) => leaveRequest.status === "pending",
  ).length;
  const filteredApprovedLeaveRequests = filteredLeaveRequests.filter(
    (leaveRequest) => leaveRequest.status === "approved",
  ).length;
  const filteredRejectedLeaveRequests = filteredLeaveRequests.filter(
    (leaveRequest) => leaveRequest.status === "rejected",
  ).length;
  const adminInitials = getAdminInitials(adminSession.username);

  if (!sessionReady) {
    return (
      <main className={ADMIN_SHELL_CLASSNAME}>
        <div className="mx-auto flex min-h-[80vh] max-w-7xl items-center justify-center">
          <Card className="w-full max-w-xl border-white/80 bg-white/92 text-center shadow-[0_18px_60px_rgba(15,23,42,0.08)] backdrop-blur-sm">
            <CardHeader className="gap-4 p-8">
              <Badge variant="outline" className="mx-auto rounded-full border-blue-200 bg-blue-50 px-3 py-1 text-blue-700">
                WhosHere
              </Badge>
              <CardTitle className="text-3xl">Loading admin dashboard...</CardTitle>
              <CardDescription className="text-sm leading-6">
                Preparing student records, attendance history, and leave requests.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <>
      <main className={ADMIN_SHELL_CLASSNAME}>
        <div className="mx-auto max-w-7xl space-y-6">
          <Card className="overflow-hidden border-white/80 bg-white/88 shadow-[0_20px_90px_rgba(15,23,42,0.08)] backdrop-blur-sm">
            <CardHeader className="gap-6 p-6">
              <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
                <div className="max-w-3xl">
                  <Badge
                    variant="outline"
                    className="rounded-full border-amber-200 bg-amber-50 px-3 py-1 text-amber-700"
                  >
                    Admin Workspace
                  </Badge>
                  <CardTitle className="mt-4 text-4xl tracking-tight text-slate-950">
                    WhosHere Admin
                  </CardTitle>
                  <CardDescription className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
                    Everything from student enrollment to attendance corrections now lives inside
                    one admin workspace. Open the admin menu to jump between sections quickly.
                  </CardDescription>
                </div>

                <div className="flex flex-col gap-4 xl:items-end">
                  <div className="flex flex-wrap items-center justify-end gap-3">
                    <Button
                      type="button"
                      size="lg"
                      className="rounded-full"
                      onClick={loadDashboard}
                    >
                      <RefreshCcw className={`size-4 ${isLoadingDashboard ? "animate-spin" : ""}`} />
                      {isLoadingDashboard ? "Refreshing..." : "Refresh Dashboard"}
                    </Button>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="outline"
                          size="lg"
                          className="h-auto min-w-[16rem] justify-between rounded-full px-3 py-2.5 shadow-sm"
                        >
                          <span className="flex items-center gap-3">
                            <Avatar className="size-11 border border-white shadow-sm">
                              <AvatarFallback className="bg-slate-950 text-sm text-white">
                                {adminInitials}
                              </AvatarFallback>
                            </Avatar>

                            <span className="min-w-0 text-left">
                              <span className="block truncate text-sm font-semibold text-slate-950">
                                {adminSession.username}
                              </span>
                              <span className="block text-xs text-slate-500">Admin Menu</span>
                            </span>
                          </span>

                          <ChevronDown className="size-4 text-muted-foreground" />
                        </Button>
                      </DropdownMenuTrigger>

                      <DropdownMenuContent align="end" className="w-80 p-2">
                        <DropdownMenuLabel className="rounded-2xl bg-slate-50 px-3 py-3">
                          <div className="flex items-center gap-3">
                            <Avatar className="size-12 border border-slate-200 bg-white shadow-sm">
                              <AvatarFallback className="bg-slate-950 text-sm text-white">
                                {adminInitials}
                              </AvatarFallback>
                            </Avatar>

                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-slate-950">
                                {adminSession.username}
                              </p>
                              <p className="mt-1 text-xs font-normal text-slate-500">
                                Administrator Panel
                              </p>
                              <p className="text-xs font-normal text-slate-500">
                                {students.length} students, {attendance.length} entries,{" "}
                                {totalPendingLeaveRequests} pending
                              </p>
                            </div>
                          </div>
                        </DropdownMenuLabel>

                        <DropdownMenuSeparator />

                        {SECTION_LINKS.map((link) => (
                          <AdminMenuLinkRow
                            key={link.sectionId}
                            label={link.label}
                            sectionId={link.sectionId}
                            icon={link.icon}
                            accentClass={link.accentClass}
                            iconClass={link.iconClass}
                            description={link.description}
                          />
                        ))}

                        <DropdownMenuSeparator />

                        <DropdownMenuItem
                          onSelect={(event) => {
                            event.preventDefault();
                            logout();
                          }}
                          className="rounded-2xl px-3 py-3 text-rose-600 focus:bg-rose-50 focus:text-rose-700"
                        >
                          <span className="flex size-10 items-center justify-center rounded-2xl bg-rose-100 text-rose-600">
                            <LogOut className="size-4" />
                          </span>
                          <span className="flex-1 text-sm font-semibold">Logout</span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <div className="grid w-full gap-3 sm:grid-cols-3 xl:min-w-[28rem]">
                    <div className="rounded-2xl border border-slate-200 bg-white/90 p-3 shadow-sm">
                      <p className="text-[0.68rem] uppercase tracking-[0.2em] text-slate-400">
                        Students
                      </p>
                      <p className="mt-2 text-xl font-semibold text-slate-950">{students.length}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white/90 p-3 shadow-sm">
                      <p className="text-[0.68rem] uppercase tracking-[0.2em] text-slate-400">
                        Entries
                      </p>
                      <p className="mt-2 text-xl font-semibold text-slate-950">{attendance.length}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white/90 p-3 shadow-sm">
                      <p className="text-[0.68rem] uppercase tracking-[0.2em] text-slate-400">
                        Pending
                      </p>
                      <p className="mt-2 text-xl font-semibold text-slate-950">
                        {totalPendingLeaveRequests}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                <span className="font-medium text-slate-700">Admin workspace</span>
                <span>Use the dropdown to jump between dashboard sections.</span>
                <span>Enrollment, attendance, and leave controls stay on one page.</span>
              </div>
            </CardHeader>
          </Card>

          <div className="space-y-6">
            <SectionPanel id="overview-section">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <SectionIntro
                  eyebrow="Dashboard Overview"
                  title="Admin control with live student data"
                  description="Manage students, prevent duplicate attendance, review leave requests, and correct attendance records from one place."
                />

                <Button type="button" size="lg" className="rounded-full" onClick={loadDashboard}>
                  <RefreshCcw className={`size-4 ${isLoadingDashboard ? "animate-spin" : ""}`} />
                  {isLoadingDashboard ? "Refreshing..." : "Refresh Dashboard"}
                </Button>
              </div>

              <AdminMessage
                message={dashboardError ? { type: "error", message: dashboardError } : null}
                className="mt-5"
              />

              <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <MetricCard label="Registered Students" value={students.length} />
                <MetricCard label="Attendance Entries" value={attendance.length} />
                <MetricCard label="Pending Leave Requests" value={totalPendingLeaveRequests} />
                <MetricCard label="Dashboard Status" value={isLoadingDashboard ? "Loading" : "Ready"} />
              </div>
            </SectionPanel>

            <SectionPanel id="register-section">
              <div className="grid gap-6 lg:grid-cols-[1.04fr,0.96fr]">
                <div>
                  <SectionIntro
                    eyebrow="Student Enrollment"
                    title="Register a new student"
                    description="Create a student account, capture a live face photo, and preview the captured image before saving."
                  />

                  <AdminMessage message={studentMessage} className="mt-5" />

                  <form onSubmit={handleRegisterStudent} className="mt-6 space-y-5">
                    <FieldBlock label="Full Name" htmlFor="student-full-name">
                      <Input
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
                        className={ADMIN_FIELD_CLASSNAME}
                      />
                    </FieldBlock>

                    <div className="grid gap-4 md:grid-cols-2">
                      <FieldBlock label="Email" htmlFor="student-email">
                        <Input
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
                          className={ADMIN_FIELD_CLASSNAME}
                        />
                      </FieldBlock>

                      <PasswordField
                        label="Password"
                        value={studentForm.password}
                        onChange={(event) =>
                          setStudentForm((current) => ({
                            ...current,
                            password: event.target.value,
                          }))
                        }
                        placeholder="Create a secure password"
                        inputClassName={ADMIN_FIELD_CLASSNAME}
                      />
                    </div>

                    <Card className="rounded-[1.75rem] border-border/80 bg-slate-50/80 shadow-none">
                      <CardContent className="p-5">
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div>
                            <Badge variant="outline" className="rounded-full px-3 py-1">
                              Live Face Capture
                            </Badge>
                            <p className="mt-3 text-sm leading-6 text-slate-600">
                              Use the live camera to capture a clear front-facing face photo for
                              enrollment.
                            </p>
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

                        <AdminMessage
                          message={
                            studentCameraError
                              ? { type: "error", message: studentCameraError }
                              : null
                          }
                          className="mt-4"
                        />

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
                </div>

                <div className="grid gap-4">
                  <canvas ref={studentCanvasRef} className="hidden" />

                  <PhotoPreviewCard
                    title="Capture Preview"
                    subtitle="The captured face image appears here before you register the student."
                    imageUrl={studentPreviewUrl}
                    fallbackLabel="Capture a student face image to preview it here."
                  />

                  <Card className="rounded-[1.75rem] border-border/80 bg-slate-50/80 shadow-none">
                    <CardHeader className="gap-2">
                      <CardTitle className="text-lg">Enrollment Tips</CardTitle>
                      <CardDescription>
                        A clearer enrollment photo and clean account details make recognition and
                        account recovery smoother later.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <Separator className="mb-4" />
                      <ul className="space-y-3 text-sm leading-6 text-slate-600">
                        <li>Ask the student to look straight at the camera in even lighting.</li>
                        <li>Passwords are hashed on the backend before storage.</li>
                        <li>Duplicate student emails are blocked automatically.</li>
                      </ul>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </SectionPanel>

            <SectionPanel id="directory-section">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                <SectionIntro
                  eyebrow="Student Directory"
                  title="View, sort, edit, and delete students"
                  description="Sort the directory in ascending or descending order and open the edit popup to review each student photo and detail set."
                />

                <div className="grid gap-3 sm:grid-cols-3">
                  <Input
                    type="text"
                    placeholder="Search students..."
                    value={studentSearch}
                    onChange={(event) => setStudentSearch(event.target.value)}
                    className={ADMIN_FIELD_CLASSNAME}
                  />

                  <NativeSelect
                    value={studentSortField}
                    onChange={(event) => setStudentSortField(event.target.value)}
                  >
                    <option value="full_name">Sort by Name</option>
                    <option value="student_id">Sort by ID</option>
                    <option value="email">Sort by Email</option>
                    <option value="created_at">Sort by Created Date</option>
                  </NativeSelect>

                  <NativeSelect
                    value={studentSortDirection}
                    onChange={(event) => setStudentSortDirection(event.target.value)}
                  >
                    <option value="asc">Ascending</option>
                    <option value="desc">Descending</option>
                  </NativeSelect>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between gap-4 text-sm text-slate-600">
                <p>
                  Showing <span className="font-semibold text-slate-900">{sortedStudents.length}</span>{" "}
                  of <span className="font-semibold text-slate-900">{students.length}</span> students.
                </p>
                <p className="hidden text-right md:block">
                  Edit records, replace face images, or remove student accounts directly from the
                  directory.
                </p>
              </div>

              <div className="mt-6 overflow-hidden rounded-[1.75rem] border border-border/80 bg-white">
                <Table className="min-w-[70rem]">
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead>Photo</TableHead>
                      <TableHead>ID</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Registered</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {sortedStudents.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan="6" className="h-24 text-slate-500">
                          No students matched the current search and sort settings.
                        </TableCell>
                      </TableRow>
                    ) : (
                      sortedStudents.map((student) => {
                        const photoUrl = buildAssetUrl(student.face_image_url);

                        return (
                          <TableRow key={student.student_id}>
                            <TableCell>
                              <PhotoThumb
                                imageUrl={photoUrl}
                                alt={`${student.full_name} face preview`}
                              />
                            </TableCell>
                            <TableCell className="font-medium">{student.student_id}</TableCell>
                            <TableCell>{student.full_name}</TableCell>
                            <TableCell>{student.email || "-"}</TableCell>
                            <TableCell>{formatDateTime(student.created_at)}</TableCell>
                            <TableCell>
                              <div className="flex justify-end gap-2">
                                <Button
                                  type="button"
                                  size="sm"
                                  className="rounded-full bg-blue-600 hover:bg-blue-700"
                                  onClick={() => openEditModal(student)}
                                >
                                  <PencilLine className="size-4" />
                                  Edit
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="destructive"
                                  className="rounded-full"
                                  onClick={() => handleDeleteStudent(student)}
                                  disabled={deletingStudentId === student.student_id}
                                >
                                  <Trash2 className="size-4" />
                                  {deletingStudentId === student.student_id ? "Deleting..." : "Delete"}
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </SectionPanel>

            <SectionPanel id="attendance-section">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                <SectionIntro
                  eyebrow="Attendance Control"
                  title="Filter, correct, and remove attendance"
                  description="Search by student, filter by date range or quick preset, and sort the results before correcting or deleting attendance records."
                />

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
                  <Input
                    type="text"
                    placeholder="Search attendance..."
                    value={attendanceFilters.search}
                    onChange={(event) =>
                      setAttendanceFilters((current) => ({
                        ...current,
                        search: event.target.value,
                      }))
                    }
                    className={ADMIN_FIELD_CLASSNAME}
                  />

                  <NativeSelect
                    value={attendanceFilters.status}
                    onChange={(event) =>
                      setAttendanceFilters((current) => ({
                        ...current,
                        status: event.target.value,
                      }))
                    }
                  >
                    <option value="all">All Statuses</option>
                    <option value="present">Present</option>
                    <option value="late">Late</option>
                    <option value="absent">Absent</option>
                    <option value="excused">Excused</option>
                  </NativeSelect>

                  <NativeSelect
                    value={attendanceFilters.studentId}
                    onChange={(event) =>
                      setAttendanceFilters((current) => ({
                        ...current,
                        studentId: event.target.value,
                      }))
                    }
                  >
                    <option value="all">All Students</option>
                    {students.map((student) => (
                      <option key={student.student_id} value={String(student.student_id)}>
                        #{student.student_id} {student.full_name}
                      </option>
                    ))}
                  </NativeSelect>

                  <Input
                    type="date"
                    value={attendanceFilters.dateFrom}
                    onChange={(event) =>
                      setAttendanceFilters((current) => ({
                        ...current,
                        dateFrom: event.target.value,
                        preset: "custom",
                      }))
                    }
                    className={ADMIN_FIELD_CLASSNAME}
                  />

                  <Input
                    type="date"
                    value={attendanceFilters.dateTo}
                    min={attendanceFilters.dateFrom || undefined}
                    onChange={(event) =>
                      setAttendanceFilters((current) => ({
                        ...current,
                        dateTo: event.target.value,
                        preset: "custom",
                      }))
                    }
                    className={ADMIN_FIELD_CLASSNAME}
                  />

                  <NativeSelect
                    value={attendanceFilters.sortOrder}
                    onChange={(event) =>
                      setAttendanceFilters((current) => ({
                        ...current,
                        sortOrder: event.target.value,
                      }))
                    }
                  >
                    <option value="marked_at:desc">Latest First</option>
                    <option value="marked_at:asc">Oldest First</option>
                    <option value="student_name:asc">Student A-Z</option>
                    <option value="student_name:desc">Student Z-A</option>
                    <option value="status:asc">Status A-Z</option>
                    <option value="status:desc">Status Z-A</option>
                    <option value="student_id:asc">Student ID Ascending</option>
                    <option value="student_id:desc">Student ID Descending</option>
                  </NativeSelect>
                </div>
              </div>

              <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-wrap gap-2">
                  {attendancePresetOptions.map((option) => (
                    <Button
                      key={option.value}
                      type="button"
                      size="sm"
                      variant={attendanceFilters.preset === option.value ? "default" : "outline"}
                      className={cn(
                        "rounded-full",
                        attendanceFilters.preset === option.value
                          ? "bg-amber-500 hover:bg-amber-600"
                          : "border-amber-200 text-amber-700 hover:bg-amber-50",
                      )}
                      onClick={() => applyAttendancePreset(option.value)}
                    >
                      {option.label}
                    </Button>
                  ))}

                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="rounded-full"
                    onClick={clearAttendanceFilters}
                  >
                    Clear Filters
                  </Button>
                </div>

                <p className="text-sm text-slate-600">
                  Showing <span className="font-semibold text-slate-900">{sortedAttendance.length}</span>{" "}
                  of <span className="font-semibold text-slate-900">{attendance.length}</span>{" "}
                  attendance entries.
                </p>
              </div>

              <AdminMessage message={attendanceMessage} className="mt-5" />

              <Card className="mt-6 rounded-[1.85rem] border-amber-200 bg-amber-50/75 shadow-none">
                <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <Badge className="rounded-full border-0 bg-amber-200/70 px-3 py-1 text-amber-800">
                      Attendance Report
                    </Badge>
                    <CardTitle className="mt-3 text-2xl">Live summary for the current filters</CardTitle>
                    <CardDescription className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                      Review the filtered attendance breakdown below, then export the same dataset
                      as CSV for your report, records, or presentation demo.
                    </CardDescription>
                  </div>

                  <Button
                    type="button"
                    disabled={isExportingAttendance}
                    className="rounded-full bg-amber-500 hover:bg-amber-600"
                    onClick={handleExportAttendanceCsv}
                  >
                    <Download className="size-4" />
                    {isExportingAttendance ? "Exporting CSV..." : "Export CSV Report"}
                  </Button>
                </CardHeader>

                <CardContent>
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
                    <MetricCard label="Filtered Records" value={filteredAttendance.length} accentClass="border-amber-200 bg-white" />
                    <MetricCard label="Unique Students" value={attendanceUniqueStudents} accentClass="border-amber-200 bg-white" />
                    <MetricCard label="Present" value={attendanceStatusSummary.present} accentClass="border-emerald-200 bg-white" />
                    <MetricCard label="Late" value={attendanceStatusSummary.late} accentClass="border-amber-200 bg-white" />
                    <MetricCard label="Absent" value={attendanceStatusSummary.absent} accentClass="border-rose-200 bg-white" />
                    <MetricCard label="Coverage Rate" value={formatPercent(attendanceCoverageRate)} accentClass="border-sky-200 bg-white" />
                  </div>

                  <div className="mt-6 grid gap-6 xl:grid-cols-2">
                    <Card className="rounded-[1.75rem] border-border/80 bg-white shadow-none">
                      <CardHeader className="gap-2">
                        <CardTitle className="text-lg">Daily Breakdown</CardTitle>
                        <CardDescription>Attendance totals grouped by marked date.</CardDescription>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="overflow-hidden rounded-[1.25rem] border border-slate-200">
                          <Table className="min-w-[32rem]">
                            <TableHeader className="bg-slate-50">
                              <TableRow>
                                <TableHead>Date</TableHead>
                                <TableHead>Total</TableHead>
                                <TableHead>Present</TableHead>
                                <TableHead>Late</TableHead>
                                <TableHead>Absent</TableHead>
                                <TableHead>Excused</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {attendanceDailyReportRows.length === 0 ? (
                                <TableRow>
                                  <TableCell colSpan="6" className="h-20 text-slate-500">
                                    No attendance records are available for this report.
                                  </TableCell>
                                </TableRow>
                              ) : (
                                attendanceDailyReportRows.map((row) => (
                                  <TableRow key={row.date}>
                                    <TableCell>{formatDate(row.date)}</TableCell>
                                    <TableCell>{row.total}</TableCell>
                                    <TableCell>{row.present}</TableCell>
                                    <TableCell>{row.late}</TableCell>
                                    <TableCell>{row.absent}</TableCell>
                                    <TableCell>{row.excused}</TableCell>
                                  </TableRow>
                                ))
                              )}
                            </TableBody>
                          </Table>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="rounded-[1.75rem] border-border/80 bg-white shadow-none">
                      <CardHeader className="gap-2">
                        <CardTitle className="text-lg">Student Breakdown</CardTitle>
                        <CardDescription>Per-student attendance totals for the current report.</CardDescription>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="overflow-hidden rounded-[1.25rem] border border-slate-200">
                          <Table className="min-w-[42rem]">
                            <TableHeader className="bg-slate-50">
                              <TableRow>
                                <TableHead>Student</TableHead>
                                <TableHead>Total</TableHead>
                                <TableHead>Present</TableHead>
                                <TableHead>Late</TableHead>
                                <TableHead>Absent</TableHead>
                                <TableHead>Excused</TableHead>
                                <TableHead>Last Marked</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {attendanceStudentReportRows.length === 0 ? (
                                <TableRow>
                                  <TableCell colSpan="7" className="h-20 text-slate-500">
                                    No student attendance data is available for this report.
                                  </TableCell>
                                </TableRow>
                              ) : (
                                attendanceStudentReportRows.map((row) => (
                                  <TableRow key={row.student_id}>
                                    <TableCell>
                                      <div>
                                        <p className="font-medium text-slate-900">{row.student_name}</p>
                                        <p className="text-xs text-slate-500">ID #{row.student_id}</p>
                                      </div>
                                    </TableCell>
                                    <TableCell>{row.total}</TableCell>
                                    <TableCell>{row.present}</TableCell>
                                    <TableCell>{row.late}</TableCell>
                                    <TableCell>{row.absent}</TableCell>
                                    <TableCell>{row.excused}</TableCell>
                                    <TableCell>{formatDateTime(row.latest_marked_at)}</TableCell>
                                  </TableRow>
                                ))
                              )}
                            </TableBody>
                          </Table>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </CardContent>
              </Card>

              <div className="mt-6 overflow-hidden rounded-[1.75rem] border border-border/80 bg-white">
                <Table className="min-w-[78rem]">
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead>Student</TableHead>
                      <TableHead>ID</TableHead>
                      <TableHead>Current Status</TableHead>
                      <TableHead>Marked At</TableHead>
                      <TableHead>Edit Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedAttendance.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan="6" className="h-24 text-slate-500">
                          No attendance records matched the selected filters.
                        </TableCell>
                      </TableRow>
                    ) : (
                      sortedAttendance.map((record) => (
                        <TableRow key={record.id}>
                          <TableCell>{record.student_name}</TableCell>
                          <TableCell>{record.student_id}</TableCell>
                          <TableCell>
                            <StatusPill status={record.status} />
                          </TableCell>
                          <TableCell>{formatDateTime(record.marked_at)}</TableCell>
                          <TableCell>
                            <NativeSelect
                              value={attendanceDrafts[record.id] || record.status}
                              onChange={(event) =>
                                setAttendanceDrafts((current) => ({
                                  ...current,
                                  [record.id]: event.target.value,
                                }))
                              }
                              className="h-10 rounded-xl bg-white px-3 py-2"
                            >
                              <option value="present">Present</option>
                              <option value="late">Late</option>
                              <option value="absent">Absent</option>
                              <option value="excused">Excused</option>
                            </NativeSelect>
                          </TableCell>
                          <TableCell>
                            <div className="flex justify-end gap-2">
                              <Button
                                type="button"
                                size="sm"
                                className="rounded-full bg-amber-500 hover:bg-amber-600"
                                onClick={() => handleUpdateAttendance(record)}
                                disabled={updatingAttendanceId === record.id}
                              >
                                {updatingAttendanceId === record.id ? "Saving..." : "Save"}
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="destructive"
                                className="rounded-full"
                                onClick={() => handleDeleteAttendance(record)}
                                disabled={deletingAttendanceId === record.id}
                              >
                                {deletingAttendanceId === record.id ? "Deleting..." : "Delete"}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </SectionPanel>

            <SectionPanel id="leave-section">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                <SectionIntro
                  eyebrow="Leave Requests"
                  title="Review and decide student leave requests"
                  description="Pending requests can be approved or rejected here, and old requests can be removed if needed."
                />

                <div className="grid gap-3 sm:grid-cols-2">
                  <Input
                    type="text"
                    placeholder="Search leave requests..."
                    value={leaveFilters.search}
                    onChange={(event) =>
                      setLeaveFilters((current) => ({
                        ...current,
                        search: event.target.value,
                      }))
                    }
                    className={ADMIN_FIELD_CLASSNAME}
                  />

                  <NativeSelect
                    value={leaveFilters.status}
                    onChange={(event) =>
                      setLeaveFilters((current) => ({
                        ...current,
                        status: event.target.value,
                      }))
                    }
                  >
                    <option value="all">All Statuses</option>
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                  </NativeSelect>
                </div>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-3">
                <MetricCard label="Pending" value={filteredPendingLeaveRequests} accentClass="border-amber-200 bg-amber-50/70" />
                <MetricCard label="Approved" value={filteredApprovedLeaveRequests} accentClass="border-emerald-200 bg-emerald-50/70" />
                <MetricCard label="Rejected" value={filteredRejectedLeaveRequests} accentClass="border-rose-200 bg-rose-50/70" />
              </div>

              <AdminMessage message={leaveMessage} className="mt-5" />

              <div className="mt-6 overflow-hidden rounded-[1.75rem] border border-border/80 bg-white">
                <Table className="min-w-[82rem]">
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead>Student</TableHead>
                      <TableHead>Dates</TableHead>
                      <TableHead>Days</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Current Status</TableHead>
                      <TableHead>Update Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {filteredLeaveRequests.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan="7" className="h-24 text-slate-500">
                          No leave requests matched the current filters.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredLeaveRequests.map((leaveRequest) => (
                        <TableRow key={leaveRequest.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium text-slate-900">{leaveRequest.student_name}</p>
                              <p className="text-xs text-slate-500">ID #{leaveRequest.student_id}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            {formatDate(leaveRequest.start_date)} to {formatDate(leaveRequest.end_date)}
                          </TableCell>
                          <TableCell>{leaveRequest.days_requested}</TableCell>
                          <TableCell>
                            <p className="max-w-xs whitespace-pre-wrap text-slate-700">
                              {leaveRequest.reason}
                            </p>
                          </TableCell>
                          <TableCell>
                            <StatusPill status={leaveRequest.status} />
                          </TableCell>
                          <TableCell>
                            <NativeSelect
                              value={leaveDrafts[leaveRequest.id] || leaveRequest.status}
                              onChange={(event) =>
                                setLeaveDrafts((current) => ({
                                  ...current,
                                  [leaveRequest.id]: event.target.value,
                                }))
                              }
                              className="h-10 rounded-xl bg-white px-3 py-2"
                            >
                              <option value="pending">Pending</option>
                              <option value="approved">Approved</option>
                              <option value="rejected">Rejected</option>
                            </NativeSelect>
                          </TableCell>
                          <TableCell>
                            <div className="flex justify-end gap-2">
                              <Button
                                type="button"
                                size="sm"
                                className="rounded-full bg-blue-600 hover:bg-blue-700"
                                onClick={() => handleUpdateLeaveRequest(leaveRequest)}
                                disabled={updatingLeaveId === leaveRequest.id}
                              >
                                {updatingLeaveId === leaveRequest.id ? "Saving..." : "Save"}
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="destructive"
                                className="rounded-full"
                                onClick={() => handleDeleteLeaveRequest(leaveRequest)}
                                disabled={deletingLeaveId === leaveRequest.id}
                              >
                                {deletingLeaveId === leaveRequest.id ? "Deleting..." : "Delete"}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </SectionPanel>
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
