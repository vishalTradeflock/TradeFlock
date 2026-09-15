"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function StudioLoginForm({
  forbidden,
}: {
  forbidden: boolean;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(
    forbidden ? "This account is not on the masthead." : "",
  );
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError("");
    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (signInError) {
      setPending(false);
      setError(signInError.message);
      return;
    }
    router.replace("/studio/write");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 space-y-4">
      <label className="block">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-neutral-500">
          Email
        </span>
        <input
          type="email"
          required
          autoComplete="username"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="mt-1 w-full border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#c41e3a]"
        />
      </label>
      <label className="block">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-neutral-500">
          Password
        </span>
        <input
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="mt-1 w-full border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#c41e3a]"
        />
      </label>
      {error ? <p className="text-sm text-[#c41e3a]">{error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="w-full bg-[#c41e3a] px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "Signing in…" : "Enter the desk"}
      </button>
      <p className="text-xs text-neutral-500">
        Newsroom accounts are issued by the masthead. There is no public signup.
      </p>
    </form>
  );
}
