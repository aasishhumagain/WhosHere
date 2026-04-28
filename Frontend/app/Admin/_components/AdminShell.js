"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  ChevronDown,
  ClipboardCheck,
  LayoutDashboard,
  LogOut,
  RefreshCcw,
  ScrollText,
  ShieldCheck,
  UserPlus,
  Users,
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
import ThemeToggle from "@/app/_components/ThemeToggle";

import {
  clearAdminSessionStorage,
  getAdminInitials,
  logoutAdmin,
} from "../_lib/admin-portal";

const PRIMARY_LINKS = [
  {
    href: "/admin",
    label: "Admin Dashboard",
    icon: LayoutDashboard,
  },
  {
    href: "/admin/register",
    label: "Register Student",
    icon: UserPlus,
  },
];

const MENU_LINKS = [
  {
    href: "/admin/admin-directory",
    label: "Admin Directory",
    icon: ShieldCheck,
    description: "Manage admin accounts and passwords",
  },
  {
    href: "/admin/directory",
    label: "Student Directory",
    icon: Users,
    description: "View and edit students",
  },
  {
    href: "/admin/attendance",
    label: "Attendance Control",
    icon: ClipboardCheck,
    description: "Review and correct attendance",
  },
  {
    href: "/admin/logs",
    label: "Audit Logs",
    icon: ScrollText,
    description: "Track logins, logouts, and system actions",
  },
  {
    href: "/admin/leave",
    label: "Leave Requests",
    icon: Waves,
    description: "Approve or reject leave",
  },
];

function isLinkActive(pathname, href) {
  if (href === "/admin") {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
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
        <span
          className={cn(
            "flex size-9 items-center justify-center rounded-xl border border-border/80 bg-white text-muted-foreground",
            active && "border-primary/20 bg-primary/10 text-primary",
          )}
        >
          <Icon className="size-4" />
        </span>

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

export default function AdminShell({
  adminSession,
  pageLabel,
  title,
  subtitle,
  children,
}) {
  const router = useRouter();
  const pathname = usePathname();

  const [loggingOut, setLoggingOut] = useState(false);
  const adminInitials = getAdminInitials(adminSession.username);
  const hasActiveMenuPage = MENU_LINKS.some((link) => isLinkActive(pathname, link.href));

  async function handleLogout() {
    setLoggingOut(true);

    try {
      await logoutAdmin(adminSession.token);
    } catch {
      // Best effort logout.
    } finally {
      clearAdminSessionStorage();
      router.push("/login");
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(191,219,254,0.7),transparent_24%),radial-gradient(circle_at_85%_18%,rgba(254,240,138,0.45),transparent_20%),linear-gradient(180deg,#f8fbff_0%,#eef4ff_54%,#f9fafb_100%)] px-4 py-6 text-slate-900 dark:bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.12),transparent_22%),radial-gradient(circle_at_85%_18%,rgba(37,99,235,0.14),transparent_18%),linear-gradient(180deg,#01040f_0%,#020617_44%,#08101f_100%)] dark:text-slate-100 md:px-6">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-[-10rem] top-[-8rem] size-80 rounded-full bg-primary/8 blur-3xl dark:bg-primary/18" />
        <div className="absolute bottom-[-10rem] right-[-4rem] size-96 rounded-full bg-sky-300/25 blur-3xl dark:bg-sky-400/8" />
      </div>

      <div className="relative mx-auto max-w-7xl space-y-6">
        <Card className="overflow-hidden border-white/80 bg-white/88 shadow-[0_20px_90px_rgba(15,23,42,0.08)] backdrop-blur-sm dark:border-white/10 dark:bg-slate-950/88 dark:shadow-[0_28px_90px_rgba(0,0,0,0.6)]">
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

              <div className="flex flex-col gap-3 xl:items-end">
                <div className="flex flex-wrap items-center justify-end gap-2.5">
                  <ThemeToggle className="h-10" />

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
                            size: "default",
                          }),
                          "rounded-full px-4",
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
                        size="default"
                        className={cn(
                          "h-10 min-w-[14rem] justify-between rounded-full px-2.5 shadow-sm",
                          hasActiveMenuPage && "border-primary/15 bg-primary/7 text-foreground",
                        )}
                      >
                        <span className="flex items-center gap-3">
                          <Avatar className="size-11 border border-white shadow-sm dark:border-white/12">
                            <AvatarFallback className="bg-slate-950 text-sm text-white dark:bg-slate-200 dark:text-slate-950">
                              {adminInitials}
                            </AvatarFallback>
                          </Avatar>

                          <span className="min-w-0 text-left">
                            <span className="block truncate text-sm font-semibold text-slate-950 dark:text-slate-50">
                              {adminSession.username}
                            </span>
                            <span className="block text-xs text-muted-foreground">
                              Admin Menu
                            </span>
                          </span>
                        </span>

                        <ChevronDown className="size-4 text-muted-foreground" />
                      </Button>
                    </DropdownMenuTrigger>

                    <DropdownMenuContent align="end" className="w-80 p-2">
                      <DropdownMenuLabel className="rounded-2xl bg-slate-50 px-3 py-3 dark:bg-slate-900/75">
                        <div className="flex items-center gap-3">
                          <Avatar className="size-12 border border-border bg-white shadow-sm dark:border-white/12 dark:bg-slate-900/70">
                            <AvatarFallback className="bg-slate-950 text-sm text-white dark:bg-slate-200 dark:text-slate-950">
                              {adminInitials}
                            </AvatarFallback>
                          </Avatar>

                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-950 dark:text-slate-50">
                              {adminSession.username}
                            </p>
                            <p className="mt-1 truncate text-xs font-normal text-muted-foreground">
                              Administrator Panel
                            </p>
                            <p className="truncate text-xs font-normal text-muted-foreground">
                              Open students, attendance, logs, leave, and admin accounts from here.
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

                <p className="pr-1 text-xs text-muted-foreground">
                  Signed in as {adminSession.username}. Use the menu above to move between admin pages.
                </p>
              </div>
            </div>

            <Separator />

            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span className="font-medium text-slate-700">Admin area</span>
              <span>Dashboard and registration stay upfront.</span>
              <span>Student records, attendance, logs, and leave requests are all kept in separate pages.</span>
            </div>
          </CardHeader>
        </Card>

        {children}
      </div>
    </main>
  );
}
