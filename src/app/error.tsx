"use client";

/**
 * 🧯 ERROR BOUNDARY DE RUTA - QUIOSCOS
 *
 * Captura excepciones de cliente en cualquier ruta. Si el error es un chunk
 * JS que no descargó (red intermitente en tienda), recarga automáticamente
 * la página una vez; si no, muestra una pantalla amigable con reintento.
 * Estilos inline a propósito: si falló la red, el CSS también pudo fallar.
 */

import { useEffect, useState } from "react";
import { isChunkLoadError, reloadOnceForChunkError } from "@/lib/chunk-reload";

export default function RouteError({
  error,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [autoReloading, setAutoReloading] = useState(false);

  useEffect(() => {
    if (isChunkLoadError(error) && reloadOnceForChunkError()) {
      setAutoReloading(true);
    }
  }, [error]);

  return (
    <div
      style={{
        minHeight: "60vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
        padding: 24,
        textAlign: "center",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      {autoReloading ? (
        <p style={{ fontSize: 18, color: "#333" }}>
          Recuperando la página, un momento…
        </p>
      ) : (
        <>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#111" }}>
            Tuvimos un problema al cargar esta pantalla
          </h1>
          <p style={{ fontSize: 16, color: "#555", maxWidth: 480 }}>
            Suele deberse a una falla momentánea de la conexión. Pulsa
            reintentar para continuar donde ibas.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: "12px 32px",
              fontSize: 16,
              fontWeight: 600,
              color: "#fff",
              background: "#111",
              border: "none",
              borderRadius: 24,
              cursor: "pointer",
            }}
          >
            Reintentar
          </button>
        </>
      )}
    </div>
  );
}
