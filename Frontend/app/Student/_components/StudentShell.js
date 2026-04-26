"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import {
  clearStudentSessionStorage,
  logoutStudent,
} from "../_lib/student-portal";

const PRIMARY_LINKS = [
  {
    href: "/student",
    label: "Student Dashboard",
  },
  {
    href: "/student/capture",
    label: "Attendance Capture",
  },
];

const MENU_LINKS = [
  {
    href: "/student/history",
    label: "Attendance History",
    badge: "AH",
  },
  {
    href: "/student/leave",
    label: "Leave Requests",
    badge: "LV",
  },
  {
    href: "/student/profile",
    label: "Profile",
    badge: "PR",
  },
  {
    href: "/student/profile#change-password-section",
    label: "Change Password",
    badge: "PW",
  },
];

function isLinkActive(pathname, href) {
  if (href === "/student") {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLink({ href, label, active }) {
  return (
    <Link
      href={href}
      className={`rounded-2xl px-4 py-3 text-sm font-medium transition ${
        active
          ? "bg-slate-950 text-white shadow-[0_12px_30px_rgba(15,23,42,0.16)]"
          : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
      }`}
    >
      {label}
    </Link>
  );
}

function getStudentInitials(studentName) {
  const parts = String(studentName || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) {
    return "ST";
  }

  return parts
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

function MenuLinkRow({ href, label, badge, active, onClick }) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`flex items-center justify-between rounded-[1.1rem] px-3 py-3 text-sm transition ${
        active ? "bg-slate-950 text-white" : "text-slate-700 hover:bg-slate-50"
      }`}
    >
      <div className="flex items-center gap-3">
        <span
          className={`inline-flex h-9 w-9 items-center justify-center rounded-full text-[0.7rem] font-semibold ${
            active ? "bg-white/12 text-white" : "bg-slate-100 text-slate-600"
          }`}
        >
          {badge}
        </span>
        <span>{label}</span>
      </div>
      <span className={`text-xs ${active ? "text-white/80" : "text-slate-400"}`}>{">"}</span>
    </Link>
  );
}

export default function StudentShell({
  studentSession,
  pageLabel,
  title,
  subtitle,
  children,
}) {
  const router = useRouter();
  const pathname = usePathname();
  const menuRef = useRef(null);

  const [menuOpen, setMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const studentInitials = getStudentInitials(studentSession.studentName);
  const hasActiveMenuPage = MENU_LINKS.some((link) => {
    if (link.href.startsWith("/student/profile#")) {
      return pathname === "/student/profile";
    }

    return isLinkActive(pathname, link.href);
  });

  useEffect(() => {
    if (!menuOpen) {
      return undefined;
    }

    function handlePointerDown(event) {
      if (!menuRef.current?.contains(event.target)) {
        setMenuOpen(false);
      }
    }

    window.addEventListener("pointerdown", handlePointerDown);

    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, [menuOpen]);

  async function handleLogout() {
    setLoggingOut(true);

    try {
      await logoutStudent(studentSession.studentToken);
    } catch {
      // Best effort logout.
    } finally {
      clearStudentSessionStorage();
      router.push("/");
    }
  }

  return (
    <main className="min-h-screen bg-[linear-gradient(140deg,#f8fafc_0%,#e0f2fe_52%,#fef3c7_100%)] px-4 py-6 text-slate-900 md:px-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-[0_25px_80px_rgba(15,23,42,0.08)] backdrop-blur">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-3xl">
              <p className="text-sm font-semibold uppercase tracking-[0.28em] text-blue-700">
                {pageLabel}
              </p>
              <h1 className="mt-3 text-4xl font-semibold text-slate-950">{title}</h1>
              <p className="mt-3 text-sm leading-6 text-slate-600">{subtitle}</p>
            </div>

            <div className="flex flex-col gap-4 xl:items-end">
              <div className="flex flex-wrap items-center gap-3">
                {PRIMARY_LINKS.map((link) => (
                  <NavLink
                    key={link.href}
                    href={link.href}
                    label={link.label}
                    active={isLinkActive(pathname, link.href)}
                  />
                ))}

                <div className="relative" ref={menuRef}>
                  <button
                    type="button"
                    onClick={() => setMenuOpen((current) => !current)}
                    className={`flex items-center gap-3 rounded-[1.5rem] border px-3 py-2 text-left transition ${
                      hasActiveMenuPage || menuOpen
                        ? "border-slate-900 bg-slate-950 text-white shadow-[0_14px_32px_rgba(15,23,42,0.18)]"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <div className="relative">
                      <div
                        className={`flex h-11 w-11 items-center justify-center rounded-full text-sm font-semibold ${
                          hasActiveMenuPage || menuOpen
                            ? "bg-white/12 text-white"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {studentInitials}
                      </div>
                      <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white bg-emerald-500" />
                    </div>

                    <div className="min-w-[9rem]">
                      <p
                        className={`text-sm font-semibold ${
                          hasActiveMenuPage || menuOpen ? "text-white" : "text-slate-900"
                        }`}
                      >
                        {studentSession.studentName}
                      </p>
                      <p
                        className={`mt-0.5 text-xs ${
                          hasActiveMenuPage || menuOpen ? "text-slate-300" : "text-slate-500"
                        }`}
                      >
                        Account Menu
                      </p>
                    </div>

                    <span
                      className={`text-xs transition ${menuOpen ? "rotate-180" : ""} ${
                        hasActiveMenuPage || menuOpen ? "text-slate-300" : "text-slate-400"
                      }`}
                    >
                      v
                    </span>
                  </button>

                  {menuOpen ? (
                    <div className="absolute right-0 top-[calc(100%+0.75rem)] z-10 w-[20rem] rounded-[1.5rem] border border-slate-200 bg-white p-3 shadow-[0_25px_80px_rgba(15,23,42,0.14)]">
                      <div className="flex items-center gap-3 rounded-[1.2rem] border border-slate-200 bg-slate-50 px-3 py-3">
                        <div className="relative">
                          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-950 text-sm font-semibold text-white">
                            {studentInitials}
                          </div>
                          <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-slate-50 bg-emerald-500" />
                        </div>

                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-900">
                            {studentSession.studentName}
                          </p>
                          <p className="mt-1 truncate text-xs text-slate-500">
                            Student ID: {studentSession.studentId}
                          </p>
                          <p className="mt-1 truncate text-xs text-slate-500">
                            {studentSession.studentEmail || "No email added yet"}
                          </p>
                        </div>
                      </div>

                      <div className="mt-3 space-y-1">
                        {MENU_LINKS.map((link) => (
                          <MenuLinkRow
                            key={link.href}
                            href={link.href}
                            label={link.label}
                            badge={link.badge}
                            active={
                              link.href.startsWith("/student/profile#")
                                ? pathname === "/student/profile"
                                : isLinkActive(pathname, link.href)
                            }
                            onClick={() => setMenuOpen(false)}
                          />
                        ))}
                      </div>

                      <button
                        type="button"
                        onClick={handleLogout}
                        disabled={loggingOut}
                        className="mt-3 flex w-full items-center justify-between rounded-[1.1rem] bg-red-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-red-300"
                      >
                        <div className="flex items-center gap-3">
                          <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/12 text-[0.7rem] font-semibold">
                            LO
                          </span>
                          <span>{loggingOut ? "Logging Out..." : "Logout"}</span>
                        </div>
                        <span className="text-xs text-white/80">{">"}</span>
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </header>

        {children}
      </div>
    </main>
  );
}
