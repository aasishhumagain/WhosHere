"use client";

import Link from "next/link";
import { ArrowRight, ClipboardCheck, RefreshCcw, ScrollText, UserPlus, Users, Waves } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { Button, buttonVariants } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import AdminShell from "./_components/AdminShell";
import {
  AdminLoadingScreen,
  PageCard,
  SectionIntro,
} from "./_components/AdminUI";
import {
  isAdminAuthError,
  redirectAdminToLogin,
  useAdminSessionGuard,
} from "./_lib/admin-portal";

const MENU = [
  {
    icon: UserPlus,
    title: "Register Student",
    description: "Add a new student to the system",
    href: "/admin/register",
  },
  {
    icon: ClipboardCheck,
    title: "Mark Attendance",
    description: "Check students in and out",
    href: "/admin/attendance",
  },
  {
    icon: Users,
    title: "Student Directory",
    description: "View all registered students",
    href: "/admin/directory",
  },
  {
    icon: RefreshCcw,
    title: "Leave Requests",
    description: "Manage student leave requests",
    href: "/admin/leave",
  },
  {
    icon: ScrollText,
    title: "Audit Logs",
    description: "View system activity logs",
    href: "/admin/logs",
  },
];

export default function AdminHomePage() {
  const router = useRouter();
  const { sessionReady, adminSession } = useAdminSessionGuard(router);

  if (!sessionReady || !adminSession.token) {
    return <AdminLoadingScreen />;
  }

  return (
    <AdminShell
      adminSession={adminSession}
      pageLabel="Admin Dashboard"
      title="Admin Dashboard"
      subtitle="Manage your attendance tracking system"
    >
      <PageCard>
        <SectionIntro
          title="Admin Dashboard"
          description="Manage your attendance tracking system"
        />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 my-6">
          {MENU.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={buttonVariants({
                  variant: "outline",
                  className:
                    "h-auto flex flex-col items-start justify-start p-4 text-left hover:bg-accent",
                })}
              >
                <div className="flex items-center gap-2 w-full mb-2">
                  <Icon className="w-5 h-5" />
                  <h3 className="font-semibold">{item.title}</h3>
                </div>
                <p className="text-sm text-muted-foreground">{item.description}</p>
              </Link>
            );
          })}
        </div>
      </PageCard>
    </AdminShell>
  );
}
