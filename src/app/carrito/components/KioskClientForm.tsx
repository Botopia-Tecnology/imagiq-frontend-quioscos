"use client";

import React, { useState, useEffect } from "react";
import { apiPost, apiGet } from "@/lib/api-client";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Loader2, UserCheck, UserPlus, Pencil } from "lucide-react";

interface KioskClientFormProps {
  readonly onClientReady: (clientUserId: string) => void;
}

interface CheckUserResponse {
  exists: boolean;
  userId: string | null;
}

interface UserProfile {
  id: string;
  nombre: string;
  apellido: string;
  email: string;
  telefono: string;
  numero_documento: string;
  tipo_documento: string;
}

interface CreateGuestResponse {
  userId: string;
  created: boolean;
}

type FormStep = "search" | "found" | "new" | "confirming";

// Filters
const filters = {
  cedula: (v: string) => v.replaceAll(/\D/g, ""),
  celular: (v: string) => v.replaceAll(/\D/g, ""),
  nombre: (v: string) => v.replaceAll(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g, ""),
  apellido: (v: string) => v.replaceAll(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g, ""),
};

// Validators
const validators = {
  nombre: (v: string) => {
    if (!v) return "Nombre requerido";
    if (v.length < 2) return "Mínimo 2 caracteres";
    return "";
  },
  apellido: (v: string) => {
    if (!v) return "Apellido requerido";
    if (v.length < 2) return "Mínimo 2 caracteres";
    return "";
  },
  cedula: (v: string) => {
    if (!v) return "Documento requerido";
    if (v.length < 6 || v.length > 10) return "Entre 6 y 10 dígitos";
    return "";
  },
  celular: (v: string) => {
    if (!v) return "Celular requerido";
    if (v.length !== 10) return "Debe tener 10 dígitos";
    if (!/^3\d{9}$/.test(v)) return "Debe empezar con 3";
    return "";
  },
  tipo_documento: (v: string) => {
    if (!v) return "Selecciona tipo";
    return "";
  },
};

export default function KioskClientForm({ onClientReady }: KioskClientFormProps) {
  const [email, setEmail] = useState("");
  const [step, setStep] = useState<FormStep>("search");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [existingUserId, setExistingUserId] = useState<string | null>(null);
  const [editingFound, setEditingFound] = useState(false);

  const [form, setForm] = useState({
    nombre: "",
    apellido: "",
    celular: "",
    tipo_documento: "CC",
    cedula: "",
  });
  const [fieldErrors, setFieldErrors] = useState({
    nombre: "",
    apellido: "",
    celular: "",
    tipo_documento: "",
    cedula: "",
  });

  // Restore kiosk_client data if coming back from Step3
  useEffect(() => {
    const saved = localStorage.getItem("kiosk_client");
    if (saved && saved !== "null") {
      try {
        const data = JSON.parse(saved);
        if (data?.userId && data?.email) {
          setEmail(data.email);
          setExistingUserId(data.userId);
          if (data.nombre) {
            setForm({
              nombre: data.nombre || "",
              apellido: data.apellido || "",
              celular: data.celular || "",
              tipo_documento: data.tipo_documento || "",
              cedula: data.cedula || "",
            });
          }
          setStep(data.isNew ? "new" : "found");
        }
      } catch {
        // Ignore parse errors
      }
    }
  }, []);

  const validateForm = () => {
    const errors = {
      nombre: validators.nombre(form.nombre.trim()),
      apellido: validators.apellido(form.apellido.trim()),
      cedula: validators.cedula(form.cedula.trim()),
      celular: validators.celular(form.celular.trim()),
      tipo_documento: validators.tipo_documento(form.tipo_documento),
    };
    setFieldErrors(errors);
    return !Object.values(errors).some(Boolean);
  };

  const handleSearch = async () => {
    if (!email.trim()) {
      setError("Ingresa el correo del cliente");
      return;
    }
    if (!/^[\w-.]+@[\w-]+\.[\w-.]+$/.test(email.trim())) {
      setError("Formato de correo inválido");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const result = await apiPost<CheckUserResponse>("/api/orders/kiosk/check-user", {
        email: email.toLowerCase().trim(),
      });

      if (result.exists && result.userId) {
        // User exists, load their profile
        setExistingUserId(result.userId);
        try {
          const profile = await apiGet<UserProfile>(`/api/auth/profile/${result.userId}`);
          setForm({
            nombre: profile.nombre || "",
            apellido: profile.apellido || "",
            celular: profile.telefono || "",
            tipo_documento: profile.tipo_documento || "CC",
            cedula: profile.numero_documento || "",
          });
          setStep("found");
        } catch {
          // If profile fetch fails, still allow continuing with just the userId
          setStep("found");
        }
      } else {
        // New client
        setExistingUserId(null);
        setForm({ nombre: "", apellido: "", celular: "", tipo_documento: "CC", cedula: "" });
        setStep("new");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error buscando cliente");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmExisting = async () => {
    if (!existingUserId) return;

    setLoading(true);
    setError("");

    try {
      // Update user data in DB and get userId
      const result = await apiPost<CreateGuestResponse>("/api/orders/kiosk/create-guest", {
        email: email.toLowerCase().trim(),
        nombre: form.nombre.trim() || "Cliente",
        apellido: form.apellido.trim() || "",
        movil: form.celular.trim() || "",
        documento: form.cedula.trim() || "",
        tipo_documento: form.tipo_documento || "CC",
      });

      // Save client data for later use
      const clientData = {
        userId: result.userId,
        email: email.toLowerCase().trim(),
        nombre: form.nombre,
        apellido: form.apellido,
        celular: form.celular,
        tipo_documento: form.tipo_documento,
        cedula: form.cedula,
        isNew: false,
        timestamp: Date.now(),
      };
      localStorage.setItem("kiosk_client", JSON.stringify(clientData));
      localStorage.setItem("kiosk_client_id", result.userId);
      console.log("🏪 [KioskClientForm] Cliente existente confirmado:", {
        clientId: result.userId,
        email: clientData.email,
        nombre: `${clientData.nombre} ${clientData.apellido}`,
      });

      onClientReady(result.userId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al confirmar cliente");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateGuest = async () => {
    if (!validateForm()) return;

    setLoading(true);
    setError("");

    try {
      const result = await apiPost<CreateGuestResponse>("/api/orders/kiosk/create-guest", {
        email: email.toLowerCase().trim(),
        nombre: form.nombre.trim(),
        apellido: form.apellido.trim(),
        movil: form.celular.trim(),
        documento: form.cedula.trim(),
        tipo_documento: form.tipo_documento,
      });

      // Save client data
      const clientData = {
        userId: result.userId,
        email: email.toLowerCase().trim(),
        nombre: form.nombre.trim(),
        apellido: form.apellido.trim(),
        celular: form.celular.trim(),
        tipo_documento: form.tipo_documento,
        cedula: form.cedula.trim(),
        isNew: true,
        timestamp: Date.now(),
      };
      localStorage.setItem("kiosk_client", JSON.stringify(clientData));
      localStorage.setItem("kiosk_client_id", result.userId);
      console.log("🏪 [KioskClientForm] Cliente nuevo creado:", {
        clientId: result.userId,
        email: clientData.email,
        nombre: `${clientData.nombre} ${clientData.apellido}`,
      });

      onClientReady(result.userId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error creando cliente");
    } finally {
      setLoading(false);
    }
  };

  const handleFieldChange = (name: string, value: string) => {
    const filter = filters[name as keyof typeof filters];
    const filtered = filter ? filter(value) : value;
    const newForm = { ...form, [name]: filtered };
    setForm(newForm);

    const validator = validators[name as keyof typeof validators];
    if (validator) {
      setFieldErrors(prev => ({ ...prev, [name]: validator(filtered.trim()) }));
    }
  };

  const isFormValid = !Object.entries(validators).some(([key, fn]) => {
    return fn(form[key as keyof typeof form].trim()) !== "";
  });

  return (
    <div className="w-full max-w-6xl mx-auto py-8 px-2 md:px-0">
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle className="text-xl flex items-center gap-2">
            <Search className="h-5 w-5" />
            Datos del cliente
          </CardTitle>
          <CardDescription>
            Ingresa el correo electrónico del cliente para buscar su información
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Email search */}
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <Label htmlFor="client-email">Correo electrónico del cliente</Label>
              <Input
                id="client-email"
                type="email"
                placeholder="cliente@ejemplo.com"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(""); }}
                disabled={loading || step === "found" || step === "new"}
                className="mt-1.5"
                onKeyDown={(e) => { if (e.key === "Enter" && step === "search") handleSearch(); }}
              />
            </div>
            {step === "search" ? (
              <Button
                onClick={handleSearch}
                disabled={loading || !email.trim()}
                className="bg-black hover:bg-gray-800 text-white"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin text-white" /> : <><Search className="h-4 w-4 mr-2" /> Buscar</>}
              </Button>
            ) : (
              <Button
                variant="outline"
                onClick={() => {
                  setStep("search");
                  setEmail("");
                  setError("");
                  setExistingUserId(null);
                  setForm({ nombre: "", apellido: "", celular: "", tipo_documento: "CC", cedula: "" });
                  setFieldErrors({ nombre: "", apellido: "", celular: "", tipo_documento: "", cedula: "" });
                }}
                disabled={loading}
              >
                Cambiar
              </Button>
            )}
          </div>

          {error && (
            <div className="text-sm text-red-600 text-center bg-red-50 py-2 px-4 rounded-lg">
              {error}
            </div>
          )}

          {/* Client found */}
          {step === "found" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-2 text-green-700 bg-green-50 px-4 py-3 rounded-lg">
                <div className="flex items-center gap-2">
                  <UserCheck className="h-5 w-5 shrink-0" />
                  <span className="text-sm font-medium">Cliente encontrado en el sistema</span>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingFound(!editingFound)}
                  className="text-green-700 hover:text-green-900 p-1 rounded hover:bg-green-100 transition-colors"
                  title={editingFound ? "Cancelar edición" : "Editar datos"}
                >
                  <Pencil className="h-4 w-4" />
                </button>
              </div>

              {!editingFound ? (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs text-gray-500">Nombre</Label>
                    <p className="font-medium">{form.nombre || "-"}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">Apellido</Label>
                    <p className="font-medium">{form.apellido || "-"}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">Documento</Label>
                    <p className="font-medium">{form.tipo_documento} {form.cedula || "-"}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">Celular</Label>
                    <p className="font-medium">{form.celular || "-"}</p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="kiosk-edit-nombre">Nombre</Label>
                      <Input id="kiosk-edit-nombre" value={form.nombre} onChange={(e) => handleFieldChange("nombre", e.target.value)} disabled={loading} />
                      {fieldErrors.nombre && <span className="text-red-500 text-xs">{fieldErrors.nombre}</span>}
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="kiosk-edit-apellido">Apellido</Label>
                      <Input id="kiosk-edit-apellido" value={form.apellido} onChange={(e) => handleFieldChange("apellido", e.target.value)} disabled={loading} />
                      {fieldErrors.apellido && <span className="text-red-500 text-xs">{fieldErrors.apellido}</span>}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="kiosk-edit-tipo-doc">Tipo de Documento</Label>
                      <Select value={form.tipo_documento} onValueChange={(v) => handleFieldChange("tipo_documento", v)} disabled={loading}>
                        <SelectTrigger id="kiosk-edit-tipo-doc"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="CC">CC</SelectItem>
                          <SelectItem value="CE">CE</SelectItem>
                          <SelectItem value="NIT">NIT</SelectItem>
                          <SelectItem value="PP">PP</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="kiosk-edit-cedula">No. de Documento</Label>
                      <Input id="kiosk-edit-cedula" inputMode="numeric" value={form.cedula} onChange={(e) => handleFieldChange("cedula", e.target.value)} disabled={loading} maxLength={10} />
                      {fieldErrors.cedula && <span className="text-red-500 text-xs">{fieldErrors.cedula}</span>}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="kiosk-edit-celular">Celular</Label>
                    <Input id="kiosk-edit-celular" inputMode="numeric" value={form.celular} onChange={(e) => handleFieldChange("celular", e.target.value)} disabled={loading} maxLength={10} />
                    {fieldErrors.celular && <span className="text-red-500 text-xs">{fieldErrors.celular}</span>}
                  </div>
                </>
              )}

              <Button
                onClick={handleConfirmExisting}
                disabled={loading}
                className="w-full bg-black hover:bg-gray-800 text-white"
              >
                {loading ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Procesando...</>
                ) : (
                  editingFound ? "Guardar y continuar" : "Continuar con este cliente"
                )}
              </Button>
            </div>
          )}

          {/* New client form */}
          {step === "new" && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-blue-700 bg-blue-50 px-4 py-3 rounded-lg">
                <UserPlus className="h-5 w-5 shrink-0" />
                <span className="text-sm font-medium">Cliente nuevo. Completa los datos para crear la cuenta.</span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="kiosk-nombre">Nombre *</Label>
                  <Input
                    id="kiosk-nombre"
                    value={form.nombre}
                    onChange={(e) => handleFieldChange("nombre", e.target.value)}
                    disabled={loading}
                    placeholder="Nombre del cliente"
                  />
                  {fieldErrors.nombre && <span className="text-red-500 text-xs">{fieldErrors.nombre}</span>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="kiosk-apellido">Apellido *</Label>
                  <Input
                    id="kiosk-apellido"
                    value={form.apellido}
                    onChange={(e) => handleFieldChange("apellido", e.target.value)}
                    disabled={loading}
                    placeholder="Apellido del cliente"
                  />
                  {fieldErrors.apellido && <span className="text-red-500 text-xs">{fieldErrors.apellido}</span>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="kiosk-tipo-doc">Tipo de Documento *</Label>
                  <Select
                    value={form.tipo_documento}
                    onValueChange={(v) => handleFieldChange("tipo_documento", v)}
                    disabled={loading}
                  >
                    <SelectTrigger id="kiosk-tipo-doc">
                      <SelectValue placeholder="Seleccionar" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CC">CC</SelectItem>
                      <SelectItem value="CE">CE</SelectItem>
                      <SelectItem value="NIT">NIT</SelectItem>
                      <SelectItem value="PP">PP</SelectItem>
                    </SelectContent>
                  </Select>
                  {fieldErrors.tipo_documento && <span className="text-red-500 text-xs">{fieldErrors.tipo_documento}</span>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="kiosk-cedula">No. de Documento *</Label>
                  <Input
                    id="kiosk-cedula"
                    inputMode="numeric"
                    value={form.cedula}
                    onChange={(e) => handleFieldChange("cedula", e.target.value)}
                    disabled={loading}
                    maxLength={10}
                    placeholder="6 a 10 dígitos"
                  />
                  {fieldErrors.cedula && <span className="text-red-500 text-xs">{fieldErrors.cedula}</span>}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="kiosk-celular">Celular *</Label>
                <Input
                  id="kiosk-celular"
                  inputMode="numeric"
                  value={form.celular}
                  onChange={(e) => handleFieldChange("celular", e.target.value)}
                  disabled={loading}
                  maxLength={10}
                  placeholder="10 dígitos, empieza con 3"
                />
                {fieldErrors.celular && <span className="text-red-500 text-xs">{fieldErrors.celular}</span>}
              </div>

              <Button
                onClick={handleCreateGuest}
                disabled={loading || !isFormValid}
                className="w-full bg-black hover:bg-gray-800 text-white"
              >
                {loading ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creando cliente...</>
                ) : (
                  "Registrar cliente y continuar"
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
