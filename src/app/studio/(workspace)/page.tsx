import { StudioTopBar } from "@/components/studio/StudioTopBar";
import StudioDesk from "@/components/studio/StudioDesk";
import { listDeskStories } from "@/lib/studio/desk";
import { requireModeratorSession } from "@/lib/studio/session";

export const dynamic = "force-dynamic";

export default async function StudioIndexPage() {
  const session = await requireModeratorSession();
  const lists = await listDeskStories(session);

  return (
    <>
      <StudioTopBar email={session.email} />
      <StudioDesk role={session.profile.role} lists={lists} />
    </>
  );
}
