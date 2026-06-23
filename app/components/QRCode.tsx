"use client";

import { useEffect, useRef } from "react";
import QR from "qrcode";

// Rend l'URL en QR code dans un <canvas> — plus fiable que toDataURL
// qui peut échouer silencieusement selon les environnements.
export default function QRCode({ value, size = 200 }: { value: string; size?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current || !value) return;
    QR.toCanvas(canvasRef.current, value, {
      width: size,
      margin: 2,
      color: { dark: "#1e1840", light: "#ffffff" },
    }).catch(console.error);
  }, [value, size]);

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      style={{ borderRadius: 12, display: "block" }}
    />
  );
}
