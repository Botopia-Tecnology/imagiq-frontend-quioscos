"use client";

import useSecureStorage from "@/hooks/useSecureStorage";
import { User } from "@/types/user";
import { useRouter } from "next/navigation";
import Step1 from "../Step1";
import { Address } from "@/types/address";
import { addressesService } from "@/services/addresses.service";

// Función helper para obtener datos del localStorage de forma segura
function safeGetLocalStorage<T>(key: string, defaultValue: T): T {
  if (typeof window === "undefined") return defaultValue;
  try {
    const item = localStorage.getItem(key);
    if (!item) return defaultValue;
    return JSON.parse(item) as T;
  } catch (error) {
    console.error(`Error reading localStorage key "${key}":`, error);
    return defaultValue;
  }
}

export default function Step1Page() {
  const router = useRouter();
  const [loggedUser, _setLoggedUser] = useSecureStorage<User | null>(
    "imagiq_user",
    null
  );

  console.log("🚀 [STEP1 PAGE] Usuario logueado:", loggedUser);

  const handleNext = async () => {
    // Obtener el rol del usuario (compatibilidad con backend que usa 'rol' y frontend que usa 'role')
    const userRole = (loggedUser as any)?.role ?? (loggedUser as any)?.rol;
    
    // Si es kiosk (rol 5), limpiar datos de cliente anterior y enviar a step2
    const token = localStorage.getItem("imagiq_token");
    if (token && loggedUser?.email && userRole === 5) {
      localStorage.removeItem('kiosk_client_id');
      localStorage.removeItem('kiosk_client'); // legacy key cleanup
      localStorage.removeItem('checkout-address');
      localStorage.removeItem('imagiq_default_address');
      localStorage.removeItem('imagiq_candidate_stores_cache');
      localStorage.removeItem('checkout-billing-data');
      localStorage.removeItem('checkout-envio-imagiq');
      localStorage.removeItem('checkout-received-by-client');
      localStorage.removeItem('checkout-zero-interest');
      localStorage.removeItem('checkout-delivery-method');
      localStorage.removeItem('checkout-payment-method');
      console.log("🏪 [STEP1] Usuario kiosk (rol 5), limpiando datos de cliente anterior y yendo a step2");
      router.push("/carrito/step2");
      return;
    }

    // Si es usuario regular (tiene token y NO es invitado rol 3), ir directamente a step3
    if (token && loggedUser?.email && userRole !== 3) {
      console.log("✅ [STEP1] Usuario regular autenticado (rol !== 3), yendo directo a step3");
      router.push("/carrito/step3");
      return;
    }

    // Verificar si el usuario invitado tiene dirección
    if (loggedUser && userRole === 3) {
      // Primero verificar localStorage (más rápido)
      const savedAddress = safeGetLocalStorage<Address | null>(
        "checkout-address",
        null
      );
      
      if (savedAddress && savedAddress.id) {
        console.log("✅ [STEP1] Usuario invitado con dirección en localStorage, yendo a step3");
        router.push("/carrito/step3");
        return;
      }

      // Si no hay en localStorage, consultar API
      try {
        const addresses = await addressesService.getUserAddresses();
        if (addresses && addresses.length > 0) {
          console.log("✅ [STEP1] Usuario invitado tiene direcciones en la BD, yendo a step3");
          // Guardar la primera dirección en localStorage para uso futuro
          if (addresses[0]) {
            localStorage.setItem("checkout-address", JSON.stringify(addresses[0]));
          }
          router.push("/carrito/step3");
          return;
        }
      } catch (error) {
        console.error("❌ [STEP1] Error consultando direcciones:", error);
      }
      
      // Si es invitado sin dirección, ir a step2 para agregar dirección
      console.log("📍 [STEP1] Usuario invitado sin dirección, yendo a step2");
      router.push("/carrito/step2");
      return;
    }

    // Si NO está logueado, ir a step2 para registro como invitado
    console.log("📍 [STEP1] Usuario no logueado, yendo a step2 para registro");
    router.push("/carrito/step2");
  };

  return <Step1 onContinue={handleNext} />;
}
