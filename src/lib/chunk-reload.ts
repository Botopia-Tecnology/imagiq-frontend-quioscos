/**
 * 🧯 RECUPERACIÓN DE CHUNKS FALLIDOS - QUIOSCOS
 *
 * En las tiendas la red del kiosko puede fallar puntualmente al descargar
 * un chunk JS lazy (Turbopack: "Failed to load chunk ..."). Turbopack
 * memoiza la promesa fallida, así que aunque la red vuelva, cualquier
 * navegación que necesite ese módulo crashea hasta hacer un reload completo.
 * Estas utilidades detectan ese caso y recargan la página automáticamente,
 * con guarda en sessionStorage para no entrar en loop de recargas.
 */

const STORAGE_KEY = "imagiq_chunk_reload_at";
const RELOAD_WINDOW_MS = 60_000; // máx. 1 recarga automática por minuto

/** Detecta errores de descarga de chunks/módulos dinámicos (Turbopack y webpack) */
export function isChunkLoadError(error: unknown): boolean {
  const message =
    error instanceof Error
      ? `${error.name}: ${error.message}`
      : String(error ?? "");
  return /ChunkLoadError|Loading chunk .+ failed|Failed to load chunk|Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed/i.test(
    message
  );
}

/**
 * Recarga la página una sola vez por ventana de tiempo.
 * Devuelve true si disparó la recarga (la UI debe mostrar "recuperando...").
 * Si ya se recargó hace menos de un minuto (o no hay sessionStorage),
 * devuelve false para que la UI muestre el botón manual de reintentar.
 */
export function reloadOnceForChunkError(): boolean {
  try {
    const lastReloadAt = Number(sessionStorage.getItem(STORAGE_KEY) ?? 0);
    if (Date.now() - lastReloadAt < RELOAD_WINDOW_MS) return false;
    sessionStorage.setItem(STORAGE_KEY, String(Date.now()));
  } catch {
    return false;
  }
  window.location.reload();
  return true;
}
