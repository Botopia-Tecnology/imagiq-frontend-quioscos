"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
const API_KEY = process.env.NEXT_PUBLIC_API_KEY || "";

interface OrderItem {
  sku: string;
  nombre: string;
  cantidad: number;
  unit_price: number;
}

interface OrderSummary {
  id: string;
  estado: string;
  total_amount: number;
  shipping_amount: number;
  total_taxes_amount: number;
  currency: string;
  metodo_envio: number;
  customer_name: string;
  items: OrderItem[];
}

interface Bank {
  bankCode: string;
  bankName: string;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export default function PagarPsePage(
  props: Readonly<{ params: Readonly<Promise<{ orderId: string }>> }>
) {
  const router = useRouter();
  const [orderId, setOrderId] = useState<string | null>(null);
  const [order, setOrder] = useState<OrderSummary | null>(null);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [selectedBank, setSelectedBank] = useState("");
  const [selectedBankName, setSelectedBankName] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    props.params.then(({ orderId: id }) => {
      setOrderId(id);
    });
  }, [props.params]);

  const fetchOrderAndBanks = useCallback(async () => {
    if (!orderId) return;

    setIsLoading(true);
    setError(null);

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (API_KEY) headers["X-API-Key"] = API_KEY;

      const [orderRes, banksRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/payments/pse/order-summary/${orderId}`, {
          headers,
        }),
        fetch(`${API_BASE_URL}/api/payments/epayco/banks`, { headers }),
      ]);

      if (!orderRes.ok) {
        throw new Error(
          "Ya se procesó el pago de esta orden. Por favor, intente creando una nueva orden."
        );
      }

      const orderData: OrderSummary = await orderRes.json();

      if (orderData.estado !== "PENDING_PAYMENT") {
        if (
          orderData.estado === "APPROVED" ||
          orderData.estado === "PENDING"
        ) {
          setError("Ya se procesó el pago de esta orden. Por favor, intente creando una nueva orden.");
        } else if (orderData.estado === "CANCELLED") {
          setError("Esta orden fue cancelada. Por favor, intente creando una nueva orden.");
        } else if (orderData.estado === "REJECTED") {
          setError("El pago de esta orden fue rechazado. Por favor, intente creando una nueva orden.");
        } else {
          setError("Esta orden no está disponible para pago. Por favor, intente creando una nueva orden.");
        }
        setOrder(orderData);
        setIsLoading(false);
        return;
      }

      setOrder(orderData);

      if (banksRes.ok) {
        const banksData: Bank[] = await banksRes.json();
        setBanks(banksData);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Ya se procesó el pago de esta orden. Por favor, intente creando una nueva orden."
      );
    } finally {
      setIsLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    fetchOrderAndBanks();
  }, [fetchOrderAndBanks]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBank || !orderId) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (API_KEY) headers["X-API-Key"] = API_KEY;

      const res = await fetch(
        `${API_BASE_URL}/api/payments/pse/complete-payment/${orderId}`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            bank: selectedBank,
            bankName: selectedBankName,
          }),
        }
      );

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(
          errData?.message || "Error al procesar el pago"
        );
      }

      const data: { redirectUrl: string } = await res.json();
      // Redirect to bank portal
      window.location.href = data.redirectUrl;
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Error al procesar el pago"
      );
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-green-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Cargando orden...</p>
        </div>
      </div>
    );
  }

  // Error or non-payable state
  if (error && (!order || order.estado !== "PENDING_PAYMENT")) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-lg w-full bg-white rounded-2xl shadow-lg px-10 py-14 text-center">
          <div className="w-24 h-24 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg
              className="w-12 h-12 text-red-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-3">
            Orden no disponible
          </h2>
          <p className="text-lg text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  if (!order) return null;

  const subtotal = order.items.reduce(
    (sum, item) => sum + item.unit_price * item.cantidad,
    0
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header negro con Samsung Store */}
      <header className="bg-black text-white py-5 px-6">
        <div className="max-w-2xl mx-auto flex items-center justify-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/frame_white.png"
            alt="ImagiQ"
            className="h-12 w-12 rounded-full object-contain"
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://res.cloudinary.com/dnglv0zqg/image/upload/v1760575601/Samsung_black_ec1b9h.svg"
            alt="Samsung"
            className="h-10 w-auto brightness-0 invert"
          />
        </div>
      </header>

      <main className="max-w-2xl mx-auto p-4 sm:p-6">
        {/* PSE Logo */}
        <div className="flex justify-center my-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://res.cloudinary.com/dgnqk0ucm/image/upload/v1771526099/logo-pse_nubagw.png"
            alt="PSE"
            className="h-40 w-auto"
          />
        </div>

        {/* Greeting */}
        {order.customer_name && (
          <p className="text-gray-700 mb-4">
            Hola <span className="font-semibold">{order.customer_name}</span>,
            completa tu pago seleccionando tu banco:
          </p>
        )}

        {/* Order Summary */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-6 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-lg font-bold text-gray-900">
              Resumen del pedido
            </h2>
          </div>
          <div className="px-5 py-3">
            {order.items.map((item, idx) => (
              <div
                key={`${item.sku}-${idx}`}
                className="flex justify-between items-center py-2 border-b border-gray-50 last:border-0"
              >
                <div className="flex-1 min-w-0 pr-4">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {item.nombre}
                  </p>
                  <p className="text-xs text-gray-500">
                    Cant: {item.cantidad}
                  </p>
                </div>
                <p className="text-sm font-semibold text-gray-900 flex-shrink-0">
                  {formatCurrency(item.unit_price * item.cantidad)}
                </p>
              </div>
            ))}
          </div>
          <div className="px-5 py-3 bg-gray-50">
            <div className="flex justify-between text-base font-bold text-gray-900">
              <span>Total</span>
              <span>{formatCurrency(order.total_amount)}</span>
            </div>
          </div>
        </div>

        {/* Bank Selector + Pay Button */}
        <form onSubmit={handleSubmit}>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 mb-4">
            <label
              htmlFor="bank-select"
              className="block text-sm font-semibold text-gray-900 mb-2"
            >
              Selecciona tu banco
            </label>
            <select
              id="bank-select"
              value={selectedBank}
              onChange={(e) => {
                const code = e.target.value;
                const bank = banks.find((b) => b.bankCode === code);
                setSelectedBank(code);
                setSelectedBankName(bank?.bankName || "");
              }}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-white text-base"
              required
            >
              <option value="">Elige tu banco...</option>
              {banks.map((bank) => (
                <option key={bank.bankCode} value={bank.bankCode}>
                  {bank.bankName}
                </option>
              ))}
            </select>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={!selectedBank || isSubmitting}
            className="w-full bg-green-600 text-white py-4 px-6 rounded-xl font-bold text-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-green-500/40 hover:shadow-xl hover:shadow-green-500/50"
          >
            {isSubmitting ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Procesando...
              </>
            ) : (
              `Pagar ${formatCurrency(order.total_amount)} con PSE`
            )}
          </button>
        </form>

        {/* Security note */}
        <p className="text-center text-xs text-gray-400 mt-6">
          Pago procesado de forma segura por ePayco
        </p>
      </main>
    </div>
  );
}
