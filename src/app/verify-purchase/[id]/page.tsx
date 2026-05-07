"use client";
import LogoReloadAnimation from "@/app/carrito/LogoReloadAnimation";
import { kioskCancelDatafonoV2 } from "@/app/carrito/utils";
import { connectKioskSocket, disconnectKioskSocket } from "@/lib/kiosk-socket";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
const MAX_RETRY_ATTEMPTS = 5;
const KIOSK_TOTAL_SECONDS = 1200;

export default function VerifyPurchase(props: Readonly<{ params: Readonly<Promise<{ id: string }>>; }>) {
  const { params } = props;
  const [orderId, setOrderId] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(true);
  const [kioskWaiting, setKioskWaiting] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(KIOSK_TOTAL_SECONDS);
  const retryCountRef = useRef(0);
  const [isCancelling, setIsCancelling] = useState(false);
  const kioskTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const navigatedRef = useRef(false);
  const socketCleanupRef = useRef<(() => void) | null>(null);

  const isKiosk = searchParams.get("from") === "kiosk";
  const serialParam = searchParams.get("serial");

  useEffect(() => {
    params.then(({ id }) => {
      setOrderId(id);
    });
  }, [params]);

  // Cleanup on unmount: clear timer, detach socket listeners, leave socket.
  // The socket itself is a singleton so we only disconnect when this page
  // unmounts to avoid keeping an idle connection open after the kiosk
  // navigates away. Detaching the listeners first prevents stale handlers
  // from firing if the socket gets re-used by another page mount.
  useEffect(() => {
    return () => {
      if (kioskTimerRef.current) clearInterval(kioskTimerRef.current);
      if (socketCleanupRef.current) {
        socketCleanupRef.current();
        socketCleanupRef.current = null;
      }
      if (isKiosk) disconnectKioskSocket();
    };
  }, [isKiosk]);

  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Kiosk waiting: only the websocket tells us when the order is approved.
  // We start a countdown for the UI + timeout (20 min) and a single websocket
  // listener for `order_approved`. No polling.
  const startKioskWaiting = useCallback(() => {
    if (!orderId) return;
    setKioskWaiting(true);
    let remaining = KIOSK_TOTAL_SECONDS;
    setSecondsLeft(remaining);

    kioskTimerRef.current = setInterval(() => {
      remaining -= 1;
      setSecondsLeft(remaining);
      if (remaining <= 0) {
        if (kioskTimerRef.current) clearInterval(kioskTimerRef.current);
        if (navigatedRef.current) return;
        navigatedRef.current = true;
        router.push(`/kiosk-pago/${orderId}?status=payment_not_confirmed`);
      }
    }, 1000);

    // Websocket: subscribe to this order's room and wait for order_approved.
    const socket = connectKioskSocket();
    const watch = () => socket.emit("watch_order", { orderId });
    if (socket.connected) {
      watch();
    }
    socket.on("connect", watch); // re-subscribe on reconnects

    const onApproved = (data: { orderId: string }) => {
      if (!data || data.orderId !== orderId) return;
      if (navigatedRef.current) return;
      navigatedRef.current = true;
      if (kioskTimerRef.current) clearInterval(kioskTimerRef.current);
      router.push(`/success-checkout/${orderId}?from=kiosk`);
    };
    socket.on("order_approved", onApproved);

    // Detach handlers if this function is called twice or the page unmounts.
    // Removing previous handlers before re-registering would also work, but
    // tracking explicit refs keeps unmount cleanup symmetric and obvious.
    if (socketCleanupRef.current) socketCleanupRef.current();
    socketCleanupRef.current = () => {
      socket.off("connect", watch);
      socket.off("order_approved", onApproved);
    };
  }, [orderId, router]);

  // Non-kiosk verification (e.g. PSE redirect back). Kept polling-based since
  // those flows don't go through the kiosk websocket.
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
    let serial = orderId;
    try {
      const res = await kioskCancelDatafonoV2(orderId);
      if ("serialId" in res && res.serialId) {
        serial = res.serialId;
      }
    } catch {
      // Even if cancel fails, redirect
    }
    if (navigatedRef.current) return;
    navigatedRef.current = true;
    router.push(`/carrito/step7?from=kiosk&status=order_cancelled&serial=${encodeURIComponent(serial)}`);
  }, [orderId, isCancelling, router]);

  // Kiosk: single screen — LogoReloadAnimation stays, timer + cancel overlay on top
  if (isKiosk) {
    return (
      <div className="fixed inset-0 z-50">
        <LogoReloadAnimation
          open={true}
          onFinish={orderId ? startKioskWaiting : undefined}
          text="Verificando pago"
        />
        {/* Overlay: timer + cancel — appears after animation finishes */}
        {kioskWaiting && (
          <div className="fixed bottom-12 left-0 right-0 z-[60] flex flex-col items-center gap-4">
            {serialParam && (
              <div className="flex flex-col items-center mb-2">
                <p className="text-white/40 text-sm mb-1">Orden</p>
                <p className="text-white/70 text-2xl md:text-3xl font-mono font-bold tracking-wider">
                  {serialParam}
                </p>
              </div>
            )}
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
