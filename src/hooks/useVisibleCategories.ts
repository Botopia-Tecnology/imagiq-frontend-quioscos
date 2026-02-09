import { useState, useEffect } from "react";
import { categoriesEndpoints, type VisibleCategory } from "@/lib/api";
import { toSlug } from "@/app/productos/[categoria]/utils/slugUtils";

// Categorías ocultas desde variable de entorno (ej: "IM,AV")
const HIDDEN_CODES = (process.env.NEXT_PUBLIC_HIDDEN_CATEGORIES || "")
  .split(",")
  .map((c) => c.trim())
  .filter(Boolean);

const filterHidden = (categories: VisibleCategory[]) =>
  HIDDEN_CODES.length > 0
    ? categories.filter((c) => !HIDDEN_CODES.includes(c.nombre))
    : categories;

export function useVisibleCategories() {
  const [visibleCategories, setVisibleCategories] = useState<VisibleCategory[]>(
    []
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchVisibleCategories = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await categoriesEndpoints.getVisibleCategories();
        setVisibleCategories(
          filterHidden((response.data as VisibleCategory[]) || [])
        );
        setError(response.message || null);
      } catch (err) {
        console.error("Error fetching visible categories:", err);
        setError("Error al cargar categorías");

        // Fallback: usar categorías mock si el backend no está disponible
        const mockCategories: VisibleCategory[] = [
          {
            uuid: "mock-av",
            nombre: "AV",
            nombreVisible: "Televisores y AV",
            descripcion: "Televisores y Audio/Video",
            imagen: "",
            activo: true,
            orden: 2,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            totalProducts: 0,
          },
          {
            uuid: "mock-da",
            nombre: "DA",
            nombreVisible: "Electrodomésticos",
            descripcion: "Electrodomésticos",
            imagen: "",
            activo: true,
            orden: 3,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            totalProducts: 0,
          },
          {
            uuid: "mock-it",
            nombre: "IT",
            nombreVisible: "Monitores",
            descripcion: "Monitores",
            imagen: "",
            activo: true,
            orden: 4,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            totalProducts: 0,
          },
        ];
        setVisibleCategories(filterHidden(mockCategories));
      } finally {
        setLoading(false);
      }
    };

    fetchVisibleCategories();
  }, []);

  // Función para mapear el nombre de la categoría API al nombre del navbar
  const mapCategoryToNavbarName = (categoryName: string): string => {
    const categoryMap: Record<string, string> = {
      IM: "Dispositivos móviles",
      AV: "Televisores y AV",
      DA: "Electrodomésticos",
      IT: "Monitores",
    };

    return categoryMap[categoryName] || categoryName;
  };

  // Función para obtener las rutas del navbar basadas en las categorías visibles
  const getNavbarRoutes = () => {
    const mappedCategories = visibleCategories.map((category) => {
      return {
        name:
          category.nombreVisible || mapCategoryToNavbarName(category.nombre),
        href: getCategoryHref(category.nombre, category.nombreVisible),
        category: category.nombre.toLowerCase(),
        categoryCode: category.nombre, // Código original de la categoría (IM, AV, DA, IT)
        categoryVisibleName: category.nombreVisible, // Nombre visible para generar slugs dinámicos
        dropdownName: mapCategoryToNavbarName(category.nombre), // Nombre para el dropdown
        uuid: category.uuid,
        totalProducts: 0,
        orden: category.orden,
      };
    });

    // Agregar rutas fijas que siempre deben estar presentes
    const fixedRoutes = [
      {
        name: "Ofertas",
        href: "/ofertas",
        category: "promociones",
        categoryCode: "ofertas",
        dropdownName: "Ofertas",
        uuid: "ofertas",
        totalProducts: 0,
        orden: 0,
      },
    ];

    // Agregar Tiendas al final de todas las opciones
    const tiendasRoute = {
      name: "Tiendas",
      href: "/tiendas",
      category: "ubicaciones",
      categoryCode: "tiendas",
      dropdownName: "", // No tiene dropdown
      uuid: "tiendas",
      totalProducts: 0,
      orden: 1000,
    };

    // Agregar Servicio Técnico después de Tiendas
    const soporteRoute = {
      name: "Servicio Técnico",
      href: "/soporte/inicio_de_soporte",
      category: "soporte",
      categoryCode: "soporte",
      dropdownName: "Servicio Técnico", // Dropdown con opciones de soporte
      uuid: "soporte",
      totalProducts: 0,
      orden: 1001,
    };

    // Combinar y ordenar por el campo orden
    const allRoutes = [...fixedRoutes, ...mappedCategories];

    // Agregar rutas fijas solo si no están ocultas
    if (!HIDDEN_CODES.includes("tiendas")) {
      allRoutes.push(tiendasRoute);
    }
    if (!HIDDEN_CODES.includes("soporte")) {
      allRoutes.push(soporteRoute);
    }

    return allRoutes.sort((a, b) => a.orden - b.orden);
  };

  // Función para obtener la URL href basada en el nombre de la categoría
  // Ahora genera slugs dinámicamente desde el nombreVisible
  const getCategoryHref = (
    categoryCode: string,
    categoryVisibleName?: string
  ): string => {
    // Si tenemos nombreVisible, generar slug dinámicamente
    if (categoryVisibleName) {
      return `/productos/${toSlug(categoryVisibleName)}`;
    }

    // Fallback a mapeo estático para compatibilidad
    const hrefMap: Record<string, string> = {
      IM: "/productos/dispositivos-moviles",
      AV: "/productos/televisores",
      DA: "/productos/electrodomesticos",
      IT: "/productos/monitores",
    };

    return hrefMap[categoryCode] || `/productos/${categoryCode.toLowerCase()}`;
  };

  return {
    visibleCategories,
    loading,
    error,
    getNavbarRoutes,
    mapCategoryToNavbarName,
    getCategoryHref,
  };
}
