import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
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
          background: "#171717",
          borderRadius: 96,
        }}
      >
        <div
          style={{
            fontSize: 120,
            fontWeight: 700,
            color: "#34d399",
            letterSpacing: -4,
          }}
        >
          11
        </div>
        <div style={{ fontSize: 36, color: "#a3a3a3", marginTop: 8 }}>
          Bus
        </div>
      </div>
    ),
    { ...size }
  );
}
