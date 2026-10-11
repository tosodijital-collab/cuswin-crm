import { ImageResponse } from "next/og";

/** Uygulama simgesi: koyu zemin üzerinde telefon yeşili nokta ve "C". */
export function renderAppIcon(px: number) {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#15202b",
          color: "#ffffff",
          fontSize: px * 0.6,
          fontWeight: 700,
          position: "relative",
        }}
      >
        C
        <div
          style={{
            position: "absolute",
            right: px * 0.2,
            bottom: px * 0.2,
            width: px * 0.16,
            height: px * 0.16,
            borderRadius: px,
            background: "#13714a",
          }}
        />
      </div>
    ),
    { width: px, height: px },
  );
}
