"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CreditCard } from "lucide-react";
import { toast } from "sonner";
import { kioskCancelDatafonoPayment, kioskGetGuides } from "@/app/carrito/utils";
import { useCart } from "@/hooks/useCart";

interface KioskPagoData {
  orderId: string;
  serialId: string;
  guides: { numero_guia: string; url_seguimiento: string; cod_bodega: string | null; nombre_tienda: string | null }[];
  billingData: {
    nombre: string;
    documento: string;
    tipoDocumento?: string;
    email: string;
    telefono: string;
    direccion?: {
      linea_uno: string;
      ciudad?: string;
    } | null;
  } | null;
  shippingData: {
    address?: string;
    city?: string;
  } | null;
  products: {
    name: string;
    image?: string;
    price: number;
    quantity: number;
    sku: string;
  }[];
  calculations: {
    discount: number;
    shipping: number;
    total: number;
  };
}

export default function KioskPagoPage(
  props: Readonly<{ params: Readonly<Promise<{ orderId: string }>> }>
) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { clearCart } = useCart();
  const [orderId, setOrderId] = useState<string | null>(null);
  const [data, setData] = useState<KioskPagoData | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showPaymentNotConfirmedModal, setShowPaymentNotConfirmedModal] = useState(false);

  // Resolve params
  useEffect(() => {
    props.params.then(({ orderId: id }) => {
      setOrderId(id);
    });
  }, [props.params]);

  // Load data from localStorage
  useEffect(() => {
    if (!orderId) return;
    try {
      const stored = localStorage.getItem("kiosk_pago_data");
      if (stored) {
        const parsed: KioskPagoData = JSON.parse(stored);
        if (parsed.orderId === orderId) {
          setData(parsed);
          return;
        }
      }
      setError("No se encontraron los datos de la orden. Vuelve a intentar.");
    } catch {
      setError("Error al cargar los datos de la orden.");
    }
  }, [orderId]);

  // Detect payment_not_confirmed status from verify-purchase timeout
  useEffect(() => {
    if (searchParams.get("status") === "payment_not_confirmed") {
      setShowPaymentNotConfirmedModal(true);
    }
  }, [searchParams]);

  // Poll for guides if they're not yet ready (delivery runs in background)
  const guidesPollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (!orderId || !data) return;
    // If guides already exist, no need to poll
    if (data.guides && data.guides.length > 0) return;

    console.log("[kiosk-pago] Guides not ready yet, starting polling...");

    const poll = async () => {
      const result = await kioskGetGuides(orderId);
      if (result && result.ready && result.guides.length > 0) {
        console.log(`[kiosk-pago] Guides ready: ${result.guides.length} guide(s)`);
        // Update state and localStorage
        setData((prev) => {
          if (!prev) return prev;
          const updated = { ...prev, guides: result.guides };
          localStorage.setItem("kiosk_pago_data", JSON.stringify(updated));
          return updated;
        });
        // Stop polling
        if (guidesPollingRef.current) {
          clearInterval(guidesPollingRef.current);
          guidesPollingRef.current = null;
        }
      }
    };

    // Poll immediately, then every 3 seconds
    poll();
    guidesPollingRef.current = setInterval(poll, 3000);

    return () => {
      if (guidesPollingRef.current) {
        clearInterval(guidesPollingRef.current);
        guidesPollingRef.current = null;
      }
    };
  }, [orderId, data?.guides?.length]);

  const handleKioskFinalize = useCallback(() => {
    localStorage.removeItem("kiosk_client_id");
    localStorage.removeItem("kiosk_client");
    localStorage.removeItem("checkout-address");
    localStorage.removeItem("imagiq_default_address");
    localStorage.removeItem("imagiq_candidate_stores_cache");
    localStorage.removeItem("checkout-billing-data");
    localStorage.removeItem("checkout-envio-imagiq");
    localStorage.removeItem("checkout-received-by-client");
    localStorage.removeItem("checkout-zero-interest");
    localStorage.removeItem("checkout-delivery-method");
    localStorage.removeItem("checkout-payment-method");
    localStorage.removeItem("checkout-selected-bank");
    localStorage.removeItem("checkout-installments");
    localStorage.removeItem("checkout-card-data");
    localStorage.removeItem("checkout-saved-card-id");
    localStorage.removeItem("kiosk_payment_link_sent");
    localStorage.removeItem("pending_order_id");
    localStorage.removeItem("kiosk_pago_data");
    clearCart();
    router.push("/");
  }, [clearCart, router]);

  const handleValidatePayment = () => {
    if (!orderId) return;
    // Solo redirige a verify-purchase para verificar el estado de la orden
    // NO cambia el estado a APPROVED - solo valida si ya fue aprobada
    router.push(`/verify-purchase/${orderId}?from=kiosk`);
  };

  const handleCancelPayment = async () => {
    if (!orderId || isCancelling) return;
    setShowCancelModal(false);
    setIsCancelling(true);
    setError(null);
    try {
      const res = await kioskCancelDatafonoPayment(orderId);

      if ("error" in res) {
        setError(res.message);
        toast.error(res.message);
        return;
      }

      toast.success("Orden cancelada - Guías anuladas");

      setTimeout(() => {
        handleKioskFinalize();
      }, 2000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error al cancelar la orden";
      setError(msg);
      toast.error(msg);
    } finally {
      setIsCancelling(false);
    }
  };

  // Loading state
  if (!data && !error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-black border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Cargando orden...</p>
        </div>
      </div>
    );
  }

  // Error without data
  if (error && !data) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-black text-white py-5 px-6">
          <div className="max-w-2xl mx-auto flex items-center justify-center gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/frame_white.png" alt="ImagiQ" className="h-12 w-12 rounded-full object-contain" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://res.cloudinary.com/dnglv0zqg/image/upload/v1760575601/Samsung_black_ec1b9h.svg"
              alt="Samsung"
              className="h-10 w-auto brightness-0 invert"
            />
          </div>
        </header>
        <div className="flex items-center justify-center p-4 mt-20">
          <div className="max-w-lg w-full bg-white rounded-2xl shadow-lg px-10 py-14 text-center">
            <div className="w-24 h-24 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-12 h-12 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">Error</h2>
            <p className="text-lg text-gray-600 mb-6">{error}</p>
            <button
              onClick={() => router.push("/")}
              className="bg-black text-white font-bold py-3 px-6 rounded-xl text-lg hover:bg-gray-800 transition-colors"
            >
              Volver al inicio
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  // Main waiting page - single column centered, no scroll
  return (
    <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">
      {/* Header negro Samsung */}
      <header className="bg-black text-white py-4 px-6 flex-shrink-0">
        <div className="max-w-2xl mx-auto flex items-center justify-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/frame_white.png" alt="ImagiQ" className="h-10 w-10 rounded-full object-contain" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://res.cloudinary.com/dnglv0zqg/image/upload/v1760575601/Samsung_black_ec1b9h.svg"
            alt="Samsung"
            className="h-8 w-auto brightness-0 invert"
          />
        </div>
      </header>

      <main className="flex-1 flex flex-col max-w-2xl mx-auto w-full px-4 py-3 overflow-hidden">
        <div className="flex flex-col items-center mb-2 flex-shrink-0">
          <div className="w-12 h-12 bg-black rounded-full flex items-center justify-center mb-2">
            <CreditCard className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-lg font-bold text-gray-900">Orden procesada - Esperando pago</h1>
          <p className="text-gray-600 text-sm">
            Procede con el pago en el datafono o efectivo y luego presiona <strong>&quot;Verificar pago&quot;</strong>.
          </p>
        </div>

        {/* Scrollable content area */}
        <div className="flex-1 overflow-auto min-h-0 space-y-3">
          {/* Info de la orden */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100">
              <h2 className="text-base font-bold text-gray-900">Información de la orden</h2>
            </div>
            <div className="px-5 py-3 space-y-2.5">
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">N° de pedido</span>
                <span className="text-sm font-bold text-gray-900 font-mono">
                  {data.serialId || data.orderId}
                </span>
              </div>
              {data.billingData && (
                <>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500">Cliente</span>
                    <span className="text-sm font-medium text-gray-900">{data.billingData.nombre}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500">Documento</span>
                    <span className="text-sm text-gray-900">
                      {data.billingData.tipoDocumento || "C.C."} {data.billingData.documento}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500">Email</span>
                    <span className="text-sm text-gray-900">{data.billingData.email}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500">Teléfono</span>
                    <span className="text-sm text-gray-900">{data.billingData.telefono}</span>
                  </div>
                </>
              )}
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Método de pago</span>
                <span className="text-sm text-gray-900">Tarjeta / Efectivo</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Envío</span>
                <span className="text-sm text-gray-900">Domicilio - Coordinadora</span>
              </div>
              {data.guides.length > 0 ? (
                <>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500">Guía(s)</span>
                    <span className="text-sm font-mono text-gray-900">
                      {data.guides.map((g) => g.numero_guia).join(", ")}
                    </span>
                  </div>
                  {data.guides.some((g) => g.nombre_tienda) && (
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">Sale de</span>
                      <span className="text-sm text-gray-900">
                        {[...new Set(data.guides.map((g) => g.nombre_tienda).filter(Boolean))].join(", ")}
                      </span>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Guía(s)</span>
                  <span className="text-sm text-gray-500 flex items-center gap-2">
                    <span className="w-3.5 h-3.5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                    Generando...
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Productos */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100">
              <h2 className="text-base font-bold text-gray-900">Detalle de compra</h2>
            </div>
            <div className="px-5 py-2">
              {data.products.map((item, idx) => (
                <div
                  key={`${item.sku}-${idx}`}
                  className="flex justify-between items-center py-2 border-b border-gray-50 last:border-0"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0 pr-4">
                    {item.image && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.image}
                        alt={item.name}
                        className="w-14 h-14 object-contain rounded-md flex-shrink-0"
                      />
                    )}
                    <div>
                      <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
                      <p className="text-xs text-gray-500">Cant: {item.quantity || 1}</p>
                    </div>
                  </div>
                  <p className="text-sm font-semibold text-gray-900 flex-shrink-0">
                    $ {Number(item.price * (item.quantity || 1)).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
            <div className="px-5 py-2 bg-gray-50 space-y-1">
              {data.calculations.discount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Descuento</span>
                  <span className="text-red-600 font-medium">
                    -$ {Number(data.calculations.discount).toLocaleString()}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Envío</span>
                <span className="text-gray-900">
                  {data.calculations.shipping > 0
                    ? `$ ${Number(data.calculations.shipping).toLocaleString()}`
                    : "Gratis"}
                </span>
              </div>
              <div className="flex justify-between text-base font-bold text-gray-900 pt-1 border-t border-gray-200">
                <span>Total</span>
                <span>$ {Number(data.calculations.total).toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Direcciones */}
          {(data.shippingData?.address || data.billingData?.direccion) && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              {data.shippingData?.address && (
                <>
                  <div className="px-5 py-3 border-b border-gray-100">
                    <h2 className="text-base font-bold text-gray-900">Dirección de entrega</h2>
                  </div>
                  <div className="px-5 py-2">
                    <p className="text-sm text-gray-900">{data.shippingData.address}</p>
                    {data.shippingData.city && (
                      <p className="text-sm text-gray-500">{data.shippingData.city}</p>
                    )}
                  </div>
                </>
              )}
              {data.billingData?.direccion && (
                <>
                  <div className="px-5 py-3 border-b border-gray-100 border-t border-t-gray-100">
                    <h2 className="text-base font-bold text-gray-900">Dirección de facturación</h2>
                  </div>
                  <div className="px-5 py-2">
                    <p className="text-sm text-gray-900">{data.billingData.direccion.linea_uno}</p>
                    {data.billingData.direccion.ciudad && (
                      <p className="text-sm text-gray-500">{data.billingData.direccion.ciudad}</p>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg mt-2 text-sm flex-shrink-0">
            {error}
          </div>
        )}

        {/* Botones de acción - fijos abajo */}
        <div className="flex gap-4 mt-3 flex-shrink-0">
          <button
            onClick={() => setShowCancelModal(true)}
            disabled={isCancelling}
            className="flex-1 bg-red-600 text-white py-3 px-6 rounded-xl font-bold text-base hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isCancelling ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Cancelando...
              </>
            ) : (
              "Cancelar pago"
            )}
          </button>
          <button
            onClick={handleValidatePayment}
            disabled={isCancelling}
            className="flex-1 bg-green-600 text-white py-3 px-6 rounded-xl font-bold text-base hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-green-500/40"
          >
            Verificar pago
          </button>
        </div>

        <p className="text-center text-xs text-gray-400 mt-2 pb-1 flex-shrink-0">
          Pago procesado en tienda Samsung Experience Store
        </p>
      </main>

      {/* Modal de confirmación para cancelar */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
            <div className="px-6 pt-6 pb-4">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 text-center mb-2">
                Cancelar orden
              </h3>
              <p className="text-gray-600 text-center text-sm">
                ¿Estás seguro de cancelar esta orden? Se anularán las guías de envío creadas.
              </p>
            </div>
            <div className="flex gap-3 px-6 pb-6">
              <button
                onClick={() => setShowCancelModal(false)}
                className="flex-1 bg-gray-100 text-gray-700 py-3 px-4 rounded-xl font-semibold text-base hover:bg-gray-200 transition-colors"
              >
                Volver
              </button>
              <button
                onClick={handleCancelPayment}
                className="flex-1 bg-red-600 text-white py-3 px-4 rounded-xl font-semibold text-base hover:bg-red-700 transition-colors"
              >
                Sí, cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de pago no confirmado */}
      {showPaymentNotConfirmedModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden relative">
            <button
              onClick={() => setShowPaymentNotConfirmedModal(false)}
              className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <div className="px-6 pt-6 pb-4">
              <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 text-center mb-2">
                Pago no confirmado
              </h3>
              <p className="text-gray-600 text-center text-sm">
                No se pudo confirmar el pago. Puedes intentar validar nuevamente o cancelar la orden.
              </p>
            </div>
            <div className="px-6 pb-6">
              <button
                onClick={() => setShowPaymentNotConfirmedModal(false)}
                className="w-full bg-black text-white py-3 px-4 rounded-xl font-semibold text-base hover:bg-gray-800 transition-colors"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
