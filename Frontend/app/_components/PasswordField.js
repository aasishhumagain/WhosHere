"use client";

import { useId, useState } from "react";
import { Eye, EyeOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function PasswordField({
  label,
  className = "",
  inputClassName = "",
  buttonClassName = "",
  id,
  ...inputProps
}) {
  const generatedId = useId();
  const resolvedId = id || generatedId;
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div className={className}>
      {label ? (
        <Label htmlFor={resolvedId} className="mb-2 block text-foreground">
          {label}
        </Label>
      ) : null}

      <div className="relative">
        <Input
          {...inputProps}
          id={resolvedId}
          type={isVisible ? "text" : "password"}
          className={`${inputClassName} pr-12`}
        />
        <Button
          type="button"
          onClick={() => setIsVisible((current) => !current)}
          variant="ghost"
          size="icon"
          className={`absolute right-1.5 top-1/2 size-8 -translate-y-1/2 rounded-lg text-muted-foreground hover:bg-accent/70 hover:text-foreground dark:hover:bg-white/8 ${buttonClassName}`}
          aria-label={isVisible ? "Hide password" : "Show password"}
          aria-pressed={isVisible}
        >
          {isVisible ? <EyeOff /> : <Eye />}
        </Button>
      </div>
    </div>
  );
}
