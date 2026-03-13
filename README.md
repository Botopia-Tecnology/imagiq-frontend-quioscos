# Imagiq E-commerce Frontend

## 🏗️ Arquitectura del Proyecto

Este es un e-commerce de gran escala desarrollado con Next.js 14, TypeScript y integración completa con PostHog para analytics avanzados.

### 📁 Estructura del Proyecto

``` 
src/
├── app/                     # App Router de Next.js
│   ├── layout.tsx          # Layout principal
│   ├── page.tsx            # Página de inicio
│   ├── productos/          # Catálogo de productos
│   ├── login/              # Autenticación
│   ├── perfil/             # Perfil de usuario
│   ├── checkout/           # Proceso de compra
│   ├── soporte/            # Soporte al cliente
│   └── dashboard/          # Dashboard administrativo
│       ├── analytics/      # Métricas y reportes
│       └── ventas/         # Gestión de ventas
│
├── components/             # Componentes reutilizables
│   ├── Navbar.tsx         # Navegación principal
│   ├── Footer.tsx         # Pie de página
│   ├── Button.tsx         # Botón personalizable
│   ├── Modal.tsx          # Modal reutilizable
│   ├── LoadingSpinner.tsx # Indicador de carga
│   └── SEO.tsx            # Componente SEO
│
├── features/              # Lógica por dominio
│   ├── auth/              # Autenticación
│   ├── cart/              # Carrito de compras
│   ├── analytics/         # PostHog y métricas
│   ├── products/          # Gestión de productos
│   └── user/              # Preferencias de usuario
│
├── hooks/                 # Custom hooks
│   ├── useDebounce.ts     # Debounce para optimización
│   ├── useLocalStorage.ts # Persistencia local
│   └── useIntersectionObserver.ts # Lazy loading
│
├── lib/                   # Integraciones externas
│   ├── api.ts             # Cliente API
│   ├── posthogClient.ts   # Configuración PostHog
│   └── seo.ts             # Utilidades SEO
│
├── constants/             # Constantes globales
│   ├── routes.ts          # Rutas de la aplicación
│   └── categories.ts      # Categorías de productos
│
├── types/                 # Tipos TypeScript
│   ├── user.ts            # Tipos de usuario
│   ├── product.ts         # Tipos de productos
│   └── analytics.ts       # Tipos de analytics
│
├── assets/                # Recursos estáticos
│   ├── logos/             # Logos de la marca
│   ├── icons/             # Iconografía
│   └── banners/           # Banners promocionales
│
├── middleware.ts          # Middleware de Next.js
└── env.d.ts              # Tipado de variables de entorno
```

## 🚀 Características Principales

### 📊 Analytics Avanzado con PostHog

- **Tracking de eventos**: Interacciones de usuario, conversiones, abandonos
- **Session Replays**: Grabación y análisis de sesiones de usuario
- **Heat Maps**: Mapas de calor de interacciones en páginas
- **Métricas SEO**: Seguimiento de performance y posicionamiento
- **A/B Testing**: Experimentación y optimización continua
- **Segmentación de usuarios**: Análisis de patrones de comportamiento

### 🛒 E-commerce Funcionalidades

- **Catálogo de productos**: Navegación y filtrado avanzado
- **Carrito de compras**: Gestión persistente del carrito
- **Checkout optimizado**: Proceso de compra streamlined
- **Gestión de usuarios**: Perfiles, preferencias y historial
- **Sistema de recomendaciones**: Personalización basada en comportamiento

### 🎯 Métricas de Negocio

- **Ventas por tiempo y región**: Analytics geográfico y temporal
- **Patrones de consumo**: Análisis de comportamiento de compra
- **Conversión y abandono**: Tracking de funnels de conversión
- **Segmentación de clientes**: Clasificación automática de usuarios
- **ROI y KPIs**: Métricas clave de rendimiento

## 🛠️ Stack Tecnológico

- **Frontend**: Next.js 14, TypeScript, TailwindCSS
- **Analytics**: PostHog (eventos, session replays, heat maps)
- **State Management**: Context API + Custom Hooks
- **API Client**: Fetch API con interceptors
- **Routing**: Next.js App Router
- **SEO**: Next.js Metadata API + Structured Data

## 🏃‍♂️ Comandos de Desarrollo

### Con Bun (Recomendado)

```bash
# Instalar dependencias
bun install

# Ejecutar en desarrollo
bun run dev

# Build de producción
bun run build

# Iniciar servidor de producción
bun run start

# Linting
bun run lint
```

### Alternativo con Script PowerShell (Windows)

Si tienes problemas con el PATH de Bun, usa el script incluido:

```powershell
# Ejecutar en desarrollo
.\run-bun.ps1 run dev

# Instalar dependencias
.\run-bun.ps1 install

# Build de producción
.\run-bun.ps1 run build
```

### Con NPM (Fallback)

```bash
# Instalar dependencias
npm install

# Ejecutar en desarrollo
npm run dev

# Build de producción
npm run build

# Iniciar servidor de producción
npm run start

# Linting
npm run lint
```

## 📝 Variables de Entorno

Crear un archivo `.env.local` con las siguientes variables:

```env
# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_APP_URL=http://localhost:3000

# PostHog Analytics
NEXT_PUBLIC_POSTHOG_KEY=your_posthog_key
NEXT_PUBLIC_POSTHOG_HOST=https://app.posthog.com

# Feature Flags
NEXT_PUBLIC_ENABLE_ANALYTICS=true
NEXT_PUBLIC_ENABLE_SESSION_REPLAY=true
NEXT_PUBLIC_ENABLE_AB_TESTING=true
```

## 🎨 Guía de Desarrollo

### Estructura de Componentes

- Todos los componentes deben ser tipados con TypeScript
- Usar interface para props complejas
- Implementar loading states y error handling
- Incluir tracking de eventos relevantes

### Naming Conventions

- Componentes: PascalCase (`UserProfile.tsx`)
- Hooks: camelCase con prefijo `use` (`useProductData.ts`)
- Constantes: UPPER_SNAKE_CASE (`API_ROUTES`)
- Archivos: kebab-case para páginas, PascalCase para componentes

### Analytics Implementation

- Cada interacción importante debe ser trackeada
- Usar eventos descriptivos y propiedades consistentes
- Implementar tracking de conversion funnels
- Configurar session replays para debugging

## 🔒 Seguridad

- Implementación de middleware para protección de rutas
- Validación de tokens JWT
- Rate limiting en APIs
- Headers de seguridad configurados
- Sanitización de inputs de usuario

## 📈 Performance

- Lazy loading de componentes e imágenes
- Code splitting automático con Next.js
- Optimización de imágenes con Next.js Image
- Debouncing en búsquedas y filtros
- Caching estratégico de datos

---

**Nota**: Esta estructura está diseñada para escalar y mantener un código limpio y organizacional. Cada módulo tiene responsabilidades bien definidas y la integración con PostHog permite un análisis profundo del comportamiento del usuario y métricas de negocio.
