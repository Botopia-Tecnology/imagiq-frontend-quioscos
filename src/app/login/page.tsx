"use client";

import { useAuthContext } from "@/features/auth/context";
import { posthogUtils } from "@/lib/posthogClient";
import { Eye, EyeOff, ArrowLeft, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef, useCallback } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { notifyError, notifyLoginSuccess } from "./notifications";
import { apiPost } from "@/lib/api-client";
import { isAllowedEmailDomain, DOMAIN_ERROR_MESSAGE } from "@/utils/emailDomainValidation";

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
  requires_otp: boolean;
  access_token?: string;
  store?: KioskStorePublic;
  email?: string;
  otpLength?: number;
}

interface KioskOtpVerifyResponse {
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

  // OTP step
  const [otpStep, setOtpStep] = useState(false);
  const [otpEmail, setOtpEmail] = useState("");
  const [otpDigits, setOtpDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const [otpLength] = useState(6);
  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [resendCooldown, setResendCooldown] = useState(0);

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

  useEffect(() => {
    if (otpStep && otpInputRefs.current[0]) {
      otpInputRefs.current[0].focus();
    }
  }, [otpStep]);

  // Cooldown timer for resend
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const completeLogin = async (store: KioskStorePublic, access_token: string) => {
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
      role: 5,
    });

    await notifyLoginSuccess(store.descripcion);

    const params = new URLSearchParams(window.location.search);
    const redirect = params.get("redirect") || "/";
    setTimeout(() => {
      router.push(redirect);
    }, 500);
  };

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

      if (result.requires_otp) {
        // Necesita OTP
        setOtpEmail(result.email || formData.email.toLowerCase().trim());
        setOtpStep(true);
        setOtpDigits(["", "", "", "", "", ""]);
        setError("");
        setResendCooldown(60);
      } else {
        // Login directo
        if (!result.access_token || !result.store) {
          throw new Error("Respuesta de servidor inválida");
        }
        await completeLogin(result.store, result.access_token);
      }
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

  const verifyOtpCode = useCallback(async (code: string) => {
    if (isLoading) return;
    setError("");
    setIsLoading(true);

    try {
      const result = await apiPost<KioskOtpVerifyResponse>("/api/auth/kiosk/login-verify-otp", {
        email: otpEmail,
        codigo: code,
      });

      if (!result.access_token || !result.store) {
        throw new Error("Respuesta de servidor inválida");
      }

      await completeLogin(result.store, result.access_token);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error de conexión";
      setError(msg);
      // Reset digits on error
      setOtpDigits(["", "", "", "", "", ""]);
      setTimeout(() => otpInputRefs.current[0]?.focus(), 100);
    } finally {
      setIsLoading(false);
    }
  }, [otpEmail, isLoading]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const handleOtpDigitChange = (index: number, value: string) => {
    if (isLoading) return;
    const digit = value.replace(/\D/g, "").slice(-1);
    const newDigits = [...otpDigits];
    newDigits[index] = digit;
    setOtpDigits(newDigits);
    setError("");

    if (digit && index < otpLength - 1) {
      otpInputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all digits filled
    const fullCode = newDigits.join("");
    if (fullCode.length === otpLength && newDigits.every(d => d !== "")) {
      verifyOtpCode(fullCode);
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otpDigits[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, otpLength);
    if (!pasted) return;
    const newDigits = [...otpDigits];
    for (let i = 0; i < pasted.length; i++) {
      newDigits[i] = pasted[i];
    }
    setOtpDigits(newDigits);
    const nextFocus = Math.min(pasted.length, otpLength - 1);
    otpInputRefs.current[nextFocus]?.focus();

    if (pasted.length === otpLength) {
      verifyOtpCode(pasted);
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0 || isLoading) return;
    setIsLoading(true);
    setError("");
    try {
      await apiPost<KioskLoginResponse>("/api/auth/kiosk/login", {
        email: formData.email.toLowerCase().trim(),
        contrasena: formData.password,
      });
      setResendCooldown(60);
      setOtpDigits(["", "", "", "", "", ""]);
      otpInputRefs.current[0]?.focus();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error al reenviar código";
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToLogin = () => {
    setOtpStep(false);
    setOtpDigits(["", "", "", "", "", ""]);
    setError("");
    setResendCooldown(0);
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
            <CardTitle className="text-2xl font-bold">
              {otpStep ? "Verificación OTP" : "Iniciar sesión"}
            </CardTitle>
            <CardDescription>
              {otpStep
                ? `Ingresa el código enviado a ${otpEmail}`
                : "Ingresa tus credenciales corporativas para continuar"}
            </CardDescription>
          </CardHeader>

          <CardContent>
            {!otpStep ? (
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
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Verificando...
                    </>
                  ) : (
                    "Iniciar sesión"
                  )}
                </Button>
              </form>
            ) : (
              <div className="space-y-6">
                <div className="space-y-3">
                  <Label className="text-center block">Código de verificación</Label>
                  <div className="flex justify-center gap-3" onPaste={handleOtpPaste}>
                    {otpDigits.map((digit, i) => (
                      <input
                        key={i}
                        ref={(el) => { otpInputRefs.current[i] = el; }}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={digit}
                        onChange={(e) => handleOtpDigitChange(i, e.target.value)}
                        onKeyDown={(e) => handleOtpKeyDown(i, e)}
                        disabled={isLoading}
                        className="w-12 h-14 text-center text-2xl font-mono border-2 border-gray-200 rounded-lg focus:border-black focus:outline-none transition-colors disabled:opacity-50 disabled:bg-gray-50"
                        autoComplete="one-time-code"
                      />
                    ))}
                  </div>
                </div>

                {isLoading && (
                  <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Verificando...
                  </div>
                )}

                {error && (
                  <div className="text-sm text-red-600 text-center bg-red-50 py-2 px-4 rounded-lg">
                    {error}
                  </div>
                )}

                <div className="text-center">
                  <button
                    type="button"
                    onClick={handleResendOtp}
                    disabled={resendCooldown > 0 || isLoading}
                    className="text-sm text-gray-500 hover:text-black disabled:text-gray-300 transition-colors"
                  >
                    {resendCooldown > 0
                      ? `Reenviar código en ${resendCooldown}s`
                      : "Reenviar código"}
                  </button>
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleBackToLogin}
                  disabled={isLoading}
                  className="w-full"
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Volver al inicio de sesión
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
