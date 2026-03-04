"use client";
import LogoReloadAnimation from "@/app/carrito/LogoReloadAnimation";
import { kioskCancelDatafonoPayment } from "@/app/carrito/utils";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
const MAX_RETRY_ATTEMPTS = 5;
const KIOSK_POLL_INTERVAL = 20;
const KIOSK_TOTAL_SECONDS = 600;

export default function VerifyPurchase(props: Readonly<{ params: Readonly<Promise<{ id: string }>>; }>) {
  const { params } = props;
  const [orderId, setOrderId] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(true);
  const [kioskPolling, setKioskPolling] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(KIOSK_TOTAL_SECONDS);
  const retryCountRef = useRef(0);
  const [isCancelling, setIsCancelling] = useState(false);
  const kioskTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const kioskPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isKiosk = searchParams.get("from") === "kiosk";

  useEffect(() => {
    params.then(({ id }) => {
      setOrderId(id);
    });
  }, [params]);

  // Cleanup intervals on unmount
  useEffect(() => {
    return () => {
      if (kioskTimerRef.current) clearInterval(kioskTimerRef.current);
      if (kioskPollRef.current) clearInterval(kioskPollRef.current);
    };
  }, []);

  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Kiosk polling: single check — now also returns serialId for rejected
  const kioskVerifyOnce = useCallback(async (): Promise<{ result: "approved" | "rejected" | "pending" | "error"; serialId?: string }> => {
    if (!orderId) return { result: "error" };
    try {
      const response = await fetch(`${API_BASE_URL}/api/orders/verify/${orderId}`);
      if (!response.ok) return { result: "error" };
      const data: { message: string; status: number | string; requiresAction?: boolean; orderStatus?: string; serialId?: string } = await response.json();

      console.log(`[VERIFY][KIOSK] Poll result:`, data);

      if (data.orderStatus === "APPROVED") return { result: "approved" };
      if (data.orderStatus === "REJECTED" || data.orderStatus === "CANCELLED") return { result: "rejected", serialId: data.serialId };
      if (data.requiresAction === true || data.orderStatus === "PENDING" || data.orderStatus === "PENDING_PAYMENT") return { result: "pending" };
      if (data.status === 200 && !data.requiresAction && data.orderStatus !== "PENDING") return { result: "approved" };

      return { result: "pending" };
    } catch {
      return { result: "error" };
    }
  }, [orderId]);

  // Start kiosk polling in background (UI stays on LogoReloadAnimation)
  const startKioskPolling = useCallback(async () => {
    if (!orderId) return;
    setKioskPolling(true);
    let remaining = KIOSK_TOTAL_SECONDS;
    setSecondsLeft(remaining);

    kioskTimerRef.current = setInterval(() => {
      remaining -= 1;
      setSecondsLeft(remaining);
      if (remaining <= 0) {
        if (kioskTimerRef.current) clearInterval(kioskTimerRef.current);
        if (kioskPollRef.current) clearInterval(kioskPollRef.current);
        router.push(`/kiosk-pago/${orderId}?status=payment_not_confirmed`);
      }
    }, 1000);

    const first = await kioskVerifyOnce();
    if (first.result === "approved") {
      if (kioskTimerRef.current) clearInterval(kioskTimerRef.current);
      router.push(`/success-checkout/${orderId}?from=kiosk`);
      return;
    }
    if (first.result === "rejected") {
      if (kioskTimerRef.current) clearInterval(kioskTimerRef.current);
      const serial = first.serialId || orderId;
      router.push(`/carrito/step7?from=kiosk&status=payment_rejected&serial=${encodeURIComponent(serial)}`);
      return;
    }

    kioskPollRef.current = setInterval(async () => {
      const poll = await kioskVerifyOnce();
      if (poll.result === "approved") {
        if (kioskTimerRef.current) clearInterval(kioskTimerRef.current);
        if (kioskPollRef.current) clearInterval(kioskPollRef.current);
        router.push(`/success-checkout/${orderId}?from=kiosk`);
      } else if (poll.result === "rejected") {
        if (kioskTimerRef.current) clearInterval(kioskTimerRef.current);
        if (kioskPollRef.current) clearInterval(kioskPollRef.current);
        const serial = poll.serialId || orderId;
        router.push(`/carrito/step7?from=kiosk&status=payment_rejected&serial=${encodeURIComponent(serial)}`);
      }
    }, KIOSK_POLL_INTERVAL * 1000);
  }, [orderId, router, kioskVerifyOnce]);

  // Non-kiosk verification (original flow)
  const verifyOrder = useCallback(async () => {
    if (!orderId) return;
    try {
      const response = await fetch(`${API_BASE_URL}/api/orders/verify/${orderId}`);
      if (!response.ok) { router.push("/error-checkout"); return; }
      const data: { message: string; status: number | string; requiresAction?: boolean; orderStatus?: string } = await response.json();

      if (data.requiresAction === true || data.orderStatus === "PENDING" || data.orderStatus === "PENDING_PAYMENT") {
        retryCountRef.current += 1;
        if (retryCountRef.current >= MAX_RETRY_ATTEMPTS) { router.push("/error-checkout"); return; }
        setTimeout(() => verifyOrder(), 5000);
        return;
      }
      retryCountRef.current = 0;
      if ((data.status === 200 || data.status === "APPROVED") && data.orderStatus !== "PENDING") {
        router.push(`/success-checkout/${orderId}`);
      } else {
        router.push("/error-checkout");
      }
    } catch {
      router.push("/error-checkout");
    }
  }, [orderId, router]);

  const handleCancelOrder = useCallback(async () => {
    if (!orderId || isCancelling) return;
    setIsCancelling(true);
    if (kioskTimerRef.current) clearInterval(kioskTimerRef.current);
    if (kioskPollRef.current) clearInterval(kioskPollRef.current);
    let serial = orderId;
    try {
      const res = await kioskCancelDatafonoPayment(orderId);
      if ("serialId" in res && res.serialId) {
        serial = res.serialId;
      }
    } catch {
      // Even if cancel fails, redirect
    }
    router.push(`/carrito/step7?from=kiosk&status=order_cancelled&serial=${encodeURIComponent(serial)}`);
  }, [orderId, isCancelling, router]);

  // Kiosk: single screen — LogoReloadAnimation stays, timer + cancel overlay on top
  if (isKiosk) {
    return (
      <div className="fixed inset-0 z-50">
        <LogoReloadAnimation
          open={true}
          onFinish={orderId ? startKioskPolling : undefined}
          text="Verificando pago"
        />
        {/* Overlay: timer + cancel — appears after animation finishes */}
        {kioskPolling && (
          <div className="fixed bottom-12 left-0 right-0 z-[60] flex flex-col items-center gap-4">
            <div className="flex flex-col items-center">
              <p className="text-white/40 text-sm mb-1">Tiempo restante</p>
              <p className="text-white/70 text-4xl md:text-5xl font-mono font-bold tracking-wider">
                {formatTime(secondsLeft)}
              </p>
            </div>
            <button
              onClick={handleCancelOrder}
              disabled={isCancelling}
              className="bg-red-600/90 text-white py-3 px-10 rounded-xl font-bold text-lg hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isCancelling ? "Cancelando..." : "Cancelar pedido"}
            </button>
          </div>
        )}
      </div>
    );
  }

  // Non-kiosk: LogoReloadAnimation then verify
  return (
    <div className="fixed inset-0 z-50 bg-[#0057B7]">
      <LogoReloadAnimation
        open={isLoading}
        onFinish={orderId ? verifyOrder : undefined}
      />
    </div>
  );
}
