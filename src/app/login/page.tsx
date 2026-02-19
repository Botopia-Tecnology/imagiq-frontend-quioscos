"use client";

import { useAuthContext } from "@/features/auth/context";
import { posthogUtils } from "@/lib/posthogClient";
import { Eye, EyeOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { notifyError, notifyLoginSuccess } from "./notifications";
import { apiPost } from "@/lib/api-client";
import { isAllowedEmailDomain, DOMAIN_ERROR_MESSAGE } from "@/utils/emailDomainValidation";
import Link from "next/link";

interface KioskStorePublic {
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
  email_verificado: boolean;
  activo: boolean;
}

interface KioskLoginResponse {
  access_token: string;
  store: KioskStorePublic;
}

export default function LoginPage() {
  const router = useRouter();
  const { login, isAuthenticated } = useAuthContext();

  const [formData, setFormData] = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const redirect = params.get("redirect");
      if (redirect === "/login/create-account") {
        setTimeout(() => router.replace("/login/create-account"), 0);
      }
    }
  }, [router]);

  // Verificar si es usuario invitado (rol 3)
  const userRole = (() => {
    if (typeof window === "undefined") return null;
    try {
      const userStr = localStorage.getItem("imagiq_user");
      if (userStr && userStr !== "null" && userStr !== "undefined") {
        const user = JSON.parse(userStr);
        return user?.role ?? user?.rol ?? null;
      }
    } catch {
      return null;
    }
    return null;
  })();

  if (isAuthenticated && userRole !== 3) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center space-y-6">
          <h1 className="text-2xl font-bold text-gray-900">
            Ya iniciaste sesión
          </h1>
          <p className="text-sm text-gray-600">
            Si deseas acceder a tu panel, haz clic en el botón.
          </p>
          <Button onClick={() => router.push("/")} className="w-full">
            Ir al inicio
          </Button>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!formData.email || !formData.password) {
      setError("Por favor completa todos los campos");
      return;
    }

    if (!isAllowedEmailDomain(formData.email)) {
      setError(DOMAIN_ERROR_MESSAGE);
      return;
    }

    setIsLoading(true);

    try {
      const result = await apiPost<KioskLoginResponse>("/api/auth/kiosk/login", {
        email: formData.email.toLowerCase().trim(),
        contrasena: formData.password,
      });

      if (!result.access_token || !result.store) {
        throw new Error("Respuesta de servidor inválida");
      }

      const { store, access_token } = result;

      posthogUtils.capture("kiosk_login_success", {
        store_id: store.id,
        store_codigo: store.codigo,
      });

      localStorage.setItem("imagiq_token", access_token);
      document.cookie = `imagiq_token=1; path=/; max-age=${60 * 60 * 24}; SameSite=Lax`;

      await login({
        id: store.id,
        email: store.email,
        nombre: store.descripcion,
        apellido: "",
        numero_documento: "",
        telefono: store.telefono,
        role: 5, // Rol 5 = kiosk store
      });

      await notifyLoginSuccess(store.descripcion);

      const params = new URLSearchParams(window.location.search);
      const redirect = params.get("redirect") || "/";
      setTimeout(() => {
        router.push(redirect);
      }, 500);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error de conexión";
      setError(msg);
      await notifyError(msg, "Login fallido");
      posthogUtils.capture("kiosk_login_error", {
        email: formData.email,
        error: msg,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* Panel izquierdo - Branding (solo desktop) */}
      <div className="hidden lg:flex lg:w-1/2 bg-black text-white items-center justify-center">
        <h1 className="text-5xl font-bold tracking-tight">Samsung Store</h1>
      </div>

      {/* Panel derecho - Formulario */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-8">
        <Card className="w-full max-w-md border-none shadow-none">
          <CardHeader className="text-center space-y-2">
            {/* Logo en mobile */}
            <div className="lg:hidden flex justify-center mb-2">
              <Image
                src="/frame_black.png"
                alt="ImagiQ"
                width={48}
                height={48}
                priority
              />
            </div>
            <CardTitle className="text-2xl font-bold">Iniciar sesión</CardTitle>
            <CardDescription>
              Ingresa tus credenciales corporativas para continuar
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Correo electrónico</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="tu@imagiq.com"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  disabled={isLoading}
                  autoComplete="username"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Contraseña</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={formData.password}
                    onChange={(e) =>
                      setFormData({ ...formData, password: e.target.value })
                    }
                    disabled={isLoading}
                    autoComplete="current-password"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                    disabled={isLoading}
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {error && (
                <div className="text-sm text-red-600 text-center bg-red-50 py-2 px-4 rounded-lg">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full bg-black text-white hover:bg-gray-800"
              >
                {isLoading ? "Verificando..." : "Iniciar sesión"}
              </Button>
            </form>
          </CardContent>

          <CardFooter className="flex flex-col gap-4">
            <div className="flex items-center justify-center gap-4 w-full text-sm">
              <Link
                href="/login/create-account"
                className="text-gray-600 hover:text-gray-900 underline"
              >
                Crear cuenta
              </Link>
              <Link
                href="/login/forgot-password"
                className="text-gray-600 hover:text-gray-900 underline"
              >
                ¿Olvidaste tu contraseña?
              </Link>
            </div>
            <p className="text-center text-xs text-gray-500">
              Solo disponible para correos @botopia.tech, @imagiq.com o @imagiq.co
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
