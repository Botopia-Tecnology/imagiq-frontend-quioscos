"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import EmailStep from "./components/EmailStep";
import TokenStep from "./components/TokenStep";
import ResetPasswordStep from "./components/ResetPasswordStep";
import { apiPost } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";

type RecoveryStep = "email" | "token" | "password" | "success";

export default function PasswordRecoveryPage() {
  const router = useRouter();
  const [step, setStep] = useState<RecoveryStep>("email");
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [error, setError] = useState("");

  // Step 1: Solicitar email
  const handleEmailSubmit = async (submittedEmail: string) => {
    setIsLoading(true);
    setError("");

    try {
      await apiPost<{ message: string }>("/api/auth/forgot-password", {
        email: submittedEmail,
      });

      setEmail(submittedEmail);
      setStep("token");
    } catch (err) {
      setError((err as Error).message || "Error al enviar el código");
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2: Validar token
  const handleTokenSubmit = async (submittedToken: string) => {
    setIsLoading(true);
    setError("");

    try {
      await apiPost<{ message: string }>("/api/auth/validate-token", {
        token: submittedToken,
      });

      setToken(submittedToken);
      setStep("password");
    } catch (err) {
      setError((err as Error).message || "Token inválido o expirado");
    } finally {
      setIsLoading(false);
    }
  };

  // Reenviar token
  const handleResendToken = async () => {
    setIsResending(true);
    setError("");

    try {
      await apiPost<{ message: string }>("/api/auth/resend-token", {
        email,
      });
    } catch (err) {
      setError((err as Error).message || "Error al reenviar el código");
    } finally {
      setIsResending(false);
    }
  };

  // Step 3: Restablecer contraseña
  const handlePasswordReset = async (password: string) => {
    setIsLoading(true);
    setError("");

    try {
      await apiPost<{ message: string }>("/api/auth/reset-password", {
        email,
        nuevaContrasena: password,
      });

      setStep("success");
    } catch (err) {
      setError((err as Error).message || "Error al restablecer la contraseña");
    } finally {
      setIsLoading(false);
    }
  };

  // Volver a email
  const handleBackToEmail = () => {
    setStep("email");
    setEmail("");
    setToken("");
    setError("");
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

          {step === "success" ? (
            <Card className="border-none shadow-none">
              <CardHeader className="text-center">
                <div className="flex justify-center mb-4">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                    <svg
                      className="w-8 h-8 text-green-600"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                </div>
                <CardTitle className="text-2xl font-bold">
                  ¡Contraseña actualizada!
                </CardTitle>
                <CardDescription>
                  Tu contraseña ha sido restablecida correctamente. Ahora puedes
                  iniciar sesión con tu nueva contraseña.
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
          ) : (
            <div className="w-full">
              {step === "email" && (
                <EmailStep
                  onEmailSubmit={handleEmailSubmit}
                  isLoading={isLoading}
                  error={error}
                />
              )}

              {step === "token" && (
                <TokenStep
                  email={email}
                  onTokenSubmit={handleTokenSubmit}
                  onResendToken={handleResendToken}
                  onBackToEmail={handleBackToEmail}
                  isLoading={isLoading}
                  isResending={isResending}
                  error={error}
                />
              )}

              {step === "password" && (
                <ResetPasswordStep
                  token={token}
                  email={email}
                  onPasswordReset={handlePasswordReset}
                  isLoading={isLoading}
                  error={error}
                  onSuccess={() => setStep("success")}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
