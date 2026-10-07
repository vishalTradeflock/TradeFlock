import { handleGet, handlePost } from "@/lib/newsroom/api";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Ctx = { params: Promise<{ resource: string }> };

export async function GET(request: Request, ctx: Ctx) {
  const { resource } = await ctx.params;
  return handleGet(request, resource);
}

export async function POST(request: Request, ctx: Ctx) {
  const { resource } = await ctx.params;
  return handlePost(request, resource);
}
