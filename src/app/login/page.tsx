"use client";

import { useAuthContext } from "@/features/auth/context";
import { posthogUtils } from "@/lib/posthogClient";
import { Cart, Usuario } from "@/types/user";
import { Eye, EyeOff, ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
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
import { apiGet, apiPost } from "@/lib/api-client";
import { isAllowedEmailDomain, DOMAIN_ERROR_MESSAGE } from "@/utils/emailDomainValidation";
import Link from "next/link";

interface LoginSuccessResponse {
  access_token?: string;
  user?: Omit<Usuario, "contrasena" | "tipo_documento">;
  telefono_verificado?: boolean;
  email_verificado?: boolean;
  requiresVerification?: boolean;
  userId?: string;
  email?: string;
  telefono?: string;
  nombre?: string;
  apellido?: string;
  numero_documento?: string;
  skus?: string[] | { sku: string }[];
  defaultAddress?: {
    id: string;
    nombreDireccion: string;
    direccionFormateada: string;
    ciudad?: string;
    departamento?: string;
    esPredeterminada: boolean;
  } | null;
}

interface OtpVerifyResponse {
  access_token: string;
  user: Omit<Usuario, "contrasena" | "tipo_documento">;
  skus?: string[] | { sku: string }[];
  defaultAddress?: {
    id: string;
    nombreDireccion: string;
    direccionFormateada: string;
    ciudad?: string;
    departamento?: string;
    esPredeterminada: boolean;
  } | null;
}

type LoginStep = "credentials" | "otp";

const OTP_RESEND_COOLDOWN = 60;

export default function LoginPage() {
  const router = useRouter();
  const { login, isAuthenticated } = useAuthContext();

  const [formData, setFormData] = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  // OTP step state
  const [loginStep, setLoginStep] = useState<LoginStep>("credentials");
  const [otpCode, setOtpCode] = useState(["", "", "", "", "", ""]);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [isResending, setIsResending] = useState(false);
  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const redirect = params.get("redirect");
      if (redirect === "/login/create-account") {
        setTimeout(() => router.replace("/login/create-account"), 0);
      }
    }
  }, [router]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Auto-focus first OTP input when entering OTP step
  useEffect(() => {
    if (loginStep === "otp") {
      setTimeout(() => otpInputRefs.current[0]?.focus(), 100);
    }
  }, [loginStep]);

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

  const sendOtp = async (email: string) => {
    await apiPost("/api/auth/otp/send-login", {
      email,
      metodo: "email",
    });
  };

  // Step 1: Validate credentials and send OTP
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
      const result = await apiPost<LoginSuccessResponse>("/api/auth/login", {
        email: formData.email,
        contrasena: formData.password,
      });

      if (result.requiresVerification) {
        sessionStorage.setItem(
          "pending_registration_step2",
          JSON.stringify({
            userId: result.userId,
            email: result.email,
            nombre: result.nombre,
            apellido: result.apellido,
            telefono: result.telefono,
            numero_documento: result.numero_documento,
            fromLogin: true,
          })
        );

        posthogUtils.capture("login_requires_verification", {
          user_id: result.userId,
          user_email: result.email,
        });

        router.push("/login/create-account");
        return;
      }

      // Credentials valid — send OTP
      await sendOtp(formData.email);

      posthogUtils.capture("login_otp_sent", {
        email: formData.email,
      });

      setResendCooldown(OTP_RESEND_COOLDOWN);
      setLoginStep("otp");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error de conexión";
      setError(msg);
      await notifyError(msg, "Login fallido");
      posthogUtils.capture("login_error", {
        email: formData.email,
        error: msg,
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2: Verify OTP and complete login
  const handleOtpVerify = async () => {
    const code = otpCode.join("");
    if (code.length !== 6) return;

    setError("");
    setIsLoading(true);

    try {
      const result = await apiPost<OtpVerifyResponse>("/api/auth/otp/verify-login", {
        email: formData.email,
        codigo: code,
      });

      if (!result.access_token || !result.user) {
        throw new Error("Respuesta de servidor inválida");
      }

      const { user, access_token, skus, defaultAddress } = result;

      posthogUtils.capture("login_success", {
        user_id: user.id,
        user_role: user.rol,
      });

      if (skus && Array.isArray(skus)) {
        const skuStrings = skus.map((item) =>
          typeof item === "string" ? item : item.sku
        );
        localStorage.setItem("imagiq_favorites", JSON.stringify(skuStrings));
      }

      localStorage.setItem("imagiq_token", access_token);
      document.cookie = `imagiq_token=1; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax`;

      await login({
        id: user.id,
        email: user.email,
        nombre: user.nombre,
        apellido: user.apellido,
        numero_documento: user.numero_documento,
        telefono: user.telefono,
        role: user.rol,
        defaultAddress: defaultAddress || null,
      });

      await notifyLoginSuccess(user.nombre);

      const cartItems = await apiGet<Cart>("/api/cart");
      if (cartItems) {
        localStorage.setItem("cart-items", JSON.stringify(cartItems.items));
      }

      const params = new URLSearchParams(window.location.search);
      const redirect = params.get("redirect") || "/";
      setTimeout(() => {
        router.push(redirect);
      }, 500);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error de conexión";
      setError(msg);
      posthogUtils.capture("login_otp_error", {
        email: formData.email,
        error: msg,
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Resend OTP
  const handleResendOtp = async () => {
    if (resendCooldown > 0 || isResending) return;
    setIsResending(true);
    setError("");

    try {
      await sendOtp(formData.email);
      setResendCooldown(OTP_RESEND_COOLDOWN);
      posthogUtils.capture("login_otp_resent", { email: formData.email });
    } catch (err) {
      setError((err as Error).message || "Error al reenviar el código");
    } finally {
      setIsResending(false);
    }
  };

  // Back to credentials
  const handleBackToCredentials = () => {
    setLoginStep("credentials");
    setOtpCode(["", "", "", "", "", ""]);
    setError("");
  };

  // OTP input handlers
  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;

    const newCode = [...otpCode];
    newCode[index] = value.slice(-1);
    setOtpCode(newCode);

    // Auto-advance to next input
    if (value && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all 6 digits entered
    if (value && index === 5 && newCode.every((d) => d !== "")) {
      setTimeout(() => handleOtpVerify(), 150);
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otpCode[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;

    const newCode = [...otpCode];
    for (let i = 0; i < 6; i++) {
      newCode[i] = pasted[i] || "";
    }
    setOtpCode(newCode);

    // Focus last filled input or submit
    const lastIndex = Math.min(pasted.length, 6) - 1;
    otpInputRefs.current[lastIndex]?.focus();

    if (pasted.length === 6) {
      setTimeout(() => handleOtpVerify(), 150);
    }
  };

  const otpFull = otpCode.every((d) => d !== "");

  return (
    <div className="flex min-h-screen">
      {/* Panel izquierdo - Branding (solo desktop) */}
      <div className="hidden lg:flex lg:w-1/2 bg-black text-white items-center justify-center">
        <h1 className="text-5xl font-bold tracking-tight">Samsung Store</h1>
      </div>

      {/* Panel derecho - Formulario */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-8">
        <Card className="w-full max-w-md border-none shadow-none">
          {loginStep === "credentials" ? (
            <>
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
                <div className="flex items-center justify-between w-full text-sm">
                  <Link
                    href="/login/password-recovery"
                    className="text-gray-600 hover:text-gray-900 underline"
                  >
                    ¿Olvidaste tu contraseña?
                  </Link>
                  <Link
                    href="/login/create-account"
                    className="text-gray-600 hover:text-gray-900 underline"
                  >
                    Crear cuenta
                  </Link>
                </div>
                <p className="text-center text-xs text-gray-500">
                  Solo disponible para correos @botopia.tech, @imagiq.com o @imagiq.co
                </p>
              </CardFooter>
            </>
          ) : (
            <>
              <CardHeader className="text-center space-y-2">
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
                  Verificación de seguridad
                </CardTitle>
                <CardDescription>
                  Enviamos un código de 6 dígitos a{" "}
                  <span className="font-medium text-gray-900">{formData.email}</span>
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-6">
                {/* OTP Input Boxes */}
                <div className="flex justify-center gap-2">
                  {otpCode.map((digit, index) => (
                    <input
                      key={index}
                      ref={(el) => { otpInputRefs.current[index] = el; }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(index, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(index, e)}
                      onPaste={index === 0 ? handleOtpPaste : undefined}
                      disabled={isLoading}
                      className="w-12 h-14 text-center text-xl font-semibold border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-black disabled:opacity-50"
                    />
                  ))}
                </div>

                {error && (
                  <div className="text-sm text-red-600 text-center bg-red-50 py-2 px-4 rounded-lg">
                    {error}
                  </div>
                )}

                <Button
                  onClick={handleOtpVerify}
                  disabled={isLoading || !otpFull}
                  className="w-full bg-black text-white hover:bg-gray-800"
                >
                  {isLoading ? "Verificando..." : "Verificar código"}
                </Button>

                <div className="text-center space-y-3">
                  <div className="text-sm text-gray-600">
                    {resendCooldown > 0 ? (
                      <span>Reenviar código en {resendCooldown}s</span>
                    ) : (
                      <button
                        onClick={handleResendOtp}
                        disabled={isResending}
                        className="text-black font-medium hover:underline disabled:opacity-50"
                      >
                        {isResending ? "Reenviando..." : "Reenviar código"}
                      </button>
                    )}
                  </div>

                  <button
                    onClick={handleBackToCredentials}
                    disabled={isLoading}
                    className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900"
                  >
                    <ArrowLeft className="w-3 h-3" />
                    Usar otra cuenta
                  </button>
                </div>
              </CardContent>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
