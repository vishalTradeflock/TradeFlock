"use client";

import { useState } from "react";
import { saveSiteVerification, saveStudioAuthor } from "@/app/studio/actions";
import type { StudioAuthor } from "@/components/studio/types";
import { BIO_MAX } from "@/lib/studio/head-meta";

const inputClass =
  "mt-1 w-full border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#c41e3a]";

async function uploadFile(file: File) {
  const form = new FormData();
  form.set("file", file);
  const response = await fetch("/api/studio/upload", { method: "POST", body: form });
  const payload = (await response.json()) as { url?: string; error?: string };
  if (!response.ok || !payload.url) throw new Error(payload.error ?? "Upload failed.");
  return payload.url;
}

export function StudioSettingsForm({
  canEditVerification,
  google,
  bing,
  authors,
  initialAuthorId,
}: {
  canEditVerification: boolean;
  google: string;
  bing: string;
  authors: StudioAuthor[];
  initialAuthorId: string;
}) {
  const [googleValue, setGoogleValue] = useState(google);
  const [bingValue, setBingValue] = useState(bing);
  const [siteStatus, setSiteStatus] = useState("");
  const [siteError, setSiteError] = useState("");
  const [authorId, setAuthorId] = useState(initialAuthorId || authors[0]?.id || "");
  const selected = authors.find((author) => author.id === authorId) ?? authors[0];
  const [name, setName] = useState(selected?.name ?? "");
  const [title, setTitle] = useState(selected?.title ?? "");
  const [slug, setSlug] = useState(selected?.slug ?? "");
  const [bio, setBio] = useState(selected?.bio ?? "");
  const [avatarUrl, setAvatarUrl] = useState(selected?.avatarUrl ?? "");
  const [authorStatus, setAuthorStatus] = useState("");
  const [authorError, setAuthorError] = useState("");

  function selectAuthor(id: string) {
    const next = authors.find((author) => author.id === id);
    setAuthorId(id);
    setName(next?.name ?? "");
    setTitle(next?.title ?? "");
    setSlug(next?.slug ?? "");
    setBio(next?.bio ?? "");
    setAvatarUrl(next?.avatarUrl ?? "");
    setAuthorStatus("");
    setAuthorError("");
  }

  return (
    <div className="space-y-10">
      <section>
        <h2 className="font-serif text-2xl font-semibold tracking-tight">Byline</h2>
        <p className="mt-2 max-w-2xl text-sm text-neutral-600">
          Public author pages use this name, photo, and bio. Do not generate a biography here —
          write only what the desk has confirmed.
        </p>
        {authors.length > 1 ? (
          <label className="mt-4 block max-w-md">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-neutral-500">
              Author
            </span>
            <select
              value={authorId}
              onChange={(event) => selectAuthor(event.target.value)}
              className={inputClass}
            >
              {authors.map((author) => (
                <option key={author.id} value={author.id}>
                  {author.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <div className="mt-4 grid max-w-xl gap-4">
          <label>
            <span className="text-[11px] font-semibold uppercase tracking-widest text-neutral-500">
              Name
            </span>
            <input value={name} onChange={(event) => setName(event.target.value)} className={inputClass} />
          </label>
          <label>
            <span className="text-[11px] font-semibold uppercase tracking-widest text-neutral-500">
              Title
            </span>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Senior Markets Correspondent"
              className={inputClass}
            />
          </label>
          <label>
            <span className="text-[11px] font-semibold uppercase tracking-widest text-neutral-500">
              Profile URL slug
            </span>
            <input value={slug} onChange={(event) => setSlug(event.target.value)} className={inputClass} />
            <p className="mt-1 text-xs text-neutral-500">Public page: /author/{slug || "…"}</p>
          </label>
          <label>
            <span className="text-[11px] font-semibold uppercase tracking-widest text-neutral-500">
              Short bio
            </span>
            <textarea
              rows={5}
              value={bio}
              maxLength={BIO_MAX}
              onChange={(event) => setBio(event.target.value)}
              className={inputClass}
            />
            <p className="mt-1 text-xs text-neutral-500">
              {bio.trim().length}/{BIO_MAX}
            </p>
          </label>
          <label>
            <span className="text-[11px] font-semibold uppercase tracking-widest text-neutral-500">
              Profile photo
            </span>
            <input
              value={avatarUrl}
              onChange={(event) => setAvatarUrl(event.target.value)}
              placeholder="https://"
              className={inputClass}
            />
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="mt-2 text-sm"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (!file) return;
                try {
                  const url = await uploadFile(file);
                  setAvatarUrl(url);
                  setAuthorError("");
                } catch (error) {
                  setAuthorError(error instanceof Error ? error.message : "Upload failed.");
                }
              }}
            />
          </label>
        </div>
        {authorError ? <p className="mt-3 text-sm text-[#c41e3a]">{authorError}</p> : null}
        {authorStatus ? <p className="mt-3 text-sm text-neutral-600">{authorStatus}</p> : null}
        <button
          type="button"
          className="mt-4 h-8 bg-[#c41e3a] px-3 text-[11px] font-semibold uppercase tracking-widest text-white"
          onClick={async () => {
            setAuthorError("");
            setAuthorStatus("");
            const result = await saveStudioAuthor({
              id: authorId,
              name,
              title,
              slug,
              bio,
              avatarUrl,
            });
            if (!result.ok) {
              setAuthorError(result.error);
              return;
            }
            setSlug(result.slug);
            setAuthorStatus("Byline saved.");
          }}
        >
          Save byline
        </button>
      </section>

      {canEditVerification ? (
        <section className="border-t border-neutral-200 pt-8">
          <h2 className="font-serif text-2xl font-semibold tracking-tight">Search verification</h2>
          <p className="mt-2 max-w-2xl text-sm text-neutral-600">
            Paste the verification token from Google Search Console or Bing Webmaster Tools. Do not
            paste JavaScript, API keys, or service-account credentials. These values are injected as
            meta tags on public pages.
          </p>
          <div className="mt-4 grid max-w-xl gap-4">
            <label>
              <span className="text-[11px] font-semibold uppercase tracking-widest text-neutral-500">
                Google site verification
              </span>
              <input
                value={googleValue}
                onChange={(event) => setGoogleValue(event.target.value)}
                placeholder="content value from google-site-verification"
                className={inputClass}
              />
            </label>
            <label>
              <span className="text-[11px] font-semibold uppercase tracking-widest text-neutral-500">
                Bing site verification
              </span>
              <input
                value={bingValue}
                onChange={(event) => setBingValue(event.target.value)}
                placeholder="content value from msvalidate.01"
                className={inputClass}
              />
            </label>
          </div>
          {siteError ? <p className="mt-3 text-sm text-[#c41e3a]">{siteError}</p> : null}
          {siteStatus ? <p className="mt-3 text-sm text-neutral-600">{siteStatus}</p> : null}
          <button
            type="button"
            className="mt-4 h-8 bg-[#c41e3a] px-3 text-[11px] font-semibold uppercase tracking-widest text-white"
            onClick={async () => {
              setSiteError("");
              setSiteStatus("");
              const result = await saveSiteVerification({
                google: googleValue,
                bing: bingValue,
              });
              if (!result.ok) {
                setSiteError(result.error);
                return;
              }
              setSiteStatus("Verification settings saved.");
            }}
          >
            Save verification
          </button>
        </section>
      ) : (
        <p className="border-t border-neutral-200 pt-8 text-sm text-neutral-500">
          Site-wide verification metadata can only be edited by a masthead editor.
        </p>
      )}
    </div>
  );
}
