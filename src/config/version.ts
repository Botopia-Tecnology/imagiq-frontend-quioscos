/**
 * 🔖 VERSIÓN DE LA APLICACIÓN
 *
 * Actualiza este valor manualmente cada vez que subas a producción.
 * Cuando la versión cambie, se limpiará el localStorage de los usuarios
 * (excepto la clave de versión).
 *
 * Formato recomendado: "MAJOR.MINOR.PATCH" (ej: "1.0.0", "1.0.1", "2.0.0")
 */
// 1.0.7 — limpieza forzada del localStorage de los kioscos: arrastraban estado
// viejo de ventas (p.ej. el flag `kiosk_payment_link_sent` de links PSE/Addi no
// completados, que en Ses Palmira sobrevivió desde abril y en agosto hizo que una
// venta con datáfono mostrara "Reenviar link" en vez de "Confirmar orden").
// El wipe también borra la sesión de la tienda, pero el JWT de kiosco dura 24 h
// (auth-ms kiosk.service.ts:976), así que igual re-loguean a diario.
export const APP_VERSION = "1.0.7";
