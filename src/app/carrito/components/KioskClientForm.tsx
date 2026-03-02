"use client";

import React, { useState, useEffect } from "react";
import { apiPost } from "@/lib/api-client";
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
import { Search, Loader2, UserCheck, UserPlus } from "lucide-react";

interface KioskClientFormProps {
  readonly onClientReady: (clientUserId: string) => void;
}

interface CheckUserResponse {
  exists: boolean;
  userId: string | null;
  email?: string;
  nombre?: string;
  apellido?: string;
  telefono?: string;
  numero_documento?: string;
  tipo_documento?: string;
  codigo_pais?: string;
}

interface CreateGuestResponse {
  userId: string;
  created: boolean;
}

type FormStep = "search" | "found" | "new" | "confirming";
type SearchMode = "email" | "cedula";

const countryCodes = [
  { code: "+57", country: "CO" },
  { code: "+1", country: "US" },
  { code: "+52", country: "MX" },
  { code: "+51", country: "PE" },
  { code: "+56", country: "CL" },
  { code: "+54", country: "AR" },
  { code: "+593", country: "EC" },
  { code: "+58", country: "VE" },
  { code: "+507", country: "PA" },
  { code: "+506", country: "CR" },
  { code: "+502", country: "GT" },
  { code: "+591", country: "BO" },
  { code: "+595", country: "PY" },
  { code: "+598", country: "UY" },
  { code: "+55", country: "BR" },
  { code: "+34", country: "ES" },
];

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
    if (v.length < 7 || v.length > 15) return "Entre 7 y 15 dígitos";
    return "";
  },
  tipo_documento: (v: string) => {
    if (!v) return "Selecciona tipo";
    return "";
  },
};

export default function KioskClientForm({ onClientReady }: KioskClientFormProps) {
  const [searchMode, setSearchMode] = useState<SearchMode>("email");
  const [email, setEmail] = useState("");
  const [searchCedula, setSearchCedula] = useState("");
  const [step, setStep] = useState<FormStep>("search");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [existingUserId, setExistingUserId] = useState<string | null>(null);
  const [editingFound, setEditingFound] = useState(false);

  const [prefijo, setPrefijo] = useState("+57");
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

  // Restore kiosk_client_id data if coming back from Step3
  useEffect(() => {
    const saved = localStorage.getItem("kiosk_client_id");
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
    if (searchMode === "email") {
      if (!email.trim()) {
        setError("Ingresa el correo del cliente");
        return;
      }
      if (!/^[\w-.]+@[\w-]+\.[\w-.]+$/.test(email.trim())) {
        setError("Formato de correo inválido");
        return;
      }
    } else {
      if (!searchCedula.trim()) {
        setError("Ingresa el número de documento del cliente");
        return;
      }
      if (searchCedula.trim().length < 6 || searchCedula.trim().length > 10) {
        setError("El número de documento debe tener entre 6 y 10 dígitos");
        return;
      }
    }

    setLoading(true);
    setError("");

    try {
      const payload = searchMode === "email"
        ? { email: email.toLowerCase().trim() }
        : { numero_documento: searchCedula.trim() };

      const result = await apiPost<CheckUserResponse>("/api/orders/kiosk/check-user", payload);

      if (result.exists && result.userId) {
        // User exists, populate form with data from check-user response
        setExistingUserId(result.userId);
        // Si buscamos por cédula y el backend devuelve el email, lo seteamos
        if (searchMode === "cedula" && result.email) {
          setEmail(result.email);
        }
        setForm({
          nombre: result.nombre || "",
          apellido: result.apellido || "",
          celular: result.telefono || "",
          tipo_documento: result.tipo_documento || "CC",
          cedula: result.numero_documento || "",
        });
        if (result.codigo_pais) {
          const code = result.codigo_pais.startsWith("+") ? result.codigo_pais : `+${result.codigo_pais}`;
          if (countryCodes.some(c => c.code === code)) {
            setPrefijo(code);
          }
        }
        setStep("found");
      } else {
        // New client
        setExistingUserId(null);
        setForm({
          nombre: "",
          apellido: "",
          celular: "",
          tipo_documento: "CC",
          cedula: searchMode === "cedula" ? searchCedula.trim() : "",
        });
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

    // Validar email
    if (!email.trim()) {
      setError("Ingresa el correo electrónico del cliente");
      return;
    }
    if (!/^[\w-.]+@[\w-]+\.[\w-.]+$/.test(email.trim())) {
      setError("Formato de correo inválido");
      return;
    }

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
        codigo_pais: prefijo.replace("+", ""),
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
        codigo_pais: prefijo.replace("+", ""),
        isNew: false,
        timestamp: Date.now(),
      };
      localStorage.setItem("kiosk_client_id", JSON.stringify(clientData));
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

    // Validar email si se buscó por cédula
    if (searchMode === "cedula") {
      if (!email.trim()) {
        setError("Ingresa el correo electrónico del cliente");
        return;
      }
      if (!/^[\w-.]+@[\w-]+\.[\w-.]+$/.test(email.trim())) {
        setError("Formato de correo inválido");
        return;
      }
    }

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
        codigo_pais: prefijo.replace("+", ""),
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
        codigo_pais: prefijo.replace("+", ""),
        isNew: true,
        timestamp: Date.now(),
      };
      localStorage.setItem("kiosk_client_id", JSON.stringify(clientData));
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
  }) && (searchMode === "email" || (email.trim() && /^[\w-.]+@[\w-]+\.[\w-.]+$/.test(email.trim())));

  return (
    <div className="w-full flex items-start justify-center py-8 px-4">
      <Card className="w-full max-w-xl border border-gray-200 shadow-xl rounded-2xl">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-3">
            <Search className="h-5 w-5 text-gray-600" />
          </div>
          <CardTitle className="text-xl">
            Datos del cliente
          </CardTitle>
          <CardDescription className="text-base">
            Busca al cliente por correo o número de documento para consultar su información o registrarlo
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5 pt-2">
          {/* Search mode tabs */}
          {step === "search" && (
            <div className="flex rounded-lg bg-gray-100 p-1">
              <button
                type="button"
                onClick={() => { setSearchMode("email"); setError(""); }}
                className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all ${searchMode === "email" ? "bg-black text-white shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
              >
                Correo electrónico
              </button>
              <button
                type="button"
                onClick={() => { setSearchMode("cedula"); setError(""); }}
                className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all ${searchMode === "cedula" ? "bg-black text-white shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
              >
                Número de documento
              </button>
            </div>
          )}

          {/* Search input */}
          <div className="space-y-2">
            <Label htmlFor="client-search" className="text-base font-medium">
              {searchMode === "email" ? "Correo electrónico" : "Número de documento"}
            </Label>
            <div className="flex gap-2">
              {searchMode === "email" ? (
                <Input
                  id="client-search"
                  type="email"
                  placeholder="cliente@ejemplo.com"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError(""); }}
                  disabled={loading || step === "found" || step === "new"}
                  onKeyDown={(e) => { if (e.key === "Enter" && step === "search") handleSearch(); }}
                  className="h-10 text-base"
                />
              ) : (
                <Input
                  id="client-search"
                  inputMode="numeric"
                  placeholder="Número de documento"
                  value={searchCedula}
                  onChange={(e) => { setSearchCedula(e.target.value.replaceAll(/\D/g, "")); setError(""); }}
                  disabled={loading || step === "found" || step === "new"}
                  onKeyDown={(e) => { if (e.key === "Enter" && step === "search") handleSearch(); }}
                  maxLength={10}
                  className="h-10 text-base"
                />
              )}
              {step === "search" ? (
                <Button
                  onClick={handleSearch}
                  disabled={loading || (searchMode === "email" ? !email.trim() : !searchCedula.trim())}
                  className="bg-black hover:bg-gray-800 text-white shrink-0 px-4 h-10"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setStep("search");
                    setEmail("");
                    setSearchCedula("");
                    setError("");
                    setExistingUserId(null);
                    setEditingFound(false);
                    setForm({ nombre: "", apellido: "", celular: "", tipo_documento: "CC", cedula: "" });
                    setFieldErrors({ nombre: "", apellido: "", celular: "", tipo_documento: "", cedula: "" });
                  }}
                  disabled={loading}
                  className="shrink-0 text-sm h-10"
                >
                  Cambiar
                </Button>
              )}
            </div>
          </div>

          {error && (
            <div className="text-base text-red-600 text-center bg-red-50 py-2 px-3 rounded-lg">
              {error}
            </div>
          )}

          {/* Client found */}
          {step === "found" && (
            <div className="space-y-4 border-t pt-4">
              <div className="flex items-center gap-2 text-green-700 bg-green-50 px-3 py-2.5 rounded-lg">
                <UserCheck className="h-4 w-4 shrink-0" />
                <span className="text-base font-medium">Cliente encontrado</span>
              </div>

              <div className="min-h-[180px]">
                {!editingFound ? (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <span className="text-sm text-gray-400">Nombres</span>
                      <p className="text-base font-medium">{form.nombre || "-"}</p>
                    </div>
                    <div>
                      <span className="text-sm text-gray-400">Apellidos</span>
                      <p className="text-base font-medium">{form.apellido || "-"}</p>
                    </div>
                    <div>
                      <span className="text-sm text-gray-400">Documento</span>
                      <p className="text-base font-medium">{form.tipo_documento} {form.cedula || "-"}</p>
                    </div>
                    <div>
                      <span className="text-sm text-gray-400">Celular</span>
                      <p className="text-base font-medium">{prefijo} {form.celular || "-"}</p>
                    </div>
                    <div className="col-span-2">
                      <span className="text-sm text-gray-400">Correo electrónico</span>
                      <p className="text-base font-medium">{email || "-"}</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label htmlFor="kiosk-edit-nombre" className="text-sm">Nombres</Label>
                        <Input id="kiosk-edit-nombre" value={form.nombre} onChange={(e) => handleFieldChange("nombre", e.target.value)} disabled={loading} className="h-10 text-base" />
                        {fieldErrors.nombre && <span className="text-red-500 text-xs">{fieldErrors.nombre}</span>}
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="kiosk-edit-apellido" className="text-sm">Apellidos</Label>
                        <Input id="kiosk-edit-apellido" value={form.apellido} onChange={(e) => handleFieldChange("apellido", e.target.value)} disabled={loading} className="h-10 text-base" />
                        {fieldErrors.apellido && <span className="text-red-500 text-xs">{fieldErrors.apellido}</span>}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-sm">Documento</Label>
                      <div className="flex items-center gap-2">
                        <Select value={form.tipo_documento} onValueChange={(v) => handleFieldChange("tipo_documento", v)} disabled={loading || searchMode === "cedula"}>
                          <SelectTrigger id="kiosk-edit-tipo-doc" className="h-10 text-base w-28 shrink-0"><SelectValue placeholder="Tipo" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="CC">CC</SelectItem>
                            <SelectItem value="CE">CE</SelectItem>
                            <SelectItem value="NIT">NIT</SelectItem>
                            <SelectItem value="PP">PP</SelectItem>
                          </SelectContent>
                        </Select>
                        <Input id="kiosk-edit-cedula" inputMode="numeric" value={form.cedula} onChange={(e) => handleFieldChange("cedula", e.target.value)} disabled={loading || searchMode === "cedula"} maxLength={10} placeholder="Número de documento" className="h-10 text-base flex-1" />
                      </div>
                      {fieldErrors.cedula && <span className="text-red-500 text-xs">{fieldErrors.cedula}</span>}
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="kiosk-edit-celular" className="text-sm">Celular</Label>
                      <div className="flex items-center gap-2">
                        <Select value={prefijo} onValueChange={setPrefijo}>
                          <SelectTrigger className="h-10 text-base w-28 shrink-0"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {countryCodes.map((c) => (
                              <SelectItem key={c.code} value={c.code}>{c.code} {c.country}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Input id="kiosk-edit-celular" inputMode="numeric" value={form.celular} onChange={(e) => handleFieldChange("celular", e.target.value)} disabled={loading} maxLength={15} className="h-10 text-base flex-1" />
                      </div>
                      {fieldErrors.celular && <span className="text-red-500 text-xs">{fieldErrors.celular}</span>}
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="kiosk-edit-email" className="text-sm">Correo electrónico *</Label>
                      <Input id="kiosk-edit-email" type="email" value={email} onChange={(e) => { setEmail(e.target.value); setError(""); }} disabled={loading || searchMode === "email"} placeholder="cliente@ejemplo.com" className="h-10 text-base" />
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={handleConfirmExisting}
                  disabled={loading}
                  className="flex-1 bg-black hover:bg-gray-800 text-white h-12 text-base"
                >
                  {loading ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Procesando...</>
                  ) : (
                    editingFound ? "Guardar y continuar" : "Continuar con este cliente"
                  )}
                </Button>
                {!editingFound ? (
                  <Button
                    variant="outline"
                    onClick={() => setEditingFound(true)}
                    disabled={loading}
                    className="h-12 px-4 shrink-0 text-sm"
                  >
                    Editar
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    onClick={() => setEditingFound(false)}
                    disabled={loading}
                    className="h-12 px-4 shrink-0 text-sm"
                  >
                    Cancelar
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* New client form */}
          {step === "new" && (
            <div className="space-y-4 border-t pt-4">
              <div className="flex items-center justify-center gap-2 text-blue-700 bg-blue-50 px-3 py-2.5 rounded-lg">
                <UserPlus className="h-4 w-4 shrink-0" />
                <span className="text-base font-medium">Cliente nuevo, completa sus datos</span>
              </div>

              <div className="space-y-3">
                {/* Si buscó por cédula, pedir email */}
                {searchMode === "cedula" && (
                  <div className="space-y-1">
                    <Label htmlFor="kiosk-new-email" className="text-sm">Correo electrónico *</Label>
                    <Input
                      id="kiosk-new-email"
                      type="email"
                      value={email}
                      onChange={(e) => { setEmail(e.target.value); setError(""); }}
                      disabled={loading}
                      placeholder="cliente@ejemplo.com"
                      className="h-10 text-base"
                    />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="kiosk-nombre" className="text-sm">Nombres *</Label>
                    <Input
                      id="kiosk-nombre"
                      value={form.nombre}
                      onChange={(e) => handleFieldChange("nombre", e.target.value)}
                      disabled={loading}
                      placeholder="Nombres"
                      className="h-10 text-base"
                    />
                    {fieldErrors.nombre && <span className="text-red-500 text-xs">{fieldErrors.nombre}</span>}
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="kiosk-apellido" className="text-sm">Apellidos *</Label>
                    <Input
                      id="kiosk-apellido"
                      value={form.apellido}
                      onChange={(e) => handleFieldChange("apellido", e.target.value)}
                      disabled={loading}
                      placeholder="Apellidos"
                      className="h-10 text-base"
                    />
                    {fieldErrors.apellido && <span className="text-red-500 text-xs">{fieldErrors.apellido}</span>}
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-sm">Documento *</Label>
                  <div className="flex gap-2">
                    <Select
                      value={form.tipo_documento}
                      onValueChange={(v) => handleFieldChange("tipo_documento", v)}
                      disabled={loading}
                    >
                      <SelectTrigger id="kiosk-tipo-doc" className="h-10 text-base w-28 shrink-0">
                        <SelectValue placeholder="Tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="CC">CC</SelectItem>
                        <SelectItem value="CE">CE</SelectItem>
                        <SelectItem value="NIT">NIT</SelectItem>
                        <SelectItem value="PP">PP</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      id="kiosk-cedula"
                      inputMode="numeric"
                      value={form.cedula}
                      onChange={(e) => handleFieldChange("cedula", e.target.value)}
                      disabled={loading}
                      maxLength={10}
                      placeholder="Número de documento"
                      className="h-10 text-base flex-1"
                    />
                  </div>
                  {fieldErrors.tipo_documento && <span className="text-red-500 text-xs">{fieldErrors.tipo_documento}</span>}
                  {fieldErrors.cedula && <span className="text-red-500 text-xs">{fieldErrors.cedula}</span>}
                </div>

                <div className="space-y-1">
                  <Label htmlFor="kiosk-celular" className="text-sm">Celular *</Label>
                  <div className="flex items-center gap-2">
                    <Select value={prefijo} onValueChange={setPrefijo}>
                      <SelectTrigger className="h-10 text-base w-28 shrink-0"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {countryCodes.map((c) => (
                          <SelectItem key={c.code} value={c.code}>{c.code} {c.country}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      id="kiosk-celular"
                      inputMode="numeric"
                      value={form.celular}
                      onChange={(e) => handleFieldChange("celular", e.target.value)}
                      disabled={loading}
                      maxLength={15}
                      placeholder="Número de celular"
                      className="h-10 text-base flex-1"
                    />
                  </div>
                  {fieldErrors.celular && <span className="text-red-500 text-xs">{fieldErrors.celular}</span>}
                </div>
              </div>

              <Button
                onClick={handleCreateGuest}
                disabled={loading || !isFormValid}
                className="w-full bg-black hover:bg-gray-800 text-white h-12 text-base"
              >
                {loading ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creando cliente...</>
                ) : (
                  "Registrar y continuar"
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
