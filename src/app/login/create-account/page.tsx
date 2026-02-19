"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuthContext } from "@/features/auth/context";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiPost } from "@/lib/api-client";
import { isAllowedEmailDomain, DOMAIN_ERROR_MESSAGE } from "@/utils/emailDomainValidation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { MapPin, Store, Clock, Phone, Eye, EyeOff, CheckCircle2, Loader2, Mail, Check, X, ArrowLeft } from "lucide-react";

interface TiendaData {
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
}

interface VerifyOtpResponse {
  verified: boolean;
  tienda: TiendaData;
}

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY || "";

// Componente de mapa con Google Maps JavaScript API
function GoogleMap({ lat, lng, title }: { lat: number; lng: number; title: string }) {
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

    new window.google.maps.Marker({
      position,
      map,
      title,
    });

    mapInstanceRef.current = map;
  }, [lat, lng, title]);

  useEffect(() => {
    // Si ya está cargado Google Maps
    if (window.google?.maps) {
      initMap();
      return;
    }

    // Verificar si ya se está cargando el script
    const existingScript = document.querySelector('script[src*="maps.googleapis.com"]');
    if (existingScript) {
      existingScript.addEventListener("load", initMap);
      return;
    }

    // Cargar el script
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
      style={{ height: 340 }}
    />
  );
}

// Validaciones de contraseña
function getPasswordChecks(password: string) {
  return [
    { label: "Mínimo 8 caracteres", valid: password.length >= 8 },
    { label: "Una letra mayúscula", valid: /[A-Z]/.test(password) },
    { label: "Una letra minúscula", valid: /[a-z]/.test(password) },
    { label: "Un número", valid: /\d/.test(password) },
  ];
}

export default function CreateAccountPage() {
  const router = useRouter();
  const { login } = useAuthContext();

  // Step: 'email' | 'otp' | 'confirm' | 'success'
  const [step, setStep] = useState<"email" | "otp" | "confirm" | "success">("email");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const [email, setEmail] = useState("");
  const [otpDigits, setOtpDigits] = useState<string[]>(["", "", "", ""]);
  const [otpLength, setOtpLength] = useState(4);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [tienda, setTienda] = useState<TiendaData | null>(null);
  const [contrasena, setContrasena] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const passwordChecks = getPasswordChecks(contrasena);
  const allPasswordChecksValid = passwordChecks.every((c) => c.valid);

  // Redirigir si ya está autenticado
  useEffect(() => {
    const token = localStorage.getItem("imagiq_token");
    const userInfo = localStorage.getItem("imagiq_user");
    if (token && userInfo) {
      try {
        const user = JSON.parse(userInfo);
        const userRole = user.role ?? user.rol;
        if (userRole !== 3) {
          router.push("/");
        }
      } catch {
        // ignorar
      }
    }
  }, [router]);

  // Cooldown timer para reenviar OTP
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const handleSendOtp = async () => {
    setError("");

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Ingresa un correo electrónico válido");
      return;
    }

    if (!isAllowedEmailDomain(email)) {
      setError(DOMAIN_ERROR_MESSAGE);
      return;
    }

    setIsLoading(true);
    try {
      const result = await apiPost<{ message: string; otpLength: number }>("/api/auth/kiosk/send-otp", {
        email: email.toLowerCase().trim(),
      });

      const len = result.otpLength || 4;
      setOtpLength(len);
      setOtpDigits(new Array(len).fill(""));
      setStep("otp");
      setResendCooldown(60);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error al enviar el código";
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0) return;
    setError("");
    setIsLoading(true);
    try {
      const result = await apiPost<{ message: string; otpLength: number }>("/api/auth/kiosk/send-otp", {
        email: email.toLowerCase().trim(),
      });
      const len = result.otpLength || 4;
      setOtpLength(len);
      setOtpDigits(new Array(len).fill(""));
      setResendCooldown(60);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error al reenviar el código";
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;

    const newDigits = [...otpDigits];

    if (value.length > 1) {
      const chars = value.slice(0, otpLength).split("");
      chars.forEach((char, i) => {
        if (index + i < otpLength) {
          newDigits[index + i] = char;
        }
      });
      setOtpDigits(newDigits);
      const nextIndex = Math.min(index + chars.length, otpLength - 1);
      otpRefs.current[nextIndex]?.focus();

      // Auto-verificar si se completaron todos los dígitos (ej: pegar código)
      if (newDigits.every((d) => d !== "")) {
        setTimeout(() => autoVerifyOtp(newDigits), 100);
      }
      return;
    }

    newDigits[index] = value;
    setOtpDigits(newDigits);

    if (value && index < otpLength - 1) {
      otpRefs.current[index + 1]?.focus();
    }

    // Auto-verificar si se completó el último dígito
    if (value && newDigits.every((d) => d !== "")) {
      setTimeout(() => autoVerifyOtp(newDigits), 100);
    }
  };

  const autoVerifyOtp = async (digits: string[]) => {
    const codigo = digits.join("");
    if (codigo.length !== otpLength || isLoading) return;

    setError("");
    setIsLoading(true);
    try {
      const result = await apiPost<VerifyOtpResponse>("/api/auth/kiosk/verify-otp", {
        email: email.toLowerCase().trim(),
        codigo,
      });
      setTienda(result.tienda);
      setStep("confirm");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Código incorrecto";
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otpDigits[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
    if (e.key === "Enter") {
      handleVerifyOtp();
    }
  };

  const handleVerifyOtp = async () => {
    const codigo = otpDigits.join("");
    if (codigo.length !== otpLength) {
      setError(`Ingresa el código completo de ${otpLength} dígitos`);
      return;
    }

    setError("");
    setIsLoading(true);
    try {
      const result = await apiPost<VerifyOtpResponse>("/api/auth/kiosk/verify-otp", {
        email: email.toLowerCase().trim(),
        codigo,
      });

      setTienda(result.tienda);
      setStep("confirm");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Código incorrecto";
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async () => {
    setError("");

    if (!allPasswordChecksValid) {
      setError("La contraseña no cumple con todos los requisitos");
      return;
    }

    if (contrasena !== confirmPassword) {
      setError("Las contraseñas no coinciden");
      return;
    }

    setIsLoading(true);
    try {
      const result = await apiPost<{
        access_token: string;
        store: TiendaData & { id: string };
      }>("/api/auth/kiosk/register", {
        email: email.toLowerCase().trim(),
        contrasena,
      });

      if (result.access_token) {
        localStorage.setItem("imagiq_token", result.access_token);
        document.cookie = `imagiq_token=1; path=/; max-age=${60 * 60 * 24}; SameSite=Lax`;
        localStorage.setItem(
          "imagiq_user",
          JSON.stringify({
            id: result.store.id,
            email: result.store.email,
            nombre: result.store.descripcion,
            apellido: "",
            numero_documento: "",
            telefono: result.store.telefono,
            role: 5,
          })
        );

        await login({
          id: result.store.id,
          email: result.store.email,
          nombre: result.store.descripcion,
          apellido: "",
          numero_documento: "",
          telefono: result.store.telefono,
          role: 5,
        });
      }

      setStep("success");

      setTimeout(() => {
        router.push("/");
      }, 2000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error al crear la cuenta";
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const hasCoordinates = tienda?.latitud && tienda?.longitud &&
    !isNaN(parseFloat(tienda.latitud)) && !isNaN(parseFloat(tienda.longitud));

  return (
    <div className="flex min-h-screen">
      {/* Panel izquierdo - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-black text-white items-center justify-center">
        <h1 className="text-5xl font-bold tracking-tight">Samsung Store</h1>
      </div>

      {/* Panel derecho - Formulario */}
      <div className="flex-1 flex items-start justify-center px-8 py-6 sm:px-12 sm:py-8 overflow-y-auto">
        <div className="w-full my-auto space-y-6">
          {/* Step: Email */}
          {step === "email" && (
            <Card className="border-none shadow-none">
              <CardHeader className="text-center">
                <CardTitle className="text-2xl font-bold">Crear cuenta de tienda</CardTitle>
                <CardDescription>
                  Ingresa el correo corporativo de tu tienda para comenzar
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 max-w-md mx-auto">
                <div className="space-y-2">
                  <Label htmlFor="email">Correo electrónico de la tienda</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="ses116@imagiq.co"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setError("");
                    }}
                    onKeyDown={(e) => e.key === "Enter" && handleSendOtp()}
                    disabled={isLoading}
                    autoFocus
                  />
                </div>

                <p className="text-xs text-gray-500">
                  Solo disponible para correos @botopia.tech, @imagiq.com o @imagiq.co
                </p>

                {error && (
                  <div className="text-sm text-red-600 text-center bg-red-50 py-2 px-4 rounded-lg">
                    {error}
                  </div>
                )}

                <Button
                  type="button"
                  onClick={handleSendOtp}
                  disabled={isLoading || !email}
                  className="w-full bg-black text-white hover:bg-gray-800"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Enviando código...
                    </>
                  ) : (
                    "Continuar"
                  )}
                </Button>

                <div className="relative">
                  <Separator />
                  <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white px-4 text-xs text-gray-500">
                    ¿Ya tienes cuenta?
                  </span>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push("/login")}
                  className="w-full"
                >
                  Iniciar sesión
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Step: OTP */}
          {step === "otp" && (
            <Card className="border-none shadow-none">
              <CardHeader className="text-center">
                <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
                  <Mail className="h-6 w-6 text-gray-600" />
                </div>
                <CardTitle className="text-2xl font-bold">Verificar correo</CardTitle>
                <CardDescription>
                  Ingresa el código de {otpLength} dígitos enviado a{" "}
                  <span className="font-medium text-gray-900">{email}</span>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5 max-w-md mx-auto">
                <div className="flex justify-center gap-3">
                  {otpDigits.map((digit, index) => (
                    <Input
                      key={index}
                      ref={(el) => { otpRefs.current[index] = el; }}
                      type="text"
                      inputMode="numeric"
                      maxLength={otpLength}
                      value={digit}
                      onChange={(e) => handleOtpChange(index, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(index, e)}
                      disabled={isLoading}
                      className="w-14 h-14 text-center text-2xl font-bold"
                      autoFocus={index === 0}
                    />
                  ))}
                </div>

                {error && (
                  <div className="text-sm text-red-600 text-center bg-red-50 py-2 px-4 rounded-lg">
                    {error}
                  </div>
                )}

                <Button
                  type="button"
                  onClick={handleVerifyOtp}
                  disabled={isLoading || otpDigits.join("").length !== otpLength}
                  className="w-full bg-black text-white hover:bg-gray-800"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Verificando...
                    </>
                  ) : (
                    "Verificar código"
                  )}
                </Button>

                <div className="text-center text-sm text-gray-500">
                  {resendCooldown > 0 ? (
                    <span>Reenviar código en {resendCooldown}s</span>
                  ) : (
                    <button
                      type="button"
                      onClick={handleResendOtp}
                      disabled={isLoading}
                      className="text-gray-700 hover:text-black underline"
                    >
                      Reenviar código
                    </button>
                  )}
                </div>

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setStep("email");
                    setOtpDigits(new Array(otpLength).fill(""));
                    setError("");
                  }}
                  className="w-full"
                >
                  Cambiar correo
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Step: Datos de tienda + Contraseña (todo junto) */}
          {step === "confirm" && tienda && (
            <Card className="border-none shadow-none">
              <CardHeader>
                <button
                  type="button"
                  onClick={() => router.push("/login")}
                  className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-black mb-3 transition-colors"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Volver a iniciar sesión
                </button>
                <CardTitle className="text-3xl font-bold">Confirma tu tienda</CardTitle>
                <CardDescription className="text-base">
                  Verifica los datos y crea una contraseña para tu cuenta
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Info tienda + Mapa lado a lado en desktop */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  {/* Datos de la tienda */}
                  <div className="bg-gray-50 rounded-xl p-5 space-y-4">
                    <div className="flex items-start gap-3">
                      <Store className="h-6 w-6 text-gray-600 mt-0.5 shrink-0" />
                      <div>
                        <p className="font-semibold text-lg">{tienda.descripcion}</p>
                        <p className="text-sm text-gray-500">{tienda.email}</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <MapPin className="h-6 w-6 text-gray-600 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-base">{tienda.direccion}</p>
                        <p className="text-sm text-gray-500">
                          {tienda.ciudad}, {tienda.departamento}
                        </p>
                      </div>
                    </div>

                    {tienda.horario && (
                      <div className="flex items-start gap-3">
                        <Clock className="h-6 w-6 text-gray-600 mt-0.5 shrink-0" />
                        <p className="text-sm">{tienda.horario}</p>
                      </div>
                    )}

                    {tienda.telefono && (
                      <div className="flex items-start gap-3">
                        <Phone className="h-6 w-6 text-gray-600 mt-0.5 shrink-0" />
                        <p className="text-base">
                          {tienda.telefono}
                          {tienda.extension ? ` ext. ${tienda.extension}` : ""}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Mapa */}
                  {hasCoordinates && (
                    <GoogleMap
                      lat={parseFloat(tienda.latitud)}
                      lng={parseFloat(tienda.longitud)}
                      title={tienda.descripcion}
                    />
                  )}
                </div>

                {/* Contraseña - ambos campos en fila */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="contrasena">Contraseña</Label>
                    <div className="relative">
                      <Input
                        id="contrasena"
                        type={showPassword ? "text" : "password"}
                        placeholder="Ingresa tu contraseña"
                        value={contrasena}
                        onChange={(e) => {
                          setContrasena(e.target.value);
                          setError("");
                        }}
                        disabled={isLoading}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {/* Requisitos de contraseña */}
                    {contrasena.length > 0 && (
                      <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                        {passwordChecks.map((check) => (
                          <div key={check.label} className="flex items-center gap-1.5 text-xs">
                            {check.valid ? (
                              <Check className="h-3.5 w-3.5 text-green-500 shrink-0" />
                            ) : (
                              <X className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                            )}
                            <span className={check.valid ? "text-green-600" : "text-gray-500"}>
                              {check.label}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirmar contraseña</Label>
                    <div className="relative">
                      <Input
                        id="confirmPassword"
                        type={showConfirmPassword ? "text" : "password"}
                        placeholder="Repite tu contraseña"
                        value={confirmPassword}
                        onChange={(e) => {
                          setConfirmPassword(e.target.value);
                          setError("");
                        }}
                        onKeyDown={(e) => e.key === "Enter" && handleRegister()}
                        disabled={isLoading}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {confirmPassword.length > 0 && contrasena !== confirmPassword && (
                      <p className="text-xs text-red-500 flex items-center gap-1">
                        <X className="h-3.5 w-3.5 shrink-0" />
                        Las contraseñas no coinciden
                      </p>
                    )}
                  </div>
                </div>

                {error && (
                  <div className="text-sm text-red-600 text-center bg-red-50 py-2 px-4 rounded-lg">
                    {error}
                  </div>
                )}

                <div className="flex gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setTienda(null);
                      setStep("email");
                      setOtpDigits(new Array(otpLength).fill(""));
                      setContrasena("");
                      setConfirmPassword("");
                      setError("");
                    }}
                    disabled={isLoading}
                    className="flex-1"
                  >
                    Cambiar correo
                  </Button>
                  <Button
                    type="button"
                    onClick={handleRegister}
                    disabled={isLoading || !allPasswordChecksValid || !confirmPassword || contrasena !== confirmPassword}
                    className="flex-1 bg-black text-white hover:bg-gray-800"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creando cuenta...
                      </>
                    ) : (
                      "Crear cuenta"
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step: Success */}
          {step === "success" && (
            <Card className="border-none shadow-none">
              <CardContent className="flex flex-col items-center justify-center py-12 space-y-4">
                <CheckCircle2 className="h-16 w-16 text-green-500" />
                <h2 className="text-2xl font-bold text-center">¡Cuenta creada exitosamente!</h2>
                <p className="text-gray-500 text-center">
                  Redirigiendo...
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
