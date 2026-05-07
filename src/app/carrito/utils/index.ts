"use client";
import { AddiPaymentData, CardPaymentData, PsePaymentData, CheckZeroInterestRequest, CheckZeroInterestResponse } from "../types";
import { apiPost, apiGet } from "@/lib/api-client";
import posthog from "posthog-js";

/** Get PostHog session tracking IDs (safe - returns empty strings if unavailable) */
export function getPostHogIds() {
  try {
    if (typeof window !== "undefined" && posthog.__loaded) {
      return {
        posthogSessionId: posthog.get_session_id?.() || "",
        posthogDistinctId: posthog.get_distinct_id?.() || "",
      };
    }
  } catch { /* PostHog not available */ }
  return { posthogSessionId: "", posthogDistinctId: "" };
}

export type KioskEmailSentResponse = {
  kioskEmailSent: boolean;
  kioskWhatsappSent: boolean;
  email: string;
  orderId: string;
  serialId: string;
};

export async function payWithAddi(
  props: AddiPaymentData
): Promise<{ redirectUrl: string } | { error: string; message: string }> {
  try {
    const data = await apiPost<{ redirectUrl: string }>('/api/payments/addi/apply', props);
    return data;
  } catch (error) {
    console.error("Error initiating Addi payment:", error);
    if (error instanceof Error) {
      return { error: "payment_failed", message: error.message || "Failed to initiate Addi payment" };
    }
    return { error: "network_error", message: "Error de conexión al procesar el pago" };
  }
}

export async function payWithCard(
  props: CardPaymentData
): Promise<{ redirectionUrl: string; requires3DS?: boolean; data3DS?: unknown; orderId?: string } | { error: string; message: string }> {
  try {
    const data = await apiPost<{ redirectionUrl: string; requires3DS?: boolean; data3DS?: unknown; orderId?: string }>('/api/payments/epayco/credit-card', {
      ...props,
      dues: props.dues.trim() === "" ? "1" : props.dues,
    });
    console.log("[DEBUG PAYLOAD NEW CARD] Items:", JSON.stringify(props.items.map(i => ({ sku: i.sku, cat: i.categoria, category: i.category }))));
    return data;
  } catch (error) {
    console.error("Error processing card payment:", error);
    if (error instanceof Error) {
      return { error: "payment_failed", message: error.message || "Failed to process card payment" };
    }
    return { error: "network_error", message: "Error de conexión al procesar el pago" };
  }
}

// Nueva función para pagar con tarjeta guardada (token)
export async function payWithSavedCard(
  props: Omit<CardPaymentData, "cardNumber" | "cardExpMonth" | "cardExpYear" | "cardCvc"> & { cardId: string }
): Promise<{ redirectionUrl: string; requires3DS?: boolean; data3DS?: unknown; orderId?: string } | { error: string; message: string }> {
  try {
    const data = await apiPost<{ redirectionUrl: string; requires3DS?: boolean; data3DS?: unknown; orderId?: string }>('/api/payments/epayco/saved-card', {
      ...props,
      dues: props.dues.trim() === "" ? "1" : props.dues,
    });
    console.log("[DEBUG PAYLOAD SAVED CARD] Items:", JSON.stringify(props.items.map(i => ({ sku: i.sku, cat: i.categoria, category: i.category }))));
    return data;
  } catch (error) {
    console.error("Error processing saved card payment:", error);
    if (error instanceof Error) {
      return { error: "payment_failed", message: error.message || "Failed to process saved card payment" };
    }
    return { error: "network_error", message: "Error de conexión al procesar el pago" };
  }
}

export async function payWithPse(props: PsePaymentData): Promise<{ redirectUrl: string } | { error: string; message: string }> {
  try {
    const data = await apiPost<{ redirectUrl: string }>('/api/payments/epayco/pse', props);
    return data;
  } catch (error) {
    console.error("Error processing PSE payment:", error);
    if (error instanceof Error) {
      return { error: "payment_failed", message: error.message || "Failed to process PSE payment" };
    }
    return { error: "network_error", message: "Error de conexión al procesar el pago" };
  }
}

/**
 * Kiosk mode: Creates PSE payment and sends bank redirect link to customer's email
 */
export async function kioskPayWithPse(
  props: PsePaymentData & { kioskCustomerEmail: string; kioskCustomerPhone?: string; previousOrderId?: string; kioskStoreId?: string; posthogSessionId?: string; posthogDistinctId?: string }
): Promise<KioskEmailSentResponse | { error: string; message: string }> {
  try {
    const data = await apiPost<KioskEmailSentResponse>('/api/payments/kiosk/pse', props);
    return data;
  } catch (error) {
    console.error("Error processing kiosk PSE payment:", error);
    if (error instanceof Error) {
      return { error: "payment_failed", message: error.message || "Failed to process kiosk PSE payment" };
    }
    return { error: "network_error", message: "Error de conexión al procesar el pago" };
  }
}

/**
 * Kiosk mode: Creates Addi application and sends redirect link to customer's email
 */
export async function kioskPayWithAddi(
  props: AddiPaymentData & { kioskCustomerEmail: string; kioskCustomerPhone?: string; previousOrderId?: string; kioskStoreId?: string; posthogSessionId?: string; posthogDistinctId?: string }
): Promise<KioskEmailSentResponse | { error: string; message: string }> {
  try {
    const data = await apiPost<KioskEmailSentResponse>('/api/payments/kiosk/addi', props);
    return data;
  } catch (error) {
    console.error("Error processing kiosk Addi payment:", error);
    if (error instanceof Error) {
      return { error: "payment_failed", message: error.message || "Failed to process kiosk Addi payment" };
    }
    return { error: "network_error", message: "Error de conexión al procesar el pago" };
  }
}

/**
 * Kiosk mode: Creates a datafono/efectivo order (no payment data) and posts to Novasol
 */
export async function kioskCreateDatafonoOrder(
  props: Record<string, any>
): Promise<{ orderId: string; novasoftPosted: boolean } | { error: string; message: string }> {
  try {
    const data = await apiPost<{ orderId: string; novasoftPosted: boolean }>('/api/payments/kiosk/datafono', props);
    return data;
  } catch (error) {
    console.error("Error creating kiosk datafono order:", error);
    if (error instanceof Error) {
      return { error: "order_failed", message: error.message || "Failed to create datafono order" };
    }
    return { error: "network_error", message: "Error de conexión al crear la orden" };
  }
}

/**
 * Kiosk mode: Confirms a datafono/efectivo order after physical payment
 */
export async function kioskConfirmDatafono(
  orderId: string
): Promise<{ orderId: string; status: string; result: any } | { error: string; message: string }> {
  try {
    const data = await apiPost<{ orderId: string; status: string; result: any }>(`/api/payments/kiosk/datafono/confirm/${orderId}`, {});
    return data;
  } catch (error) {
    console.error("Error confirming kiosk datafono order:", error);
    if (error instanceof Error) {
      return { error: "confirm_failed", message: error.message || "Failed to confirm datafono order" };
    }
    return { error: "network_error", message: "Error de conexión al confirmar la orden" };
  }
}

/**
 * Kiosk mode: Processes a datafono order (creates order + shipping guides WITHOUT recogida)
 */
export async function kioskProcessDatafono(
  props: Record<string, any>
): Promise<{ orderId: string; serialId: string; novasoftPosted: boolean; guides: { numero_guia: string; url_seguimiento: string; cod_bodega: string | null; nombre_tienda: string | null }[] } | { error: string; message: string }> {
  try {
    const data = await apiPost<{ orderId: string; serialId: string; novasoftPosted: boolean; guides: { numero_guia: string; url_seguimiento: string; cod_bodega: string | null; nombre_tienda: string | null }[] }>('/api/payments/kiosk/datafono/process', props);
    return data;
  } catch (error) {
    console.error("Error processing kiosk datafono order:", error);
    if (error instanceof Error) {
      return { error: "process_failed", message: error.message || "Failed to process datafono order" };
    }
    return { error: "network_error", message: "Error de conexión al procesar la orden" };
  }
}

/**
 * Kiosk mode: Polls for shipping guides (created in background after processDatafono)
 */
export async function kioskGetGuides(
  orderId: string
): Promise<{ orderId: string; ready: boolean; guides: { numero_guia: string; url_seguimiento: string; cod_bodega: string | null; nombre_tienda: string | null }[] } | null> {
  try {
    const data = await apiGet<{ orderId: string; ready: boolean; guides: { numero_guia: string; url_seguimiento: string; cod_bodega: string | null; nombre_tienda: string | null }[] }>(`/api/payments/kiosk/datafono/guides/${orderId}`);
    return data;
  } catch (error) {
    console.error("Error fetching kiosk guides:", error);
    return null;
  }
}

/**
 * Kiosk mode: Confirms physical payment - requests recogida for existing guides
 */
export async function kioskConfirmDatafonoPayment(
  orderId: string
): Promise<{ orderId: string; status: string; guides: any[] } | { error: string; message: string }> {
  try {
    const data = await apiPost<{ orderId: string; status: string; guides: any[] }>(`/api/payments/kiosk/datafono/confirm-payment/${orderId}`, {});
    return data;
  } catch (error) {
    console.error("Error confirming kiosk datafono payment:", error);
    if (error instanceof Error) {
      return { error: "confirm_failed", message: error.message || "Failed to confirm datafono payment" };
    }
    return { error: "network_error", message: "Error de conexión al confirmar el pago" };
  }
}

/**
 * Kiosk mode: Cancels datafono order - annuls shipping guides
 */
export async function kioskCancelDatafonoPayment(
  orderId: string
): Promise<{ orderId: string; status: string; serialId?: string } | { error: string; message: string }> {
  try {
    const data = await apiPost<{ orderId: string; status: string; serialId?: string }>(`/api/payments/kiosk/datafono/cancel-payment/${orderId}`, {});
    return data;
  } catch (error) {
    console.error("Error cancelling kiosk datafono payment:", error);
    if (error instanceof Error) {
      return { error: "cancel_failed", message: error.message || "Failed to cancel datafono payment" };
    }
    return { error: "network_error", message: "Error de conexión al cancelar la orden" };
  }
}

/**
 * Kiosk V2: webhook-driven datafono/tarjeta flow.
 * Creates the order, posts to Novasoft without guides/payment, returns
 * immediately. The kiosk frontend then waits for `order_approved` over the
 * /kiosk websocket — that event fires when WSiMagiQ posts a billing webhook
 * and the backend marks the order APPROVED + generates Coordinadora guides.
 */
export async function kioskProcessDatafonoV2(
  props: Record<string, any>
): Promise<
  | { orderId: string; serialId: string; novasoftPosted: boolean }
  | { error: string; message: string }
> {
  try {
    const data = await apiPost<{ orderId: string; serialId: string; novasoftPosted: boolean }>(
      '/api/payments/kiosk/datafono/v2/process',
      props,
    );
    return data;
  } catch (error) {
    console.error("Error processing V2 kiosk datafono order:", error);
    if (error instanceof Error) {
      return { error: "process_failed", message: error.message || "Failed to process V2 datafono order" };
    }
    return { error: "network_error", message: "Error de conexión al procesar la orden" };
  }
}

/**
 * Kiosk V2: cancel a pending V2 datafono order.
 * Marks the order CANCELLED. Guides typically don't exist yet so this is just
 * an UPDATE. If the billing webhook arrives after a cancel, the user's rule
 * "webhook gana" applies — see markBilledAndGenerateGuides on the backend.
 */
export async function kioskCancelDatafonoV2(
  orderId: string,
): Promise<{ orderId: string; status: string; serialId?: string } | { error: string; message: string }> {
  try {
    const data = await apiPost<{ orderId: string; status: string; serialId?: string }>(
      `/api/payments/kiosk/datafono/v2/cancel/${orderId}`,
      {},
    );
    return data;
  } catch (error) {
    console.error("Error cancelling V2 kiosk datafono order:", error);
    if (error instanceof Error) {
      return { error: "cancel_failed", message: error.message || "Failed to cancel V2 datafono order" };
    }
    return { error: "network_error", message: "Error de conexión al cancelar la orden" };
  }
}

export async function fetchBanks(): Promise<{ bankCode: string; bankName: string }[]> {
  try {
    const data = await apiGet<{ bankCode: string; bankName: string }[]>('/api/payments/epayco/banks');
    return data;
  } catch (error) {
    // Provide detailed error information for debugging
    if (error instanceof Error) {
      console.error('API error fetching banks:', {
        message: error.message,
        timestamp: new Date().toISOString(),
      });
    } else {
      console.error('Unknown error fetching banks:', {
        error,
        timestamp: new Date().toISOString(),
      });
    }
    throw error;
  }
}

/**
 * Check which cards are eligible for zero interest installments
 * Returns null on error to fail silently and not block the checkout flow
 */
export async function checkZeroInterest(
  request: CheckZeroInterestRequest
): Promise<CheckZeroInterestResponse | null> {
  try {
    const data = await apiPost<CheckZeroInterestResponse>('/api/payments/check-zero-interest', request);
    return data;
  } catch (error) {
    // Fail silently - don't block the checkout flow
    return null;
  }
}
