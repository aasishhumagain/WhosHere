"use client";

import Image from "next/image";

import { cn } from "@/lib/utils";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

import {
  capitalizeWords,
  getMessageClass,
  getStatusPillClass,
} from "../_lib/student-portal";

function getAlertVariant(type) {
  if (type === "error") {
    return "destructive";
  }

  if (type === "success") {
    return "success";
  }

  return "default";
}

function getBadgeVariant(status) {
  if (status === "approved" || status === "present") {
    return "success";
  }

  if (status === "rejected" || status === "absent") {
    return "destructive";
  }

  if (status === "late") {
    return "warning";
  }

  if (status === "duplicate") {
    return "info";
  }

  return "muted";
}

export function PageCard({ children, className = "" }) {
  return (
    <Card
      className={cn(
        "overflow-hidden border-white/70 bg-white/88 shadow-[0_18px_60px_rgba(15,23,42,0.08)] backdrop-blur-sm dark:border-white/12 dark:bg-slate-950/72 dark:shadow-[0_24px_70px_rgba(2,8,23,0.45)]",
        className,
      )}
    >
      <CardContent className="p-6">{children}</CardContent>
    </Card>
  );
}

export function MessageBanner({ type = "info", title, children, className = "" }) {
  return (
    <Alert
      variant={getAlertVariant(type)}
      className={cn(getMessageClass(type), className)}
    >
      {title ? <AlertTitle>{title}</AlertTitle> : null}
      <AlertDescription>{children}</AlertDescription>
    </Alert>
  );
}

export function StatusPill({ status }) {
  return (
    <Badge
      variant={getBadgeVariant(status)}
      className={cn("rounded-full px-3 py-1 text-[0.72rem]", getStatusPillClass(status))}
    >
      {capitalizeWords(status)}
    </Badge>
  );
}

export function SectionIntro({
  eyebrow,
  title,
  description,
  className = "",
}) {
  return (
    <div className={className}>
      {eyebrow ? (
        <p className="text-xs font-semibold uppercase tracking-[0.32em] text-primary/90">
          {eyebrow}
        </p>
      ) : null}
      {title ? (
        <h2 className="mt-3 text-3xl font-semibold tracking-tight text-foreground">
          {title}
        </h2>
      ) : null}
      {description ? (
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
          {description}
        </p>
      ) : null}
    </div>
  );
}

export function PhotoPreviewCard({
  title,
  subtitle,
  imageUrl,
  fallbackLabel,
  imageLoading = "lazy",
}) {
  return (
    <Card className="border-border/70 bg-slate-50/70 shadow-none dark:bg-slate-950/55">
      <CardHeader className="gap-2">
        <CardTitle className="text-lg">{title}</CardTitle>
        <CardDescription>{subtitle}</CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <Separator className="mb-4" />

        {imageUrl ? (
          <div className="flex h-72 items-center justify-center overflow-hidden rounded-2xl border border-border/80 bg-white p-4 shadow-inner dark:bg-slate-900/75">
            <div className="relative h-full w-full">
              <Image
                src={imageUrl}
                alt={title}
                fill
                unoptimized
                loading={imageLoading}
                sizes="(max-width: 1024px) 100vw, 40vw"
                className="rounded-xl object-contain object-center"
              />
            </div>
          </div>
        ) : (
          <div className="flex h-72 items-center justify-center rounded-2xl border border-dashed border-border bg-white/80 px-6 text-center text-sm text-muted-foreground dark:bg-slate-900/75">
            {fallbackLabel}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function StatCard({
  label,
  value,
  helper,
  accentClass = "border-slate-200/80 bg-white text-slate-900 dark:border-white/12 dark:bg-slate-950/65 dark:text-slate-100",
}) {
  return (
    <Card className={cn("gap-0 rounded-[1.75rem] shadow-none", accentClass)}>
      <CardContent className="p-5">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="mt-3 text-3xl font-semibold tracking-tight">{value}</p>
        {helper ? <p className="mt-2 text-sm text-muted-foreground">{helper}</p> : null}
      </CardContent>
    </Card>
  );
}

export function StudentLoadingScreen({
  title = "Loading student portal...",
  description = "Getting your student page ready.",
}) {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(191,219,254,0.7),transparent_28%),radial-gradient(circle_at_80%_20%,rgba(254,240,138,0.45),transparent_22%),linear-gradient(180deg,#f8fbff_0%,#eef4ff_54%,#f9fafb_100%)] px-4 py-6 text-slate-900 dark:bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.14),transparent_24%),radial-gradient(circle_at_80%_18%,rgba(59,130,246,0.18),transparent_22%),linear-gradient(180deg,#020617_0%,#0f172a_55%,#111827_100%)] dark:text-slate-100 md:px-6">
      <div className="mx-auto flex min-h-[80vh] max-w-7xl items-center justify-center">
        <Card className="w-full max-w-xl border-white/80 bg-white/90 shadow-[0_24px_90px_rgba(15,23,42,0.12)] backdrop-blur-sm dark:border-white/12 dark:bg-slate-950/78 dark:shadow-[0_24px_70px_rgba(2,8,23,0.5)]">
          <CardHeader className="pb-2 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-primary/90">
              WhosHere
            </p>
            <CardTitle className="mt-2 text-3xl">{title}</CardTitle>
            <CardDescription className="mx-auto max-w-md text-sm leading-6">
              {description}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    </main>
  );
}
