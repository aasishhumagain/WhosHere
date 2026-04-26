import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary/12 text-primary",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground",
        outline:
          "border-border bg-background text-foreground",
        success:
          "border-transparent bg-emerald-100 text-emerald-700",
        warning:
          "border-transparent bg-amber-100 text-amber-700",
        destructive:
          "border-transparent bg-rose-100 text-rose-700",
        info:
          "border-transparent bg-sky-100 text-sky-700",
        muted:
          "border-transparent bg-slate-100 text-slate-700",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function Badge({ className, variant, ...props }) {
  return (
    <span
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
