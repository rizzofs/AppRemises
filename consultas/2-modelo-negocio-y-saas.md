# 🏢 Modelo de Negocio y SaaS Multi-tenant

Para comercializar este sistema como un servicio (SaaS) a múltiples agencias de remis, es fundamental estructurar correctamente la separación de datos, la experiencia de usuario de cada marca y los mecanismos de cobro. A continuación, analizamos las opciones y planteamos las dudas clave.

---

## 👥 1. Arquitectura Multi-tenant: ¿Cómo aislamos las agencias?

Actualmente, el sistema utiliza una base de datos única y añade la relación `remiseriaId` en casi todas las tablas (`Chofer`, `Vehiculo`, `Coordinador`, `Viaje`, `Reserva`). Esto se conoce como **Multi-tenancy a nivel de fila (Shared Database, Shared Schema)**.

### Ventajas de este enfoque:
- Fácil de mantener y actualizar (una sola base de datos, un solo backend).
- Menor costo de infraestructura al iniciar.
- Permite que los clientes compartan cuentas o que los choferes puedan trabajar para más de una agencia en el futuro si se requiere.

### Dudas a definir para el Onboarding:
1. **Flujo de Registro de Nuevas Agencias**:
   - Actualmente, el registro en `/register` crea un `DUENIO`. Necesitamos definir si este dueño, al ingresar por primera vez, debe pasar por un asistente de configuración que cree su primera `Remiseria` (Nombre, CUIT, Dirección, Teléfono) y configure sus primeras tarifas básicas.
2. **Subdominios vs. Rutas**:
   - ¿Cómo accederán las agencias a su sistema?
     - **Opción A (Recomendada para Marca Blanca)**: Subdominios dinámicos, ej. `nombreagencia.appremises.com`.
     - **Opción B (Más sencilla)**: URL compartida con inicio de sesión unificado y filtrado automático por el rol del usuario, ej. `app.remises.com`. (Esta es la que parece estar implementada en la navegación actual).
     - **Opción C**: Rutas parametrizadas, ej. `appremises.com/agencia/nombreagencia`.

---

## 💳 2. Monetización y Planes de Suscripción

Para vender el sistema como servicio, el administrador principal (tú) debe poder cobrar a los dueños de las agencias. 

### Propuesta de Planes:
Podemos implementar tres planes estándar para las agencias:
- **Plan Básico**: Hasta 5 vehículos, 1 coordinador, soporte estándar.
- **Plan Profesional**: Hasta 25 vehículos, 3 coordinadores, reportes avanzados, geolocalización básica.
- **Plan Premium**: Vehículos ilimitados, coordinadores ilimitados, soporte 24/7, app móvil personalizada (Whitelabel).

### Implementación Técnica de Límites:
En el backend, cada vez que un dueño intente crear un nuevo chofer, vehículo o coordinador, realizaremos una comprobación contra los límites de su plan:
```typescript
const countVehiculos = await prisma.vehiculo.count({ where: { remiseriaId } });
if (countVehiculos >= planMaxVehiculos) {
  return res.status(400).json({ error: "Límite de vehículos alcanzado para tu plan actual." });
}
```

### Integración de Pasarelas de Pago:
Dado que el mercado objetivo suele ser América Latina (particularmente Argentina por la terminología de "remis"), proponemos integrar:
- **Mercado Pago**: Para pagos recurrentes (suscripciones) con tarjeta de débito/crédito, Rapipago/Pago Fácil o saldo en cuenta.
- **Stripe**: Si se planea vender a nivel internacional.

---

## 🎨 3. Personalización y Marca Blanca (Whitelabel)

Cada agencia querrá que el sistema refleje su identidad visual para transmitir profesionalismo a sus clientes.

### Elementos personalizables por Remisería:
1. **Logotipo y Favicon**: Subidos por el dueño y almacenados en la base de datos (o AWS S3 / Cloudinary).
2. **Paleta de Colores**: Un color primario y secundario que se inyecten dinámicamente como variables CSS en el frontend:
   ```html
   <style>
     :root {
       --color-primary: ${remiseria.colorPrimary || '#3b82f6'};
       --color-secondary: ${remiseria.colorSecondary || '#1d4ed8'};
     }
   </style>
   ```
3. **Dominio Personalizado**: Permitir que agencias premium apunten su propio dominio (ej. `gestion.remisesexpress.com`) a la plataforma.

---

> [!QUESTION]
> **Preguntas para el usuario**:
> 1. ¿Qué esquema de acceso prefieres para las agencias? (¿Subdominios tipo `agencia.tuservicio.com` o una plataforma unificada en un solo dominio principal?) Seguramente sea agencia.rzcore.dev 
> 2. ¿Cuáles serán los límites de cada plan de suscripción que pretendes cobrar a las agencias?
Aún no los definí, pero creo que debería ser  algun valor razonable.
> 3. ¿Deseas automatizar los cobros mediante Mercado Pago / Stripe en esta fase, o prefieres un manejo de habilitación manual de licencias administrado por ti en el panel de `ADMIN`? Si, los voy a automatizar con MP en un futuro.
