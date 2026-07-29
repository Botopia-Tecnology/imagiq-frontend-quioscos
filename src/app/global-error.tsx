"use client";

/**
 * 🧯 ERROR BOUNDARY GLOBAL - QUIOSCOS
 *
 * Último recurso cuando falla el layout raíz (reemplaza la pantalla
 * "Application error: a client-side exception has occurred" de Next.js).
 * Misma lógica que error.tsx: auto-reload ante chunks JS que no
 * descargaron por red intermitente en tienda. Debe renderizar su propio
 * <html>/<body> y usa estilos inline porque aquí no carga globals.css.
 */

import { useEffect, useState } from "react";
import { isChunkLoadError, reloadOnceForChunkError } from "@/lib/chunk-reload";

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  const [autoReloading, setAutoReloading] = useState(false);

  useEffect(() => {
    if (isChunkLoadError(error) && reloadOnceForChunkError()) {
      setAutoReloading(true);
    }
  }, [error]);

  return (
    <html lang="es">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
          padding: 24,
          textAlign: "center",
          fontFamily: "system-ui, -apple-system, sans-serif",
          background: "#fff",
        }}
      >
        {autoReloading ? (
          <p style={{ fontSize: 18, color: "#333" }}>
            Recuperando la página, un momento…
          </p>
        ) : (
          <>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: "#111" }}>
              Tuvimos un problema al cargar la página
            </h1>
            <p style={{ fontSize: 16, color: "#555", maxWidth: 480 }}>
              Suele deberse a una falla momentánea de la conexión. Pulsa
              reintentar para continuar.
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
      </body>
    </html>
  );
}
