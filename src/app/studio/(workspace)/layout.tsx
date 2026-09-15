import { requireStudioSession } from "@/lib/studio/session";

export const dynamic = "force-dynamic";

export default async function StudioWorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireStudioSession();
  return children;
}
