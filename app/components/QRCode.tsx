"use client";

import { useEffect, useState } from "react";
import QR from "qrcode";

// Rend une URL en QR code (data URL PNG). Lib `qrcode`, côté client.
export default function QRCode({ value, size = 200 }: { value: string; size?: number }) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    QR.toDataURL(value, { width: size, margin: 1, color: { dark: "#0e0b1a", light: "#ffffff" } })
      .then(setSrc)
      .catch(() => setSrc(null));
  }, [value, size]);

  if (!src) {
    return (
      <div
        style={{ width: size, height: size, background: "var(--card-2)", borderRadius: 12 }}
      />
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img
      src={src}
      alt="QR code du trajet"
      width={size}
      height={size}
      style={{ borderRadius: 12 }}
    />
  );
}
