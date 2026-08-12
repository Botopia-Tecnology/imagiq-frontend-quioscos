"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { addressesService } from "@/services/addresses.service";
import type { Address } from "@/types/address";
import { safeGetLocalStorage } from "@/lib/localStorage";
import type { FormattedStore } from "@/types/store";
import {
  productEndpoints,
  type CandidateStore,
  type CandidateStoresResponse,
  type ApiResponse,
} from "@/lib/api";
import { useCart } from "@/hooks/useCart";
import {
  buildGlobalCanPickUpKey,
  getFullCandidateStoresResponseFromCache,
  setGlobalCanPickUpCache,
  invalidateCacheOnAddressChange,
  clearGlobalCanPickUpCache,
} from "../utils/globalCanPickUpCache";
import { getUserId } from "../utils/getUserId";

/**
 * Normaliza texto removiendo acentos y convirtiendo a minúsculas
 * Esto permite buscar "Bogota" y encontrar "Bogotá"
 */
const normalizeText = (text: string): string => {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replaceAll(/[\u0300-\u036f]/g, ""); // Remueve diacríticos (acentos)
};

/**
 * Convierte CandidateStore a FormattedStore directamente desde el endpoint candidate-stores
 * NO valida con ningún otro endpoint, usa directamente los datos del endpoint
 */
const candidateStoreToFormattedStore = (
  candidateStore: CandidateStore,
  city: string
): FormattedStore => {
  // Convertir codDane a número
  let codDane: number;
  if (candidateStore.codDane) {
    if (typeof candidateStore.codDane === "string") {
      codDane = Number.parseInt(candidateStore.codDane, 10);
    } else {
      codDane = candidateStore.codDane;
    }
  } else {
    codDane = 0;
  }

  // Extraer código numérico del codBodega
  const codigo = Number.parseInt(candidateStore.codBodega.replaceAll(/\D/g, ''), 10) || 0;

  // Extraer teléfono y extensión si están disponibles
  const telefono = candidateStore.telefono || "";
  const extension = candidateStore.extension || "";

  // Crear FormattedStore directamente con los datos del endpoint
  return {
    codigo: codigo,
    descripcion: candidateStore.nombre_tienda.trim(),
    departamento: city,
    ciudad: city,
    direccion: candidateStore.direccion,
    place_ID: candidateStore.place_ID,
    ubicacion_cc: "",
    horario: candidateStore.horario,
    telefono: telefono,
    extension: extension,
    email: "",
    codBodega: candidateStore.codBodega,
    codDane: codDane,
    latitud: 0,
    longitud: 0,
    position: [0, 0],
    stock: candidateStore.stock,
  };
};

/**
 * Procesa la respuesta de candidate-stores y retorna los datos formateados.
 * Filtra centros de distribución y bodegas.
 */
function processStoresResponse(responseData: CandidateStoresResponse) {
  const globalCanPickUp = responseData.canPickUp;

  let physicalStores: FormattedStore[] = [];
  const cities: string[] = Object.keys(responseData.stores || {}).filter(city => {
    const cityStores = responseData.stores?.[city];
    return cityStores && cityStores.length > 0;
  });

  if (responseData.stores) {
    const allStoresInOrder: Array<{ store: CandidateStore; city: string }> = [];
    for (const [city, cityStores] of Object.entries(responseData.stores)) {
      if (cityStores && cityStores.length > 0) {
        for (const store of cityStores) {
          allStoresInOrder.push({ store, city });
        }
      }
    }

    if (allStoresInOrder.length > 0) {
      const validStores = allStoresInOrder.map(
        ({ store, city }) => candidateStoreToFormattedStore(store, city)
      );

      physicalStores = validStores.filter((store) => {
        const descripcion = normalizeText(store.descripcion);
        const codigo = store.codigo?.toString().trim() || "";
        return !descripcion.includes("centro de distribucion") &&
          !descripcion.includes("centro distribucion") &&
          !descripcion.includes("bodega") &&
          codigo !== "001";
      });
    }
  }

  return { globalCanPickUp, physicalStores, cities };
}

/**
 * Helper para leer datos de tiendas del caché de forma sincrónica.
 * Se usa para inicializar estados.
 */
interface CacheStoresData {
  stores: FormattedStore[];
  filteredStores: FormattedStore[];
  availableCities: string[];
  availableStoresWhenCanPickUpFalse: FormattedStore[];
  canPickUp: boolean;
}

function getInitialStoresFromCache(): CacheStoresData | null {
  if (typeof window === 'undefined') return null;

  try {
    // Usar getUserId que prioriza kiosk_client_id
    const userId = getUserId() ?? undefined;

    if (!userId) return null;

    let addressId: string | null = null;
    let savedAddress = localStorage.getItem("checkout-address");
    if (!savedAddress || savedAddress === "null" || savedAddress === "undefined") {
      savedAddress = localStorage.getItem("imagiq_default_address");
    }
    if (savedAddress && savedAddress !== "undefined" && savedAddress !== "null") {
      const parsed = JSON.parse(savedAddress);
      if (parsed?.id) addressId = parsed.id;
    }

    const cartData = localStorage.getItem("imagiq_cart");
    if (!cartData) return null;

    const cart = JSON.parse(cartData);
    const products = cart.products || [];
    if (products.length === 0) return null;

    const productsToCheck = products.map((p: { sku: string; skuPostback?: string; quantity: number }) => ({
      sku: p.skuPostback || p.sku,
      quantity: p.quantity,
    }));

    const cacheKey = buildGlobalCanPickUpKey({ userId, products: productsToCheck, addressId });
    const cachedResponse = getFullCandidateStoresResponseFromCache(cacheKey);
    if (!cachedResponse) return null;

    const { globalCanPickUp, physicalStores, cities } = processStoresResponse(cachedResponse);

    const firstCity = cities.length > 0 ? cities[0] : null;
    const storesToShow = globalCanPickUp
      ? (firstCity ? physicalStores.filter(store => store.ciudad === firstCity) : physicalStores)
      : [];

    return {
      stores: storesToShow,
      filteredStores: [...storesToShow],
      availableCities: cities,
      availableStoresWhenCanPickUpFalse: globalCanPickUp ? storesToShow : physicalStores,
      canPickUp: globalCanPickUp,
    };
  } catch (error) {
    console.error('[getInitialStoresFromCache] Error:', error);
    return null;
  }
}

export const useDelivery = (options?: { kioskMode?: boolean }) => {
  const kioskMode = options?.kioskMode ?? false;
  const { products } = useCart();

  // Inicializar estados desde caché si hay datos disponibles
  const initialCacheData = getInitialStoresFromCache();

  const [address, setAddress] = useState<Address | null>(null);
  const [addressEdit, setAddressEdit] = useState(false);
  const [storeEdit, setStoreEdit] = useState(false);
  const [storeQuery, setStoreQuery] = useState("");
  const [stores, setStores] = useState<FormattedStore[]>(() => initialCacheData?.stores ?? []);
  const [filteredStores, setFilteredStores] = useState<FormattedStore[]>(() => initialCacheData?.filteredStores ?? []);
  const [selectedStore, setSelectedStore] = useState<FormattedStore | null>(null);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [canPickUp, setCanPickUp] = useState<boolean | undefined>(() => initialCacheData?.canPickUp ?? true);
  const [addressLoading, setAddressLoading] = useState(false);
  const [availableCities, setAvailableCities] = useState<string[]>(() => initialCacheData?.availableCities ?? []);
  const [availableStoresWhenCanPickUpFalse, setAvailableStoresWhenCanPickUpFalse] = useState<FormattedStore[]>(() => initialCacheData?.availableStoresWhenCanPickUpFalse ?? []);
  const [lastResponse, setLastResponse] = useState<ApiResponse<CandidateStoresResponse> | null>(null);
  const [storesLoading, setStoresLoading] = useState(false);

  // Refs mínimos necesarios
  const lastFetchRequestIdRef = useRef(0);
  const fetchCandidateStoresRef = useRef<((explicitAddressId?: string) => Promise<void>) | null>(null);
  const lastAddressIdRef = useRef<string | null>(null);
  const lastAddressForStoreSelectionRef = useRef<string | null>(null);
  const productsRef = useRef(products);

  useEffect(() => {
    productsRef.current = products;
  }, [products]);

  // Cargar método de entrega desde localStorage al inicio
  const [deliveryMethod, setDeliveryMethodState] = useState<string>(() => {
    if (globalThis.window === undefined) return "domicilio";
    return globalThis.window.localStorage.getItem("checkout-delivery-method") || "domicilio";
  });

  // Wrapper para setDeliveryMethod que también guarda en localStorage
  const setDeliveryMethod = useCallback((method: string) => {
    if (method !== "tienda" && method !== "domicilio") {
      console.error(`⚠️ Método de entrega inválido: ${method}. Usando "domicilio" por defecto.`);
      method = "domicilio";
    }

    setDeliveryMethodState(method);

    if (typeof globalThis.window !== "undefined") {
      try {
        globalThis.window.localStorage.setItem("checkout-delivery-method", method);
        globalThis.window.dispatchEvent(
          new CustomEvent("delivery-method-changed", { detail: { method } })
        );
        globalThis.window.dispatchEvent(new Event("storage"));
      } catch (error) {
        console.error("Error al guardar método de entrega en localStorage:", error);
      }
    }
  }, []);

  // Sincronizar método de entrega desde localStorage
  useEffect(() => {
    if (globalThis.window === undefined) return;

    const updateFromStorage = () => {
      const savedMethod = globalThis.window.localStorage.getItem("checkout-delivery-method");
      if (savedMethod && (savedMethod === "tienda" || savedMethod === "domicilio")) {
        setDeliveryMethodState((current) => current !== savedMethod ? savedMethod : current);
      }
    };

    updateFromStorage();

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "checkout-delivery-method") updateFromStorage();
    };
    const handleDeliveryMethodChanged = () => updateFromStorage();

    globalThis.window.addEventListener("storage", handleStorageChange);
    globalThis.window.addEventListener("delivery-method-changed", handleDeliveryMethodChanged);

    return () => {
      globalThis.window?.removeEventListener("storage", handleStorageChange);
      globalThis.window?.removeEventListener("delivery-method-changed", handleDeliveryMethodChanged);
    };
  }, []);

  /**
   * Helper para aplicar los datos de tiendas al estado
   */
  const applyStoreState = useCallback((globalCanPickUp: boolean, physicalStores: FormattedStore[], cities: string[]) => {
    setCanPickUp(globalCanPickUp);
    setAvailableCities(cities);

    if (globalCanPickUp) {
      const firstCity = cities.length > 0 ? cities[0] : null;
      const storesToShow = firstCity
        ? physicalStores.filter(store => store.ciudad === firstCity)
        : physicalStores;
      setStores(storesToShow);
      setFilteredStores([...storesToShow]);
      setAvailableStoresWhenCanPickUpFalse(storesToShow);
    } else {
      setAvailableStoresWhenCanPickUpFalse(physicalStores);
      setStores([]);
      setFilteredStores([]);
    }
  }, []);

  /**
   * fetchCandidateStores - Llama al endpoint candidate-stores limpio, sin restricciones.
   * Se puede llamar manualmente desde cualquier lugar.
   */
  const fetchCandidateStores = useCallback(async (explicitAddressId?: string) => {
    const thisRequestId = ++lastFetchRequestIdRef.current;

    // Obtener userId
    let userId: string | null = null;
    try {
      const { getUserId } = await import('@/app/carrito/utils/getUserId');
      userId = getUserId();
    } catch {
      // fallback below
    }

    if (!userId) {
      const user = safeGetLocalStorage<{ id?: string; user_id?: string }>("imagiq_user", {});
      userId = user?.id || user?.user_id || null;
    }

    // Fallback: intentar obtener userId de las direcciones guardadas
    if (!userId) {
      try {
        const savedAddress = globalThis.window?.localStorage.getItem("checkout-address");
        if (savedAddress) {
          const parsed = JSON.parse(savedAddress);
          if (parsed.usuario_id) userId = parsed.usuario_id;
        }
        if (!userId) {
          const defaultAddress = globalThis.window?.localStorage.getItem("imagiq_default_address");
          if (defaultAddress) {
            const parsed = JSON.parse(defaultAddress);
            if (parsed.usuario_id) userId = parsed.usuario_id;
          }
        }
      } catch (e) {
        console.error('Error recuperando user_id de direcciones:', e);
      }
    }

    if (!userId || products.length === 0) {
      setStores([]);
      setFilteredStores([]);
      setCanPickUp(false);
      setStoresLoading(false);
      return;
    }

    const productsToCheck = products.map((p) => ({
      sku: p.sku,
      quantity: p.quantity,
    }));

    // Obtener dirección actual
    let currentAddressId = explicitAddressId || '';
    if (!explicitAddressId) {
      try {
        let savedAddress = globalThis.window?.localStorage.getItem("checkout-address");
        // Kiosk: no usar imagiq_default_address como fallback (viene de BD)
        if (!kioskMode && (!savedAddress || savedAddress === 'null' || savedAddress === 'undefined')) {
          savedAddress = globalThis.window?.localStorage.getItem("imagiq_default_address") || null;
        }
        if (savedAddress && savedAddress !== 'null' && savedAddress !== 'undefined') {
          const parsed = JSON.parse(savedAddress) as Address;
          if (parsed.id) {
            currentAddressId = parsed.id;
            lastAddressIdRef.current = parsed.id;
          }
        }
      } catch (error) {
        console.error('Error al leer dirección:', error);
      }
    } else {
      lastAddressIdRef.current = explicitAddressId;
    }

    // Verificar caché primero
    const cacheKey = buildGlobalCanPickUpKey({
      userId,
      products: productsToCheck,
      addressId: currentAddressId || null,
    });

    const cachedResponse = getFullCandidateStoresResponseFromCache(cacheKey);
    if (cachedResponse && thisRequestId === lastFetchRequestIdRef.current) {
      const { globalCanPickUp, physicalStores, cities } = processStoresResponse(cachedResponse);
      applyStoreState(globalCanPickUp, physicalStores, cities);
      setStoresLoading(false);
      setLastResponse({ success: true, data: cachedResponse });

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('canPickUpCache-updated', {
          detail: { key: cacheKey, value: globalCanPickUp, addressId: currentAddressId }
        }));
      }
      return;
    }

    // Llamar al endpoint
    try {
      setStoresLoading(true);

      const response = await productEndpoints.getCandidateStores({
        products: productsToCheck,
        user_id: userId,
        addressId: currentAddressId || undefined,
      });

      setLastResponse(response);

      if (thisRequestId !== lastFetchRequestIdRef.current) return;

      if (response.success && response.data) {
        const { globalCanPickUp, physicalStores, cities } = processStoresResponse(response.data);
        applyStoreState(globalCanPickUp, physicalStores, cities);
        setGlobalCanPickUpCache(cacheKey, globalCanPickUp, response.data, currentAddressId);
      } else {
        setCanPickUp(false);
        setStores([]);
        setFilteredStores([]);
        setAvailableStoresWhenCanPickUpFalse([]);

        // CRÍTICO: Escribir caché de error también en fallos.
        // ApiClient nunca lanza (convierte 400/500/red en {success:false}), así que sin
        // esta escritura el guard de step3 (checkCandidateStoresCache) no encontraba la
        // clave y rebotaba a step1 en bucle hasta limpiar localStorage. Con esta entrada
        // el guard pasa y el checkout continúa con canPickUp=false (solo domicilio).
        console.error(`[useDelivery] candidate-stores falló (${response.message || 'sin mensaje'}); cacheando canPickUp=false`);
        setGlobalCanPickUpCache(cacheKey, false, {
          canPickUp: false,
          stores: {},
          success: false,
          hasData: false,
          message: response.message || 'candidate-stores request failed',
          default_direction: null
        } as unknown as CandidateStoresResponse, currentAddressId);
      }
    } catch (error) {
      console.error('❌ [fetchCandidateStores] Error:', error);
      if (thisRequestId === lastFetchRequestIdRef.current) {
        setStores([]);
        setFilteredStores([]);
        setAvailableStoresWhenCanPickUpFalse([]);
        setCanPickUp(false);
      }
    } finally {
      if (thisRequestId === lastFetchRequestIdRef.current) {
        setStoresLoading(false);
      }
    }
  }, [products, applyStoreState]);

  // Mantener ref actualizado
  useEffect(() => {
    fetchCandidateStoresRef.current = fetchCandidateStores;
  }, [fetchCandidateStores]);

  // Escuchar cambios de dirección (desde header)
  useEffect(() => {
    if (globalThis.window === undefined) return;

    const handleAddressChange = async (event: Event) => {
      const customEvent = event as CustomEvent;
      const isFromHeader = customEvent.detail?.fromHeader === true;

      if (isFromHeader) {
        setAddressLoading(true);
        try {
          const saved = JSON.parse(
            globalThis.window.localStorage.getItem("checkout-address") || "{}"
          ) as Address;
          if (saved?.id) {
            setAddress(saved);
            lastAddressIdRef.current = saved.id;
          }
        } catch {
          // Error silencioso
        } finally {
          setAddressLoading(false);
        }
      }

      // Extraer ID de dirección del evento
      let newAddressId: string | null = null;
      if (customEvent.detail) {
        if (customEvent.detail.id && typeof customEvent.detail.id === 'string') {
          newAddressId = customEvent.detail.id;
        } else if (customEvent.detail.address?.id) {
          newAddressId = customEvent.detail.address.id;
        }
      }

      // Si no se pudo extraer del evento, leer de localStorage
      if (!newAddressId) {
        try {
          const currentAddress = localStorage.getItem('checkout-address');
          if (currentAddress) {
            const parsed = JSON.parse(currentAddress) as Address;
            newAddressId = parsed.id || null;
          }
        } catch {
          return;
        }
      }

      // Si la dirección no cambió, no hacer nada
      if (!newAddressId || newAddressId === lastAddressIdRef.current) return;

      lastAddressIdRef.current = newAddressId;
      setSelectedStore(null);
      if (globalThis.window) {
        globalThis.window.localStorage.removeItem("checkout-store");
        globalThis.window.localStorage.removeItem("checkout-store-address-id");
      }
      lastAddressForStoreSelectionRef.current = null;

      // Invalidar caché y recalcular
      clearGlobalCanPickUpCache();
      invalidateCacheOnAddressChange(newAddressId);
      fetchCandidateStoresRef.current?.(newAddressId);
    };

    globalThis.window.addEventListener('address-changed', handleAddressChange as EventListener);

    return () => {
      globalThis.window?.removeEventListener('address-changed', handleAddressChange as EventListener);
    };
  }, []);

  // Cargar direcciones del usuario (skip en kiosk - el asesor siempre agrega nueva).
  // Un invitado (rol 3) tampoco debe ver las direcciones guardadas de la cuenta.
  useEffect(() => {
    if (kioskMode) return;
    const userInfo = safeGetLocalStorage<{ id?: string; email?: string; rol?: number; role?: number }>("imagiq_user", {});
    const rol = typeof userInfo?.rol === "number" ? userInfo.rol : (typeof userInfo?.role === "number" ? userInfo.role : null);
    if (rol === 2 && userInfo && (userInfo.id || userInfo.email)) {
      addressesService
        .getUserAddresses()
        .then((addresses: Address[]) => setAddresses(addresses))
        .catch((error) => {
          console.error("Error loading addresses:", error);
          setAddresses([]);
        });
    } else {
      setAddresses([]);
    }
  }, [kioskMode]);

  // Filtrar tiendas según búsqueda
  useEffect(() => {
    if (storeQuery.trim() === "") {
      setFilteredStores(stores);
    } else {
      const normalizedQuery = normalizeText(storeQuery);
      setFilteredStores(
        stores.filter(
          (s) =>
            normalizeText(s.descripcion).includes(normalizedQuery) ||
            normalizeText(s.direccion).includes(normalizedQuery) ||
            normalizeText(s.ciudad).includes(normalizedQuery) ||
            normalizeText(s.departamento).includes(normalizedQuery) ||
            (s.ubicacion_cc && normalizeText(s.ubicacion_cc).includes(normalizedQuery))
        )
      );
    }
  }, [storeQuery, stores]);

  // Autocompletar dirección si está guardada
  useEffect(() => {
    if (deliveryMethod === "domicilio" && globalThis.window !== undefined) {
      const savedAddress = globalThis.window.localStorage.getItem("checkout-address");
      if (savedAddress && savedAddress !== "undefined") {
        try {
          const saved = JSON.parse(savedAddress) as Address;
          if (saved.id) {
            // Kiosk: solo cargar desde cache, sin enriquecer ni guardar en imagiq_default_address
            if (kioskMode) {
              setAddress(saved);
              lastAddressIdRef.current = saved.id;
              return;
            }

            const needsEnrichment = !saved.localidad && !saved.barrio && !saved.complemento;

            if (needsEnrichment && addresses.length > 0) {
              const completeAddress = addresses.find(a => a.id === saved.id);
              if (completeAddress) {
                setAddress(completeAddress);
                lastAddressIdRef.current = completeAddress.id;

                const enrichedAddress = {
                  ...saved,
                  localidad: completeAddress.localidad || '',
                  barrio: completeAddress.barrio || '',
                  complemento: completeAddress.complemento || '',
                  instruccionesEntrega: completeAddress.instruccionesEntrega || '',
                  direccionFormateada: completeAddress.direccionFormateada || saved.lineaUno || '',
                  tipoDireccion: completeAddress.tipoDireccion || '',
                  nombreDireccion: completeAddress.nombreDireccion || '',
                  latitud: completeAddress.latitud || 0,
                  longitud: completeAddress.longitud || 0,
                  googleUrl: completeAddress.googleUrl || '',
                  googlePlaceId: completeAddress.googlePlaceId || '',
                };
                globalThis.window.localStorage.setItem('checkout-address', JSON.stringify(enrichedAddress));
                globalThis.window.localStorage.setItem('imagiq_default_address', JSON.stringify(enrichedAddress));
              } else {
                setAddress(saved);
                lastAddressIdRef.current = saved.id;
              }
            } else {
              setAddress(saved);
              lastAddressIdRef.current = saved.id;
            }
          }
        } catch (error) {
          console.error("Error parsing saved address:", error);
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deliveryMethod, addresses]);

  // Cargar tienda seleccionada desde localStorage o seleccionar la primera por defecto
  useEffect(() => {
    if (globalThis.window !== undefined && stores.length > 0) {
      const savedStore = globalThis.window.localStorage.getItem("checkout-store");
      const savedAddressId = globalThis.window.localStorage.getItem("checkout-store-address-id");
      const currentAddressId = lastAddressIdRef.current;

      let restored = false;

      if (savedStore && savedAddressId === currentAddressId && currentAddressId !== null) {
        try {
          const parsed = JSON.parse(savedStore) as FormattedStore;
          const foundStore = stores.find((s) => s.codigo === parsed.codigo);

          if (foundStore) {
            if (selectedStore?.codigo !== foundStore.codigo) {
              setSelectedStore(foundStore);
            }
            lastAddressForStoreSelectionRef.current = currentAddressId;
            restored = true;
          }
        } catch (error) {
          console.error("Error parsing saved store:", error);
        }
      }

      if (!restored && savedAddressId !== currentAddressId && currentAddressId !== null) {
        if (globalThis.window) {
          globalThis.window.localStorage.removeItem("checkout-store");
          globalThis.window.localStorage.removeItem("checkout-store-address-id");
        }
      }

      if (deliveryMethod === 'tienda') {
        const isCurrentStoreValid = selectedStore && stores.some(s => s.codigo === selectedStore.codigo);

        if (!restored && !isCurrentStoreValid) {
          const firstStore = stores[0];
          setSelectedStore(firstStore);

          if (globalThis.window) {
            globalThis.window.localStorage.setItem("checkout-store", JSON.stringify(firstStore));
            if (currentAddressId) {
              globalThis.window.localStorage.setItem("checkout-store-address-id", currentAddressId);
            }
          }

          if (currentAddressId) {
            lastAddressForStoreSelectionRef.current = currentAddressId;
          }
        }
      }
    }
  }, [stores, selectedStore, deliveryMethod]);

  // Validar si se puede continuar
  const canContinue =
    (deliveryMethod === "domicilio" && address !== null) ||
    (deliveryMethod === "tienda" && selectedStore !== null);

  // Función para refrescar direcciones después de agregar una nueva
  const addAddress = async (newAddress?: Address): Promise<void> => {
    try {
      // Invitado (rol 3): NO traer las direcciones guardadas de la cuenta; solo la nueva.
      const userInfo = safeGetLocalStorage<{ rol?: number; role?: number }>("imagiq_user", {});
      const rol = typeof userInfo?.rol === "number" ? userInfo.rol : (typeof userInfo?.role === "number" ? userInfo.role : null);
      let fetchedAddresses: Address[] = rol === 2 ? await addressesService.getUserAddresses() : [];

      if (newAddress && newAddress.id) {
        const found = fetchedAddresses.find(a => a.id === newAddress.id);
        if (!found) {
          fetchedAddresses = [newAddress, ...fetchedAddresses];
        }

        if (newAddress.esPredeterminada) {
          fetchedAddresses = fetchedAddresses.map(a => ({
            ...a,
            esPredeterminada: a.id === newAddress.id
          }));
        }
      }

      setAddresses(fetchedAddresses);

      if (newAddress) {
        setAddress(newAddress);

        if (newAddress.id) {
          lastAddressIdRef.current = newAddress.id;
          invalidateCacheOnAddressChange(newAddress.id);
        }

        // Recalcular candidate stores con la nueva dirección
        fetchCandidateStoresRef.current?.(newAddress.id);
      }
    } catch (error) {
      console.error("Error refreshing addresses:", error);
      if (newAddress) {
        setAddresses(prev => {
          if (prev.some(a => a.id === newAddress.id)) return prev;
          return [newAddress, ...prev];
        });
        setAddress(newAddress);
      } else {
        setAddresses([]);
      }
    }
  };

  // Función para forzar recarga de tiendas
  const forceRefreshStores = useCallback(() => {
    fetchCandidateStores();
  }, [fetchCandidateStores]);

  return {
    address,
    setAddress,
    addressEdit,
    setAddressEdit,
    storeEdit,
    setStoreEdit,
    storeQuery,
    setStoreQuery,
    filteredStores,
    selectedStore,
    setSelectedStore,
    addresses,
    setAddresses,
    addAddress,
    deliveryMethod,
    setDeliveryMethod,
    canContinue,
    storesLoading,
    canPickUp,
    stores,
    refreshStores: fetchCandidateStores,
    forceRefreshStores,
    addressLoading,
    availableCities,
    availableStoresWhenCanPickUpFalse,
    lastResponse,
  };
};
