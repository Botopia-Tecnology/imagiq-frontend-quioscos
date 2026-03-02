"use client";

import { ProfilePage as ProfilePageComponent } from "@/features/profile";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef, useCallback } from "react";
import { safeGetLocalStorage } from "@/lib/localStorage";
import { apiPost } from "@/lib/api-client";
import {
  Store, MapPin, Clock, Phone, Mail, Hash,
} from "lucide-react";
import { useAuthContext } from "@/features/auth/context";
import { Button } from "@/components/ui/button";

interface KioskStoreData {
  id: string;
  codigo: string;
  descripcion: string;
  departamento: string;
  ciudad: string;
  direccion: string;
  place_id: string;
  horario: string;
  telefono: string;
  extension: string;
  email: string;
  cod_bodega: string;
  cod_dane: string;
  latitud: string;
  longitud: string;
  rol: number;
  email_verificado: boolean;
  activo: boolean;
}

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY || "";

function StoreMap({ lat, lng, title }: { lat: number; lng: number; title: string }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);

  const initMap = useCallback(() => {
    if (!mapRef.current || !window.google?.maps) return;
    if (mapInstanceRef.current) return;

    const position = { lat, lng };
    const map = new window.google.maps.Map(mapRef.current, {
      center: position,
      zoom: 16,
      disableDefaultUI: true,
      zoomControl: true,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
    });

    new window.google.maps.Marker({ position, map, title });
    mapInstanceRef.current = map;
  }, [lat, lng, title]);

  useEffect(() => {
    if (window.google?.maps) {
      initMap();
      return;
    }

    const existingScript = document.querySelector('script[src*="maps.googleapis.com"]');
    if (existingScript) {
      existingScript.addEventListener("load", initMap);
      return;
    }

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}`;
    script.async = true;
    script.defer = true;
    script.onload = initMap;
    document.head.appendChild(script);
  }, [initMap]);

  return (
    <div
      ref={mapRef}
      className="w-full rounded-xl overflow-hidden border border-gray-200"
      style={{ height: 220 }}
    />
  );
}

function KioskProfilePage() {
  const router = useRouter();
  const { logout } = useAuthContext();
  const [storeData, setStoreData] = useState<KioskStoreData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchStoreData = async () => {
      try {
        const result = await apiPost<{ store: KioskStoreData }>(
          "/api/auth/kiosk/profile",
          {}
        );
        if (result.store) setStoreData(result.store);
      } catch (err) {
        console.error("Error fetching store data:", err);
        setError(err instanceof Error ? err.message : "Error al cargar los datos");
      } finally {
        setLoading(false);
      }
    };
    fetchStoreData();
  }, []);

  const hasCoordinates =
    storeData?.latitud &&
    storeData?.longitud &&
    !isNaN(parseFloat(storeData.latitud)) &&
    !isNaN(parseFloat(storeData.longitud));

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-black" />
      </div>
    );
  }

  if (!storeData) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4">
        <p className="text-gray-500">{error || "No se pudo cargar la información de la tienda"}</p>
        <Button variant="outline" onClick={() => router.push("/")}>Volver al inicio</Button>
      </div>
    );
  }

  return (
    <div className="bg-gray-50">
      {/* Banner */}
      <div className="bg-black text-white">
        <div className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center justify-center w-12 h-12 bg-white/10 rounded-xl">
              <Store className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold">{storeData.descripcion}</h1>
              <p className="text-white/60 text-sm">Código: {storeData.codigo} &middot; Bodega: {storeData.cod_bodega}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push("/")}
              className="text-sm text-white hover:text-white/80 transition-colors"
            >
              Ir al inicio
            </button>
            <button
              onClick={() => { logout(); router.push("/login"); }}
              className="text-sm text-red-400 hover:text-red-300 transition-colors"
            >
              Cerrar sesión
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-8">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h2 className="font-semibold text-gray-900 mb-5">Información de la tienda</h2>

            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="flex items-center justify-center w-9 h-9 bg-gray-100 rounded-lg shrink-0">
                  <MapPin className="h-4.5 w-4.5 text-gray-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Dirección</p>
                  <p className="text-sm font-medium text-gray-900">{storeData.direccion}</p>
                  <p className="text-xs text-gray-500">{storeData.ciudad}, {storeData.departamento}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="flex items-center justify-center w-9 h-9 bg-gray-100 rounded-lg shrink-0">
                  <Mail className="h-4.5 w-4.5 text-gray-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Correo</p>
                  <p className="text-sm font-medium text-gray-900">{storeData.email}</p>
                </div>
              </div>

              {storeData.telefono && (
                <div className="flex items-start gap-3">
                  <div className="flex items-center justify-center w-9 h-9 bg-gray-100 rounded-lg shrink-0">
                    <Phone className="h-4.5 w-4.5 text-gray-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Teléfono</p>
                    <p className="text-sm font-medium text-gray-900">
                      {storeData.telefono}{storeData.extension ? ` ext. ${storeData.extension}` : ""}
                    </p>
                  </div>
                </div>
              )}

              {storeData.horario && (
                <div className="flex items-start gap-3">
                  <div className="flex items-center justify-center w-9 h-9 bg-gray-100 rounded-lg shrink-0">
                    <Clock className="h-4.5 w-4.5 text-gray-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Horario</p>
                    <p className="text-sm font-medium text-gray-900">{storeData.horario}</p>
                  </div>
                </div>
              )}

              {storeData.cod_dane && (
                <div className="flex items-start gap-3">
                  <div className="flex items-center justify-center w-9 h-9 bg-gray-100 rounded-lg shrink-0">
                    <Hash className="h-4.5 w-4.5 text-gray-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Código DANE</p>
                    <p className="text-sm font-medium text-gray-900">{storeData.cod_dane}</p>
                  </div>
                </div>
              )}

              {/* Map */}
              {hasCoordinates && (
                <StoreMap
                  lat={parseFloat(storeData.latitud)}
                  lng={parseFloat(storeData.longitud)}
                  title={storeData.descripcion}
                />
              )}
            </div>
          </div>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const router = useRouter();
  const [isKiosk, setIsKiosk] = useState<boolean | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("imagiq_token");
    const user = safeGetLocalStorage<{ id?: string; role?: number; rol?: number }>("imagiq_user", {});

    if (!token || !user.id) {
      router.push("/login");
      return;
    }

    const userRole = user.role ?? user.rol;
    setIsKiosk(userRole === 5);
  }, [router]);

  if (isKiosk === null) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-black" />
      </div>
    );
  }

  if (isKiosk) {
    return <KioskProfilePage />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <ProfilePageComponent />
    </div>
  );
}
