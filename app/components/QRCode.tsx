"use client";

import { useEffect, useRef } from "react";
import QR from "qrcode";

// Le QR reste toujours noir sur blanc : c'est ce qui se scanne le mieux,
// quel que soit le thème de l'appareil. Le cadre blanc est porté par la CSS.
export default function QRCode({ value, size = 200 }: { value: string; size?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current || !value) return;
    QR.toCanvas(canvasRef.current, value, {
      width: size,
      margin: 0,
      color: { dark: "#000000", light: "#ffffff" },
      errorCorrectionLevel: "M",
    }).catch(() => {
      /* rendu impossible : le code du trajet reste saisissable à la main */
    });
  }, [value, size]);

  return (
    <div className="qr-frame">
      <canvas ref={canvasRef} width={size} height={size} style={{ display: "block" }} />
    </div>
  );
}
