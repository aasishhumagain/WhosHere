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
  },
  {
    href: "/student/leave",
    label: "Leave Requests",
  },
  {
    href: "/student/profile",
    label: "Profile",
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
              <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 px-5 py-4 text-sm text-slate-600">
                <p className="font-semibold text-slate-900">{studentSession.studentName}</p>
                <p className="mt-1">Student ID: {studentSession.studentId}</p>
                <p className="mt-1">
                  {studentSession.studentEmail || "No email added to this account yet."}
                </p>
              </div>

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
                    className={`rounded-2xl px-4 py-3 text-sm font-medium transition ${
                      MENU_LINKS.some((link) => isLinkActive(pathname, link.href))
                        ? "bg-amber-500 text-slate-950 shadow-[0_12px_30px_rgba(245,158,11,0.18)]"
                        : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    More Pages
                  </button>

                  {menuOpen ? (
                    <div className="absolute right-0 top-[calc(100%+0.75rem)] z-10 w-60 rounded-[1.5rem] border border-slate-200 bg-white p-2 shadow-[0_25px_80px_rgba(15,23,42,0.14)]">
                      {MENU_LINKS.map((link) => (
                        <Link
                          key={link.href}
                          href={link.href}
                          onClick={() => setMenuOpen(false)}
                          className={`block rounded-[1.1rem] px-4 py-3 text-sm transition ${
                            isLinkActive(pathname, link.href)
                              ? "bg-slate-950 text-white"
                              : "text-slate-700 hover:bg-slate-50"
                          }`}
                        >
                          {link.label}
                        </Link>
                      ))}
                    </div>
                  ) : null}
                </div>

                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={loggingOut}
                  className="rounded-2xl bg-red-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-red-300"
                >
                  {loggingOut ? "Logging Out..." : "Logout"}
                </button>
              </div>
            </div>
          </div>
        </header>

        {children}
      </div>
    </main>
  );
}
