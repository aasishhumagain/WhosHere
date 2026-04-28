"use client";

import Image from "next/image";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export default function FacePosePreviewCard({
  title,
  subtitle,
  statusLabel,
  imageUrl,
  emptyLabel,
  alt,
  className = "",
}) {
  return (
    <Card
      className={cn(
        "rounded-[1.75rem] border-border/80 bg-slate-50/80 shadow-none dark:border-white/10 dark:bg-slate-950/72",
        className,
      )}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-950 dark:text-slate-50">
              {title}
            </p>
            {subtitle ? (
              <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                {subtitle}
              </p>
            ) : null}
          </div>

          {statusLabel ? (
            <Badge variant="outline" className="shrink-0">
              {statusLabel}
            </Badge>
          ) : null}
        </div>

        <div className="mt-4">
          <div className="mx-auto flex h-56 w-full max-w-[18rem] items-center justify-center overflow-hidden rounded-[1.25rem] border border-slate-200 bg-white p-2 dark:border-white/10 dark:bg-slate-950/84">
            {imageUrl ? (
              <div className="relative h-full w-full">
                <Image
                  src={imageUrl}
                  alt={alt}
                  fill
                  unoptimized
                  sizes="(max-width: 768px) 100vw, 288px"
                  className="object-contain object-center"
                />
              </div>
            ) : (
              <div className="px-6 text-center text-sm leading-6 text-slate-500 dark:text-slate-400">
                {emptyLabel}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
