"use client";

import Image from "next/image";

import {
  capitalizeWords,
  getMessageClass,
  getStatusPillClass,
} from "../_lib/student-portal";

function joinClassNames(...values) {
  return values.filter(Boolean).join(" ");
}

export function PageCard({ children, className = "" }) {
  return (
    <section
      className={joinClassNames(
        "rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-[0_25px_80px_rgba(15,23,42,0.08)] backdrop-blur",
        className,
      )}
    >
      {children}
    </section>
  );
}

export function MessageBanner({ type = "info", children, className = "" }) {
  return (
    <div
      className={joinClassNames(
        "rounded-2xl px-4 py-3 text-sm",
        getMessageClass(type),
        className,
      )}
    >
      {children}
    </div>
  );
}

export function StatusPill({ status }) {
  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getStatusPillClass(status)}`}
    >
      {capitalizeWords(status)}
    </span>
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
    <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
        {title}
      </p>
      <p className="mt-1 text-sm text-slate-600">{subtitle}</p>

      {imageUrl ? (
        <div className="mt-4 flex h-64 items-center justify-center overflow-hidden rounded-[1.25rem] border border-slate-200 bg-white p-3">
          <div className="relative h-full w-full">
            <Image
              src={imageUrl}
              alt={title}
              fill
              unoptimized
              loading={imageLoading}
              sizes="(max-width: 1024px) 100vw, 40vw"
              className="rounded-[1rem] object-contain object-center"
            />
          </div>
        </div>
      ) : (
        <div className="mt-4 flex h-64 items-center justify-center rounded-[1.25rem] border border-dashed border-slate-300 bg-white px-6 text-center text-sm text-slate-400">
          {fallbackLabel}
        </div>
      )}
    </div>
  );
}

export function StatCard({
  label,
  value,
  helper,
  accentClass = "border-slate-200 bg-slate-50 text-slate-900",
}) {
  return (
    <div className={`rounded-[1.6rem] border p-5 ${accentClass}`}>
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-3 text-3xl font-semibold">{value}</p>
      {helper ? <p className="mt-2 text-sm text-slate-500">{helper}</p> : null}
    </div>
  );
}

export function StudentLoadingScreen({
  title = "Loading student portal...",
  description = "Preparing your student workspace.",
}) {
  return (
    <main className="min-h-screen bg-[linear-gradient(140deg,#f8fafc_0%,#e0f2fe_52%,#fef3c7_100%)] px-4 py-6 text-slate-900 md:px-6">
      <div className="mx-auto flex min-h-[80vh] max-w-7xl items-center justify-center">
        <div className="rounded-[2rem] border border-white/70 bg-white/85 px-8 py-10 text-center shadow-[0_25px_80px_rgba(15,23,42,0.08)] backdrop-blur">
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-blue-700">
            WhosHere
          </p>
          <h1 className="mt-3 text-3xl font-semibold">{title}</h1>
          <p className="mt-3 text-sm text-slate-600">{description}</p>
        </div>
      </div>
    </main>
  );
}
