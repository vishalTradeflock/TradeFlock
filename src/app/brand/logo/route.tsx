import { ImageResponse } from "next/og";

export const runtime = "edge";
export const contentType = "image/png";
export const size = { width: 512, height: 512 };

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#ffffff",
        }}
      >
        <div style={{ fontSize: 64, color: "#0a0a0a", fontWeight: 700 }}>TradeFlock</div>
        <div
          style={{
            marginTop: 12,
            fontSize: 22,
            color: "#c41e3a",
            letterSpacing: "0.32em",
            fontWeight: 700,
          }}
        >
          USA
        </div>
      </div>
    ),
    { ...size },
  );
}
