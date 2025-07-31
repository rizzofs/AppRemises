# App Remises - Sistema de Gestión

Sistema web completo para la gestión de remiserías con autenticación de usuarios administradores y dueños.

## 🚀 Características

### Autenticación y Seguridad
- ✅ Login con JWT y refresh tokens
- ✅ Roles diferenciados (Admin y Dueño)
- ✅ Protección de rutas por rol
- ✅ Encriptación de contraseñas con bcrypt

### Panel de Administrador
- ✅ Dashboard con estadísticas
- ✅ CRUD completo de Remiserías
- ✅ Gestión de Dueños (crear, editar, activar/desactivar)
- ✅ Asociación de dueños a remiserías
- ✅ Visualización de todas las remiserías y sus dueños

### Panel de Dueño
- ✅ Dashboard personalizado
- ✅ Acceso solo a sus remiserías asociadas
- ✅ Edición de información personal
- ✅ Visualización de remiserías compartidas

## 🛠️ Tecnologías

### Backend
- **Node.js** con Express
- **TypeScript** para tipado estático
- **PostgreSQL** como base de datos
- **Prisma** como ORM
- **JWT** para autenticación
- **bcryptjs** para encriptación

### Frontend
- **Next.js 14** con App Router
- **TypeScript** para tipado estático
- **TailwindCSS** para estilos
- **React Hook Form** para formularios
- **Lucide React** para iconos
- **React Hot Toast** para notificaciones

## 📋 Requisitos Previos

- Node.js 18+ 
- PostgreSQL 12+
- npm o yarn

## 🚀 Instalación

### 1. Clonar el repositorio
```bash
git clone <url-del-repositorio>
cd AppRemises
```

### 2. Instalar dependencias
```bash
npm run install:all
```

### 3. Configurar base de datos

#### Crear base de datos PostgreSQL
```sql
CREATE DATABASE app_remises;
```

#### Configurar variables de entorno
```bash
# Copiar archivo de ejemplo
cp backend/env.example backend/.env

# Editar variables de entorno
nano backend/.env
```

Configurar las siguientes variables en `backend/.env`:
```env
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/app_remises"

# JWT
JWT_SECRET="your-super-secret-jwt-key-here"
JWT_REFRESH_SECRET="your-super-secret-refresh-key-here"
JWT_EXPIRES_IN="15m"
JWT_REFRESH_EXPIRES_IN="7d"

# Server
PORT=3001
NODE_ENV="development"

# CORS
FRONTEND_URL="http://localhost:3000"
```

### 4. Configurar base de datos
```bash
# Generar cliente de Prisma
npm run db:generate

# Crear tablas en la base de datos
npm run db:push
```

### 5. Crear usuario administrador inicial
```bash
# Ejecutar script para crear admin
cd backend
npx ts-node scripts/create-admin.ts
```

## 🏃‍♂️ Ejecutar el proyecto

### Desarrollo
```bash
# Ejecutar backend y frontend simultáneamente
npm run dev

# O ejecutar por separado
npm run dev:backend  # Puerto 3001
npm run dev:frontend # Puerto 3000
```

### Producción
```bash
# Construir ambos proyectos
npm run build

# Ejecutar en producción
npm start
```

## 📱 Uso del Sistema

### 1. Acceso inicial
- URL: `http://localhost:3000`
- El sistema redirigirá automáticamente a `/login`

### 2. Login como Administrador
- Email: `admin@appremises.com`
- Contraseña: `admin123`

### 3. Funcionalidades del Administrador
- **Dashboard**: Estadísticas generales del sistema
- **Gestionar Remiserías**: CRUD completo de remiserías
- **Gestionar Dueños**: Crear y administrar dueños
- **Nueva Remisería**: Crear nuevas remiserías
- **Nuevo Dueño**: Registrar nuevos dueños

### 4. Login como Dueño
- Usar las credenciales creadas por el administrador
- Acceso limitado a sus remiserías asociadas

## 🗄️ Estructura de la Base de Datos

### Tablas principales:
- **users**: Usuarios del sistema (admin/duenio)
- **duenios**: Información de los dueños
- **remiserias**: Información de las remiserías
- **remiseria_duenio**: Tabla intermedia para relación N:M

### Relaciones:
- User ↔ Duenio (1:1)
- Remiseria ↔ Duenio (N:M)

## 🔧 Scripts Disponibles

```bash
# Desarrollo
npm run dev                    # Ejecutar ambos servicios
npm run dev:frontend          # Solo frontend
npm run dev:backend           # Solo backend

# Base de datos
npm run db:generate           # Generar cliente Prisma
npm run db:push              # Sincronizar esquema
npm run db:studio            # Abrir Prisma Studio

# Construcción
npm run build                # Construir ambos proyectos
npm run build:frontend       # Solo frontend
npm run build:backend        # Solo backend
```

## 🛡️ Seguridad

- **JWT Tokens**: Autenticación segura con refresh tokens
- **bcrypt**: Encriptación de contraseñas
- **Helmet**: Headers de seguridad
- **Rate Limiting**: Protección contra ataques de fuerza bruta
- **CORS**: Configuración de origen permitido
- **Validación**: Validación de datos en frontend y backend

## 📁 Estructura del Proyecto

```
AppRemises/
├── backend/                 # API REST con Express
│   ├── src/
│   │   ├── controllers/    # Controladores de la API
│   │   ├── middleware/     # Middlewares de autenticación
│   │   ├── routes/         # Rutas de la API
│   │   ├── types/          # Tipos TypeScript
│   │   └── lib/            # Utilidades (Prisma, etc.)
│   ├── prisma/             # Esquema de base de datos
│   └── package.json
├── frontend/               # Aplicación Next.js
│   ├── app/               # Páginas y componentes
│   ├── contexts/          # Contextos de React
│   ├── lib/               # Servicios de API
│   ├── types/             # Tipos TypeScript
│   └── package.json
└── package.json           # Scripts del proyecto principal
```

## 🚀 Despliegue

### Variables de entorno para producción:
```env
NODE_ENV=production
DATABASE_URL="postgresql://..."
JWT_SECRET="..."
JWT_REFRESH_SECRET="..."
FRONTEND_URL="https://tu-dominio.com"
```

### Comandos de despliegue:
```bash
# Instalar dependencias
npm run install:all

# Construir para producción
npm run build

# Ejecutar en producción
npm start
```

## 🤝 Contribución

1. Fork el proyecto
2. Crear una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abrir un Pull Request

## 📄 Licencia

Este proyecto está bajo la Licencia MIT - ver el archivo [LICENSE](LICENSE) para detalles.

## 🆘 Soporte

Si tienes problemas o preguntas:
1. Revisa la documentación
2. Verifica que todas las dependencias estén instaladas
3. Asegúrate de que PostgreSQL esté corriendo
4. Verifica las variables de entorno

## 🔄 Actualizaciones

Para actualizar el proyecto:
```bash
git pull origin main
npm run install:all
npm run db:push
npm run dev
``` 