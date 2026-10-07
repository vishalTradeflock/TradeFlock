export type WireMode = "signals" | "publish";

/** WIRE_MODE=signals|publish. Anything other than an explicit "publish" is signals. */
export function wireMode(env: Record<string, string | undefined> = process.env): WireMode {
  return env.WIRE_MODE?.trim().toLowerCase() === "publish" ? "publish" : "signals";
}
