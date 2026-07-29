/**
 * 🏬 STOCK DE QUIOSCOS = SOLO CENTRO DE DISTRIBUCIÓN
 *
 * Los quioscos venden únicamente lo que la bodega 001 (Centro de
 * Distribución) puede despachar; el stock de vitrinas de otras tiendas no
 * cuenta. El backend acepta `codBodega` en todas las rutas de productos y
 * restringe `stockTotal` a esa bodega. Aquí se inyecta el parámetro en un
 * único punto para que TODA lectura de productos del quiosco lo lleve.
 */

export const COD_BODEGA_CD = "001";

/** Agrega codBodega=001 a cualquier GET de /api/products (idempotente) */
export function withCodBodegaCD(endpoint: string): string {
  if (!endpoint.startsWith("/api/products")) return endpoint;
  if (endpoint.includes("codBodega=")) return endpoint;
  const sep = endpoint.includes("?") ? "&" : "?";
  return `${endpoint}${sep}codBodega=${COD_BODEGA_CD}`;
}
