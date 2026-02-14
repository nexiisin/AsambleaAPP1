# 📱 AsambleaAPP - Sistema de Gestión de Asambleas

<div align="center">

[![React Native](https://img.shields.io/badge/React%20Native-0.81.5-blue.svg)](https://reactnative.dev/)
[![Expo](https://img.shields.io/badge/Expo-~54.0.32-lightgrey.svg)](https://expo.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9.2-blue.svg)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-green.svg)](https://supabase.com/)

**Sistema Integral para Gestión de Asambleas Residenciales**

[Características](#-características) • [Instalación](#-instalación) • [Documentación](#-documentación) • [Optimizaciones](#-optimizaciones)

</div>

---

## 📋 Descripción

AsambleaAPP es una aplicación móvil diseñada para facilitar la gestión completa de asambleas residenciales, permitiendo:

- ✅ Registro de asistencia en tiempo real
- ✅ Gestión de apoderados con aprobación/rechazo
- ✅ Sistema de votación digital por propuestas
- ✅ Cálculo automático de quórum
- ✅ Cronómetro de asamblea sincronizado
- ✅ Generación de actas y certificados PDF
- ✅ Panel administrativo completo
- ✅ **Optimizado para 164+ usuarios concurrentes**

---

## 🚀 Características Principales

### 👤 **Módulo Residente**
- **Registro de asistencia**: Ingreso con código de asamblea y número de casa
- **Sala de espera**: Visualización de quórum en tiempo real con barra de progreso
- **Votación digital**: Sistema de votación SI/NO con confirmación visual
- **Resultados en vivo**: Gráficos y estadísticas actualizadas
- **Apoderados**: Sistema especial para representantes con doble voto

### 👔 **Módulo Administrativo**
- **Panel de control**: Vista general de asamblea, estadísticas y quórum
- **Gestión de propuestas**: Crear, editar, iniciar y cerrar votaciones
- **Lista de asistentes**: Ver todos los registrados con salidas anticipadas
- **Aprobación de apoderados**: Validar representantes en tiempo real
- **Cronómetro**: Control de tiempo con pausa/reanudar
- **Generación de PDFs**: Acta de asamblea y certificados de asistencia
- **Visualización de resultados**: Estadísticas detalladas por propuesta

### 🛠️ **Funcionalidades Técnicas**
- **Realtime subscriptions**: Actualizaciones en vivo con Supabase
- **Broadcast channels**: Comunicación sincronizada entre usuarios
- **RPC Functions**: Operaciones atómicas optimizadas
- **Debounce patterns**: Control de cascadas en queries
- **PDF generation**: Reportes descargables en cliente
- **Responsive design**: Adaptable a móvil y desktop

---

## 🛠️ Tecnologías Utilizadas

### **Frontend**
- **React Native** `0.81.5` - Framework móvil
- **Expo** `~54.0.32` - Plataforma de desarrollo
- **TypeScript** `5.9.2` - Tipado estático
- **Expo Router** `~6.0.22` - Navegación basada en archivos
- **React Native Reanimated** - Animaciones fluidas

### **Backend & Base de Datos**
- **Supabase** - Backend as a Service (PostgreSQL)
- **PostgreSQL Functions (RPC)** - Lógica del lado del servidor
- **Realtime Subscriptions** - Comunicación en tiempo real
- **Row Level Security (RLS)** - Seguridad de datos

### **Librerías Destacadas**
- `@supabase/supabase-js` - Cliente Supabase
- `expo-linear-gradient` - Gradientes visuales
- `expo-print` - Generación de PDFs
- `jspdf` - PDFs avanzados
- `react-native-svg` - Gráficos vectoriales

---

## 📦 Requisitos Previos

Antes de comenzar, asegúrate de tener instalado:

- **Node.js** >= 18.x
- **npm** o **yarn**
- **Expo CLI**: `npm install -g expo-cli`
- **Cuenta de Supabase** (para backend)
- **Expo Go** (app móvil para testing)

---

## 🔧 Instalación

### 1. **Clonar el repositorio**
```bash
git clone https://github.com/nexiisin/AsambleaAPP1.git
cd AsambleaAPP1/asamblea-app
```

### 2. **Instalar dependencias**
```bash
npm install
```

### 3. **Configurar variables de entorno**

Crea un archivo `.env` en la raíz del proyecto:

```env
EXPO_PUBLIC_SUPABASE_URL=tu_url_supabase
EXPO_PUBLIC_SUPABASE_ANON_KEY=tu_clave_anonima
```

> **Nota**: Obtén estas credenciales desde tu proyecto en [Supabase Dashboard](https://app.supabase.com)

### 4. **Configurar base de datos**

Ejecuta las funciones RPC en el SQL Editor de Supabase:

```bash
# 1. Ejecuta: rpc-registrar-voto.sql
# 2. Ejecuta: rpc-estadisticas-propuesta.sql
```

Estas funciones optimizan las operaciones de votación y estadísticas.

### 5. **Iniciar la aplicación**

```bash
npm start
```

Opciones:
- **Móvil**: Escanea el QR con Expo Go
- **Web**: Presiona `w` en la terminal
- **iOS Simulator**: Presiona `i`
- **Android Emulator**: Presiona `a`

---

## 📁 Estructura del Proyecto

```
asamblea-app/
├── app/                          # Pantallas de la aplicación
│   ├── admin/                    # Módulo administrativo
│   │   ├── asamblea.tsx          # Panel principal admin
│   │   ├── asistentes.tsx        # Lista de asistentes
│   │   ├── apoderados.tsx        # Gestión de apoderados
│   │   ├── cronometro.tsx        # Control de tiempo
│   │   ├── propuestas.tsx        # CRUD de propuestas
│   │   └── resultados.tsx        # Visualización resultados
│   ├── residente/                # Módulo residente
│   │   ├── asistencia.tsx        # Formulario de ingreso
│   │   ├── sala-espera.tsx       # Sala de espera con quórum
│   │   ├── votacion.tsx          # Pantalla de votación
│   │   └── resultados.tsx        # Ver resultados
│   ├── pqrs/                     # Módulo PQRS
│   ├── _layout.tsx               # Layout raíz
│   └── index.tsx                 # Pantalla inicial
├── src/
│   ├── components/               # Componentes reutilizables
│   ├── contexts/                 # Context providers
│   ├── hooks/                    # Custom hooks
│   ├── services/                 # Servicios (Supabase, PDFs)
│   ├── theme/                    # Estilos globales
│   └── utils/                    # Utilidades
├── assets/                       # Imágenes y recursos
├── constants/                    # Constantes de la app
├── rpc-registrar-voto.sql       # Función RPC votación
├── rpc-estadisticas-propuesta.sql # Función RPC estadísticas
├── ANALISIS_ESCALABILIDAD.md    # Documentación técnica
└── package.json                  # Dependencias
```

---

## ⚡ Optimizaciones Implementadas

La aplicación ha sido optimizada para soportar **164 usuarios concurrentes** con las siguientes mejoras:

### **Priority 1: Fundamentos de Escalabilidad** ✅
- **Debounce en recargas**: Evita cascadas de queries al registrar usuarios
- **Eliminación de polling**: Cálculos locales en lugar de consultas cada 1 segundo
- **Queries optimizadas**: JOINs para reducir N+1 queries

**Resultado**: 164 registros en 1.62s (101 reg/seg), 0% errores

### **Priority 2: Votación con RPC** ✅
- **Función RPC `registrar_voto()`**: Operación atómica con deduplicación
- **Reducción de queries**: De 3 queries por voto → 1 RPC call

**Resultado**: 164 votos en 1.01s (163 votos/seg), 0% errores

### **Priority 3: Panel Admin & Reportes** ✅
- **Debounce en AdminAsamblea**: 492 queries → ~150 queries (69% reducción)
- **RPC estadísticas**: 3 queries → 1 RPC por vista (66% reducción)
- **PDF optimizado**: 10 queries → 1 query (90% reducción)

**Impacto total**: Reducción del 66% en queries globales

---

## 📜 Scripts Disponibles

```bash
# Desarrollo
npm start              # Inicia Expo en modo desarrollo
npm run android        # Inicia en Android
npm run ios            # Inicia en iOS
npm run web            # Inicia en navegador

# Utilidades
npm run lint           # Ejecuta ESLint
npm run reset-project  # Resetea el proyecto (limpia cache)
npm run stress:web -- --asamblea-id <UUID> --users 164 --ramp-seconds 15
```

### Prueba de estrés web (164 usuarios)

El comando `stress:web` simula el flujo completo de asamblea para web:

1. Validación de asamblea por cada usuario
2. Registro concurrente de asistencia
3. Consultas de sala de espera
4. Creación e inicio de votación (admin)
5. Emisión de votos concurrentes por RPC
6. Cierre de votación y publicación de resultados (admin)
7. Consulta concurrente de resultados
8. Registro de salida de asistentes

Ejemplos:

```bash
# Por ID de asamblea
npm run stress:web -- --asamblea-id 00000000-0000-0000-0000-000000000000 --users 164 --ramp-seconds 15

# Por código de acceso
npm run stress:web -- --codigo A1234 --users 164

# Sin parámetros (crea asamblea automática de prueba)
npm run stress:web -- --users 164

# Ejecutar y limpiar datos creados por la prueba
npm run stress:web -- --asamblea-id <UUID> --cleanup true
```

Variables requeridas en `.env`:

```env
EXPO_PUBLIC_SUPABASE_URL=...
# Recomendado para pruebas de carga con acciones admin/RPC
SUPABASE_SERVICE_ROLE_KEY=...

# Alternativa (puede fallar por RLS/permisos en algunos flujos)
EXPO_PUBLIC_SUPABASE_ANON_KEY=...
```

El script genera un reporte en `reports/stress-report-*.json` con latencias `p50/p95`, tasa de éxito y fallos por operación.

---

## 🗄️ Base de Datos

### Tablas Principales

- **asambleas**: Gestión de asambleas
- **viviendas**: Registro de propiedades
- **propietarios**: Información de dueños
- **asistencias**: Registro de asistentes
- **propuestas**: Propuestas de votación
- **votos**: Votos registrados

### Funciones RPC

1. **`registrar_voto()`**: Registra votos de forma atómica
2. **`obtener_estadisticas_propuesta()`**: Obtiene conteos de votos
3. **`iniciar_votacion()`**: Abre votación de propuesta
4. **`cerrar_votacion()`**: Cierra y calcula resultados
5. **`mostrar_resultados()`**: Publica resultados a residentes

---

## 🚀 Despliegue

### **Expo EAS Build**

```bash
# Instalar EAS CLI
npm install -g eas-cli

# Configurar proyecto
eas build:configure

# Build para producción
eas build --platform android --profile production
eas build --platform ios --profile production
```

### **Requisitos de Producción**

- [ ] Supabase configurado con RPC functions
- [ ] Variables de entorno en producción
- [ ] Políticas RLS activadas
- [ ] Índices de base de datos optimizados
- [ ] Plan Supabase Pro (para 164+ usuarios)

---

## 📊 Rendimiento Validado

| Operación | Tiempo | Throughput | Errores |
|-----------|--------|------------|---------|
| **164 registros simultáneos** | 1.62s | 101 reg/seg | 0% |
| **164 votos simultáneos** | 1.01s | 163 votos/seg | 0% |
| **Vista de resultados (5 admins)** | <1s | N/A | 0% |
| **Generación PDF Acta** | 2-3s | N/A | 0% |

---

## 🤝 Contribución

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/nueva-funcionalidad`)
3. Commit tus cambios (`git commit -m 'feat: Agrega nueva funcionalidad'`)
4. Push a la rama (`git push origin feature/nueva-funcionalidad`)
5. Abre un Pull Request

---

## 📝 Licencia

Este proyecto es privado y pertenece a **Altos del Guali**.

---

## 👨‍💻 Autor

**Desarrollado por**: nexiisin  
**Fecha última actualización**: Febrero 5, 2026  
**Versión**: 1.0.0

---

## 📞 Soporte

Para reportar bugs o solicitar nuevas funcionalidades, abre un [issue](https://github.com/nexiisin/AsambleaAPP1/issues).

---

<div align="center">

**⭐ Si este proyecto te fue útil, considera darle una estrella ⭐**

</div>

