"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Camera,
  ChevronDown,
  Clock3,
  GraduationCap,
  IdCard,
  LayoutDashboard,
  LogOut,
  Mail,
  UserRound,
  Waves,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  clearStudentSessionStorage,
  logoutStudent,
} from "../_lib/student-portal";

const PRIMARY_LINKS = [
  {
    href: "/student",
    label: "Student Dashboard",
    icon: LayoutDashboard,
  },
  {
    href: "/student/capture",
    label: "Attendance Capture",
    icon: Camera,
  },
];

const MENU_LINKS = [
  {
    href: "/student/history",
    label: "Attendance History",
    icon: Clock3,
    description: "Review marked attendance",
  },
  {
    href: "/student/leave",
    label: "Leave Requests",
    icon: Waves,
    description: "Submit and track leave",
  },
  {
    href: "/student/profile",
    label: "Profile",
    icon: UserRound,
    description: "See account details",
  },
];

function isLinkActive(pathname, href) {
  const normalizedHref = href.split("#")[0];

  if (normalizedHref === "/student") {
    return pathname === normalizedHref;
  }

  return pathname === normalizedHref || pathname.startsWith(`${normalizedHref}/`);
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

function MenuLinkRow({ href, label, icon: Icon, description, active }) {
  return (
    <DropdownMenuItem
      asChild
      className={cn(
        "rounded-2xl px-3 py-3 focus:bg-accent/70",
        active && "bg-primary/8 text-foreground",
      )}
    >
      <Link href={href} className="flex w-full items-center gap-3">
        {Icon ? (
          <span
            className={cn(
              "flex size-9 items-center justify-center rounded-xl border border-border/80 bg-white text-muted-foreground",
              active && "border-primary/20 bg-primary/10 text-primary",
            )}
          >
            <Icon className="size-4" />
          </span>
        ) : (
          <span className="w-2" />
        )}

        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium">{label}</span>
          <span className="block truncate text-xs text-muted-foreground">
            {description}
          </span>
        </span>
      </Link>
    </DropdownMenuItem>
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

  const [loggingOut, setLoggingOut] = useState(false);
  const studentInitials = getStudentInitials(studentSession.studentName);
  const hasActiveMenuPage = MENU_LINKS.some((link) => isLinkActive(pathname, link.href));
  const studentGrade = String(studentSession.studentGrade || "").trim();
  const studentEmail = String(studentSession.studentEmail || "").trim();

  async function handleLogout() {
    setLoggingOut(true);

    try {
      await logoutStudent(studentSession.studentToken);
    } catch {
      // Best effort logout.
    } finally {
      clearStudentSessionStorage();
      router.push("/login");
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(191,219,254,0.7),transparent_24%),radial-gradient(circle_at_85%_18%,rgba(254,240,138,0.45),transparent_20%),linear-gradient(180deg,#f8fbff_0%,#eef4ff_54%,#f9fafb_100%)] px-4 py-6 text-slate-900 md:px-6">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-[-10rem] top-[-8rem] size-80 rounded-full bg-primary/8 blur-3xl" />
        <div className="absolute bottom-[-10rem] right-[-4rem] size-96 rounded-full bg-sky-300/25 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-7xl space-y-6">
        <Card className="overflow-hidden border-white/80 bg-white/88 shadow-[0_20px_90px_rgba(15,23,42,0.08)] backdrop-blur-sm">
          <CardHeader className="gap-6 p-6">
            <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
              <div className="max-w-3xl">
                <Badge variant="outline" className="rounded-full border-primary/15 bg-primary/6 px-3 py-1 text-primary">
                  {pageLabel}
                </Badge>
                <CardTitle className="mt-4 text-4xl tracking-tight text-slate-950">
                  {title}
                </CardTitle>
                <CardDescription className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
                  {subtitle}
                </CardDescription>
              </div>

              <div className="flex flex-col gap-4 xl:items-end">
                <div className="flex flex-wrap items-center justify-end gap-3">
                  {PRIMARY_LINKS.map((link) => {
                    const active = isLinkActive(pathname, link.href);
                    const Icon = link.icon;

                    return (
                      <Link
                        key={link.href}
                        href={link.href}
                        className={cn(
                          buttonVariants({
                            variant: active ? "default" : "outline",
                            size: "lg",
                          }),
                          "rounded-full",
                        )}
                      >
                        <Icon className="size-4" />
                        {link.label}
                      </Link>
                    );
                  })}

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant={hasActiveMenuPage ? "secondary" : "outline"}
                        size="lg"
                        className={cn(
                          "h-auto min-w-[15rem] justify-between rounded-full px-3 py-2.5 shadow-sm",
                          hasActiveMenuPage && "border-primary/15 bg-primary/7 text-foreground",
                        )}
                      >
                        <span className="flex items-center gap-3">
                          <Avatar className="size-11 border border-white shadow-sm">
                            <AvatarFallback className="bg-slate-950 text-sm text-white">
                              {studentInitials}
                            </AvatarFallback>
                          </Avatar>

                          <span className="min-w-0 text-left">
                            <span className="block truncate text-sm font-semibold text-slate-950">
                              {studentSession.studentName}
                            </span>
                            <span className="block text-xs text-muted-foreground">
                              Account Menu
                            </span>
                          </span>
                        </span>

                        <ChevronDown className="size-4 text-muted-foreground" />
                      </Button>
                    </DropdownMenuTrigger>

                    <DropdownMenuContent align="end" className="w-80 p-2">
                      <DropdownMenuLabel className="rounded-2xl bg-slate-50 px-3 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar className="size-12 border border-border bg-white shadow-sm">
                            <AvatarFallback className="bg-slate-950 text-sm text-white">
                              {studentInitials}
                            </AvatarFallback>
                          </Avatar>

                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-950">
                              {studentSession.studentName}
                            </p>
                            <p className="mt-1 truncate text-xs font-normal text-muted-foreground">
                              Student workspace
                            </p>
                            <p className="truncate text-xs font-normal text-muted-foreground">
                              ID {studentSession.studentId || "Not assigned"}
                              {studentGrade ? ` • Grade ${studentGrade}` : ""}
                            </p>
                          </div>
                        </div>
                      </DropdownMenuLabel>

                      <DropdownMenuSeparator />

                      {MENU_LINKS.map((link) => (
                        <MenuLinkRow
                          key={link.href}
                          href={link.href}
                          label={link.label}
                          icon={link.icon}
                          description={link.description}
                          active={isLinkActive(pathname, link.href)}
                        />
                      ))}

                      <DropdownMenuSeparator />

                      <DropdownMenuItem
                        onSelect={(event) => {
                          event.preventDefault();
                          handleLogout();
                        }}
                        disabled={loggingOut}
                        className="rounded-2xl px-3 py-3 text-rose-600 focus:bg-rose-50 focus:text-rose-700"
                      >
                        <span className="flex size-9 items-center justify-center rounded-xl bg-rose-100 text-rose-600">
                          <LogOut className="size-4" />
                        </span>
                        <span className="flex-1 text-sm font-medium">
                          {loggingOut ? "Logging Out..." : "Logout"}
                        </span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="flex w-full max-w-[33rem] flex-wrap items-center gap-2 rounded-[1.5rem] border border-border/70 bg-white/90 px-3 py-3 text-xs shadow-sm">
                  <Badge
                    variant="outline"
                    className="rounded-full border-sky-200 bg-sky-50 px-3 py-1 text-sky-700"
                  >
                    <IdCard className="mr-1 size-3.5" />
                    ID {studentSession.studentId || "Not assigned"}
                  </Badge>

                  {studentGrade ? (
                    <Badge
                      variant="outline"
                      className="rounded-full border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-700"
                    >
                      <GraduationCap className="mr-1 size-3.5" />
                      Grade {studentGrade}
                    </Badge>
                  ) : null}

                  {studentEmail ? (
                    <span className="inline-flex min-w-0 items-center gap-1 text-slate-600">
                      <Mail className="size-3.5 shrink-0 text-slate-400" />
                      <span className="truncate">{studentEmail}</span>
                    </span>
                  ) : (
                    <span className="text-slate-600">
                      Open history, leave, and profile from the account menu.
                    </span>
                  )}
                </div>
              </div>
            </div>

            <Separator />

            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span className="font-medium text-slate-700">Student workspace</span>
              <span>Attendance capture stays one click away.</span>
              <span>History, leave, and profile tools stay organized in the account menu.</span>
            </div>
          </CardHeader>
        </Card>

        {children}
      </div>
    </main>
  );
}
