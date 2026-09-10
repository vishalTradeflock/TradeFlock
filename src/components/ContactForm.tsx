"use client";

import { useState, type FormEvent } from "react";
import { cn } from "@/lib/utils";

type FormFields = {
  name: string;
  email: string;
  company: string;
  message: string;
};

type FieldErrors = Partial<Record<keyof FormFields, string>>;

const INITIAL_FIELDS: FormFields = {
  name: "",
  email: "",
  company: "",
  message: "",
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate(fields: FormFields): FieldErrors {
  const errors: FieldErrors = {};

  if (fields.name.trim().length < 2) {
    errors.name = "Enter your full name.";
  }
  if (!EMAIL_PATTERN.test(fields.email.trim())) {
    errors.email = "Enter a valid work email.";
  }
  if (fields.company.trim().length < 2) {
    errors.company = "Enter your company or organization.";
  }
  if (fields.message.trim().length < 20) {
    errors.message = "Please write at least 20 characters.";
  }

  return errors;
}

export default function ContactForm() {
  const [fields, setFields] = useState<FormFields>(INITIAL_FIELDS);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitted, setSubmitted] = useState(false);

  function update<K extends keyof FormFields>(key: K, value: FormFields[K]) {
    setFields((current) => ({ ...current, [key]: value }));
    if (errors[key]) {
      setErrors((current) => {
        const next = { ...current };
        delete next[key];
        return next;
      });
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validate(fields);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="border border-neutral-200 px-5 py-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#c41e3a]">
          Received
        </p>
        <h2 className="mt-2 font-serif text-2xl font-semibold tracking-tight">
          Thank you. The desk has your note.
        </h2>
        <p className="mt-3 text-sm leading-6 text-neutral-600">
          We review incoming messages during U.S. business hours. If your
          inquiry is time-sensitive, include that in a follow-up to{" "}
          <a
            href="mailto:info@tradeflock.com"
            className="font-semibold text-neutral-950 hover:text-[#c41e3a]"
          >
            info@tradeflock.com
          </a>
          .
        </p>
        <button
          type="button"
          className="mt-6 text-[12px] font-semibold uppercase tracking-[0.16em] text-neutral-700 hover:text-[#c41e3a]"
          onClick={() => {
            setFields(INITIAL_FIELDS);
            setErrors({});
            setSubmitted(false);
          }}
        >
          Send another message
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <Field
        id="name"
        label="Name"
        value={fields.name}
        error={errors.name}
        autoComplete="name"
        onChange={(value) => update("name", value)}
      />
      <Field
        id="email"
        label="Work email"
        type="email"
        value={fields.email}
        error={errors.email}
        autoComplete="email"
        onChange={(value) => update("email", value)}
      />
      <Field
        id="company"
        label="Company"
        value={fields.company}
        error={errors.company}
        autoComplete="organization"
        onChange={(value) => update("company", value)}
      />
      <Field
        id="message"
        label="Message"
        as="textarea"
        value={fields.message}
        error={errors.message}
        onChange={(value) => update("message", value)}
      />
      <button
        type="submit"
        className="mt-2 border border-neutral-900 bg-neutral-950 px-5 py-2.5 text-[12px] font-semibold uppercase tracking-[0.16em] text-white hover:border-[#c41e3a] hover:bg-[#c41e3a]"
      >
        Send to the desk
      </button>
    </form>
  );
}

function Field({
  id,
  label,
  value,
  error,
  onChange,
  type = "text",
  autoComplete,
  as = "input",
}: {
  id: string;
  label: string;
  value: string;
  error?: string;
  onChange: (value: string) => void;
  type?: string;
  autoComplete?: string;
  as?: "input" | "textarea";
}) {
  const describedBy = error ? `${id}-error` : undefined;
  const classes = cn(
    "mt-1 w-full rounded-none border bg-white px-3 py-2 text-sm text-neutral-950 outline-none",
    error
      ? "border-[#c41e3a] focus:border-[#c41e3a]"
      : "border-neutral-300 focus:border-neutral-900",
    as === "textarea" && "min-h-32 resize-y leading-6",
  );

  return (
    <div>
      <label
        htmlFor={id}
        className="text-[11px] font-semibold uppercase tracking-[0.16em] text-neutral-500"
      >
        {label}
      </label>
      {as === "textarea" ? (
        <textarea
          id={id}
          name={id}
          value={value}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          className={classes}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <input
          id={id}
          name={id}
          type={type}
          value={value}
          autoComplete={autoComplete}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          className={classes}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
      {error ? (
        <p id={describedBy} className="mt-1 text-xs text-[#c41e3a]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
