"use client";

import { useState } from "react";
import {
  inviteStudioStaff,
  type InviteStudioStaffResult,
  type StudioInviteRole,
} from "@/app/studio/actions";
import { StudioDialog } from "@/components/studio/StudioDialog";

const ROLE_OPTIONS: { value: StudioInviteRole; label: string }[] = [
  { value: "writer", label: "Writer" },
  { value: "moderator", label: "Moderator" },
];

const inputClass =
  "mt-1 w-full border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#c41e3a]";

export function StudioInviteStaff() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<StudioInviteRole>("writer");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [toast, setToast] = useState<Extract<InviteStudioStaffResult, { ok: true }> | null>(null);

  function resetForm() {
    setName("");
    setEmail("");
    setRole("writer");
    setError("");
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError("");
    const result = await inviteStudioStaff({ name, email, role });
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    resetForm();
    setOpen(false);
    setToast(result);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setError("");
          setOpen(true);
        }}
        className="h-8 bg-[#c41e3a] px-3 text-[11px] font-semibold uppercase tracking-widest text-white hover:opacity-90"
      >
        Invite Writer / Staff
      </button>

      {open ? (
        <StudioDialog title="Invite writer / staff" onClose={() => !pending && setOpen(false)}>
          <form onSubmit={onSubmit} className="space-y-4">
            <label className="block">
              <span className="text-[11px] font-semibold uppercase tracking-widest text-neutral-500">
                Name
              </span>
              <input
                required
                autoComplete="name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                className={inputClass}
              />
            </label>
            <label className="block">
              <span className="text-[11px] font-semibold uppercase tracking-widest text-neutral-500">
                Email
              </span>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className={inputClass}
              />
            </label>
            <label className="block">
              <span className="text-[11px] font-semibold uppercase tracking-widest text-neutral-500">
                Role
              </span>
              <select
                value={role}
                onChange={(event) => setRole(event.target.value as StudioInviteRole)}
                className={inputClass}
              >
                {ROLE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            {error ? <p className="text-sm text-[#c41e3a]">{error}</p> : null}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={() => setOpen(false)}
                className="h-8 px-3 text-[11px] font-semibold uppercase tracking-widest text-neutral-500"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={pending}
                className="h-8 bg-[#c41e3a] px-3 text-[11px] font-semibold uppercase tracking-widest text-white disabled:opacity-60"
              >
                {pending ? "Inviting…" : "Send invite"}
              </button>
            </div>
          </form>
        </StudioDialog>
      ) : null}

      {toast ? <InviteToast result={toast} onClose={() => setToast(null)} /> : null}
    </>
  );
}

function InviteToast({
  result,
  onClose,
}: {
  result: Extract<InviteStudioStaffResult, { ok: true }>;
  onClose: () => void;
}) {
  const roleLabel = result.role === "moderator" ? "Moderator" : "Writer";

  return (
    <div
      role="status"
      className="fixed right-4 top-16 z-40 w-[min(100%-2rem,24rem)] border border-neutral-200 bg-white p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-[#c41e3a]">
          {result.existing ? "Staff updated" : "Invite sent"}
        </p>
        <button
          type="button"
          onClick={onClose}
          className="text-[11px] font-semibold uppercase tracking-widest text-neutral-500 hover:text-[#c41e3a]"
        >
          Close
        </button>
      </div>
      <p className="mt-2 text-sm leading-6 text-neutral-700">
        {result.name} is on the masthead as {roleLabel}.
        {result.existing
          ? " They already had an account; share the recovery link if they need to sign in."
          : " Share these credentials once. They are not emailed again."}
      </p>
      <dl className="mt-3 space-y-2 text-sm">
        <CredentialRow label="Email" value={result.email} />
        {result.password ? <CredentialRow label="Password" value={result.password} /> : null}
        {result.inviteLink ? <CredentialRow label="Invite link" value={result.inviteLink} /> : null}
      </dl>
    </div>
  );
}

function CredentialRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-widest text-neutral-500">{label}</dt>
      <dd className="mt-1 flex items-start gap-2">
        <code className="block min-w-0 flex-1 break-all border border-neutral-200 bg-white px-2 py-1.5 text-xs text-neutral-900">
          {value}
        </code>
        <button
          type="button"
          onClick={async () => {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1500);
          }}
          className="shrink-0 text-[11px] font-semibold uppercase tracking-widest text-neutral-500 hover:text-[#c41e3a]"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </dd>
    </div>
  );
}
