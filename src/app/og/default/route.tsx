import { ImageResponse } from "next/og";

export const runtime = "edge";
export const contentType = "image/png";
export const size = { width: 1200, height: 630 };

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: 80,
          background: "#ffffff",
          borderTop: "18px solid #c41e3a",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", fontSize: 88, color: "#0a0a0a", fontWeight: 700 }}>
          TradeFlock
          <span
            style={{
              marginLeft: 16,
              marginTop: 18,
              fontSize: 28,
              color: "#c41e3a",
              letterSpacing: "0.28em",
              fontWeight: 700,
            }}
          >
            USA
          </span>
        </div>
        <div style={{ marginTop: 28, fontSize: 28, color: "#525252" }}>Business & Markets</div>
      </div>
    ),
    { ...size },
  );
}
