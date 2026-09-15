"use client";

import nextDynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import type { StudioCategory } from "@/components/studio/types";
import type { StudioRole } from "@/lib/studio/roles";

const StudioWriter = nextDynamic(() => import("@/components/studio/StudioWriter"), {
  ssr: false,
  loading: () => (
    <div className="flex h-screen w-full items-center justify-center">
      <div className="animate-pulse text-sm font-medium text-muted-foreground">
        Loading editorial studio...
      </div>
    </div>
  ),
});

type Bootstrap = {
  role: StudioRole;
  email: string | null;
  categories: StudioCategory[];
  initialDraft: {
    id: string;
    title: string;
    body: string;
    slug: string;
    categoryId: string;
    status: "draft" | "review" | "published";
  } | null;
};

function StudioLoading() {
  return (
    <div className="flex h-screen w-full items-center justify-center">
      <div className="animate-pulse text-sm font-medium text-muted-foreground">
        Loading editorial studio...
      </div>
    </div>
  );
}

function WriteCanvas() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id");
  const [bootstrap, setBootstrap] = useState<Bootstrap | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const url = id ? `/api/studio/write?id=${encodeURIComponent(id)}` : "/api/studio/write";
    void fetch(url)
      .then(async (response) => {
        const payload = (await response.json()) as Bootstrap & { error?: string };
        if (!response.ok) {
          setError(payload.error ?? "Could not open the desk.");
          return;
        }
        setBootstrap(payload);
      })
      .catch(() => setError("Could not open the desk."));
  }, [id]);

  if (error) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16">
        <p className="text-sm text-neutral-600">{error}</p>
      </main>
    );
  }

  if (!bootstrap) return <StudioLoading />;

  if (!bootstrap.categories.length) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16">
        <p className="text-sm text-neutral-600">
          No desks are configured yet. Add Tech, Markets, Leadership, Finance, or Success
          Insights in Supabase categories.
        </p>
      </main>
    );
  }

  return (
    <StudioWriter
      role={bootstrap.role}
      categories={bootstrap.categories}
      email={bootstrap.email}
      initialDraft={bootstrap.initialDraft}
    />
  );
}

export default function StudioWritePage() {
  return (
    <Suspense fallback={<StudioLoading />}>
      <WriteCanvas />
    </Suspense>
  );
}
