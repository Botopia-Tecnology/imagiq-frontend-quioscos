"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Eye, EyeOff, Check, X, ArrowLeft, Loader2 } from "lucide-react";
import { apiPost } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import { isAllowedEmailDomain, DOMAIN_ERROR_MESSAGE } from "@/utils/emailDomainValidation";

type Step = "email" | "otp" | "password" | "success";

function getPasswordChecks(password: string) {
  return [
    { label: "Mínimo 8 caracteres", valid: password.length >= 8 },
    { label: "Una mayúscula", valid: /[A-Z]/.test(password) },
    { label: "Una minúscula", valid: /[a-z]/.test(password) },
    { label: "Un número", valid: /\d/.test(password) },
  ];
}

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);

  // Cooldown timer para reenvío
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const passwordChecks = getPasswordChecks(newPassword);
  const allChecksValid = passwordChecks.every((c) => c.valid);

  // Step 1: Enviar OTP al correo
  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email) {
      setError("Ingresa tu correo electrónico");
      return;
    }

    if (!isAllowedEmailDomain(email)) {
      setError(DOMAIN_ERROR_MESSAGE);
      return;
    }

    setIsLoading(true);
    try {
      await apiPost("/api/auth/kiosk/forgot-password", {
        email: email.toLowerCase().trim(),
      });
      setResendCooldown(60);
      setStep("otp");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al enviar el código");
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2: Verificar OTP + nueva contraseña
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!otp || otp.length !== 6) {
      setError("Ingresa el código de 6 dígitos");
      return;
    }

    if (!allChecksValid) {
      setError("La contraseña no cumple con todos los requisitos");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Las contraseñas no coinciden");
      return;
    }

    setIsLoading(true);
    try {
      await apiPost("/api/auth/kiosk/reset-password", {
        email: email.toLowerCase().trim(),
        codigo: otp,
        newPassword,
      });
      setStep("success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al restablecer la contraseña");
    } finally {
      setIsLoading(false);
    }
  };

  // Reenviar OTP
  const handleResend = async () => {
    if (resendCooldown > 0) return;
    setError("");
    setIsLoading(true);
    try {
      await apiPost("/api/auth/kiosk/forgot-password", {
        email: email.toLowerCase().trim(),
      });
      setOtp("");
      setResendCooldown(60);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al reenviar el código");
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
        <div className="w-full max-w-md">
          {/* Logo en mobile */}
          <div className="lg:hidden flex justify-center mb-6">
            <Image
              src="/frame_black.png"
              alt="ImagiQ"
              width={48}
              height={48}
              priority
            />
          </div>

          {/* STEP: Email */}
          {step === "email" && (
            <Card className="border-none shadow-none">
              <CardHeader className="text-center space-y-2">
                <CardTitle className="text-2xl font-bold">Recuperar contraseña</CardTitle>
                <CardDescription>
                  Ingresa tu correo corporativo y te enviaremos un código de verificación
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleEmailSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Correo electrónico</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="tu@imagiq.com"
                      value={email}
                      onChange={(e) => { setEmail(e.target.value); setError(""); }}
                      disabled={isLoading}
                    />
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
                        Enviando...
                      </>
                    ) : (
                      "Enviar código"
                    )}
                  </Button>
                </form>
              </CardContent>
              <CardFooter className="justify-center">
                <Link
                  href="/login"
                  className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Volver al inicio de sesión
                </Link>
              </CardFooter>
            </Card>
          )}

          {/* STEP: OTP + New Password */}
          {step === "otp" && (
            <Card className="border-none shadow-none">
              <CardHeader className="text-center space-y-2">
                <CardTitle className="text-2xl font-bold">Restablecer contraseña</CardTitle>
                <CardDescription>
                  Ingresa el código enviado a <span className="font-medium text-gray-900">{email}</span> y tu nueva contraseña
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleResetPassword} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="otp">Código de verificación</Label>
                    <Input
                      id="otp"
                      type="text"
                      inputMode="numeric"
                      placeholder="000000"
                      maxLength={6}
                      value={otp}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, "");
                        setOtp(val);
                        setError("");
                      }}
                      disabled={isLoading}
                      className="text-center text-lg tracking-[0.5em] font-mono"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="newPassword">Nueva contraseña</Label>
                    <div className="relative">
                      <Input
                        id="newPassword"
                        type={showPassword ? "text" : "password"}
                        placeholder="Ingresa tu nueva contraseña"
                        value={newPassword}
                        onChange={(e) => { setNewPassword(e.target.value); setError(""); }}
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
                    {newPassword.length > 0 && (
                      <div className="grid grid-cols-2 gap-x-3 gap-y-1 mt-1">
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
                        type={showConfirm ? "text" : "password"}
                        placeholder="Repite tu nueva contraseña"
                        value={confirmPassword}
                        onChange={(e) => { setConfirmPassword(e.target.value); setError(""); }}
                        disabled={isLoading}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirm(!showConfirm)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {confirmPassword.length > 0 && newPassword !== confirmPassword && (
                      <p className="text-xs text-red-500 flex items-center gap-1">
                        <X className="h-3.5 w-3.5 shrink-0" />
                        Las contraseñas no coinciden
                      </p>
                    )}
                  </div>

                  {error && (
                    <div className="text-sm text-red-600 text-center bg-red-50 py-2 px-4 rounded-lg">
                      {error}
                    </div>
                  )}

                  <Button
                    type="submit"
                    disabled={isLoading || otp.length !== 6 || !allChecksValid || newPassword !== confirmPassword}
                    className="w-full bg-black text-white hover:bg-gray-800"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Restableciendo...
                      </>
                    ) : (
                      "Restablecer contraseña"
                    )}
                  </Button>
                </form>
              </CardContent>
              <CardFooter className="flex flex-col gap-3">
                <button
                  onClick={handleResend}
                  disabled={isLoading || resendCooldown > 0}
                  className="text-sm text-gray-600 hover:text-gray-900 underline disabled:opacity-50 disabled:no-underline disabled:cursor-not-allowed"
                >
                  {resendCooldown > 0
                    ? `Reenviar código (${resendCooldown}s)`
                    : "Reenviar código"}
                </button>
                <button
                  onClick={() => { setStep("email"); setError(""); setOtp(""); }}
                  className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Cambiar correo
                </button>
              </CardFooter>
            </Card>
          )}

          {/* STEP: Success */}
          {step === "success" && (
            <Card className="border-none shadow-none">
              <CardHeader className="text-center">
                <div className="flex justify-center mb-4">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                    <Check className="w-8 h-8 text-green-600" />
                  </div>
                </div>
                <CardTitle className="text-2xl font-bold">
                  ¡Contraseña restablecida!
                </CardTitle>
                <CardDescription>
                  Tu contraseña ha sido actualizada correctamente. Ya puedes iniciar sesión con tu nueva contraseña.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  onClick={() => router.push("/login")}
                  className="w-full bg-black text-white hover:bg-gray-800"
                >
                  Ir a iniciar sesión
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
