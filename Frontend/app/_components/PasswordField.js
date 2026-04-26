"use client";

import { useId, useState } from "react";

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
        <label
          htmlFor={resolvedId}
          className="mb-2 block text-sm font-medium text-slate-700"
        >
          {label}
        </label>
      ) : null}

      <div className="relative">
        <input
          {...inputProps}
          id={resolvedId}
          type={isVisible ? "text" : "password"}
          className={`${inputClassName} pr-16`}
        />
        <button
          type="button"
          onClick={() => setIsVisible((current) => !current)}
          className={`absolute right-3 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-xs font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 ${buttonClassName}`}
          aria-label={isVisible ? "Hide password" : "Show password"}
          aria-pressed={isVisible}
        >
          {isVisible ? "Hide" : "Show"}
        </button>
      </div>
    </div>
  );
}
