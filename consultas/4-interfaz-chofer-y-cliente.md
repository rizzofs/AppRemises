# 🚗 Interfaz del Chofer y Portal del Cliente

Para que el sistema esté verdaderamente completo y listo para comercializarse, las agencias de remis necesitan resolver los dos extremos del servicio: **el chofer** que maneja el vehículo y **el cliente** que solicita el viaje. 

A continuación, planteamos la arquitectura recomendada para estas dos interfaces.

---

## 📱 1. Interfaz Móvil del Chofer (Driver App)

El chofer no necesita ver paneles de estadísticas complejos. Necesita una interfaz móvil sumamente simple, rápida y optimizada para pantallas pequeñas, preferentemente diseñada como una **PWA (Progressive Web App)** para evitar que tengan que descargar una aplicación de la tienda de Google o Apple.

### Funcionalidades Clave del Chofer:
1. **Control de Estado de Turno**:
   - Interruptor de **"Conectado / Desconectado"** (Activa o desactiva la recepción de viajes y el rastreo por GPS).
   - Selector de estado rápido: **🟢 Disponible**, **🔵 En Viaje**, o **🔴 Fuera de Turno**.
2. **Recepción de Viajes**:
   - Alerta visual y sonora a pantalla completa cuando el coordinador le asigna un viaje.
   - Botón para **Aceptar** o **Rechazar** (con temporizador de 30 segundos).
3. **Navegación e Instrucciones**:
   - Dirección de origen y destino del pasajero.
   - Nombre del cliente y botón rápido para llamarlo por teléfono.
   - Enlace directo para abrir la ruta en **Google Maps** o **Waze** instalados en el teléfono.
4. **Estados del Viaje**:
   - Botón interactivo para cambiar el flujo: `Aceptado` ➡️ `Llegué a Origen` ➡️ `Pasajero a Bordo` ➡️ `Finalizar Viaje`.
5. **Transmisión de GPS**:
   - Envío automático de las coordenadas de geolocalización al backend en segundo plano utilizando la API del navegador:
     ```typescript
     navigator.geolocation.watchPosition(
       (position) => {
         socket.emit('actualizar_gps', {
           lat: position.coords.latitude,
           lng: position.coords.longitude
         });
       },
       (error) => console.error(error),
       { enableHighAccuracy: true, maximumAge: 10000 }
     );
     ```

---

## 🧑‍💻 2. Portal de Solicitud de Clientes (Passenger Portal)

El cliente final de la remisería necesita solicitar viajes cómodamente, saber cuánto le va a costar y ver por dónde viene el auto asignado.

### Flujo de Solicitud de Viaje:
1. **Registro e Ingreso Simplificado**:
   - Autenticación mediante Email o Teléfono (idealmente con verificación por código si en el futuro se integra SMS/WhatsApp).
2. **Cotizador de Viaje (Calculadora de Tarifas)**:
   - Entrada de **Dirección de Origen** y **Dirección de Destino** (utilizando autocompletado de direcciones con OpenStreetMap o Google Autocomplete).
   - Cálculo automático del precio estimado basado en la distancia por carretera y la tarifa vigente de la remisería elegida.
3. **Seguimiento del Viaje en Tiempo Real**:
   - Una vez asignado un auto por el coordinador, el cliente puede ver una pantalla con el mapa y un marcador que representa la ubicación del chofer acercándose.
4. **Historial de Viajes y Favoritos**:
   - Listado de viajes pasados para descargar comprobantes de pago o repetir direcciones frecuentes.

---

> [!QUESTION]
> **Preguntas para el usuario**:
> 1. Para la **App del Chofer**, ¿prefieres que creemos una interfaz web responsive dentro del mismo frontend de Next.js (por ejemplo, en la ruta `/chofer/dashboard`) diseñada exclusivamente para celulares, que pueda instalarse como PWA? Si, es necesario
> 2. ¿Cómo imaginas la asignación de viajes? ¿Prefieres que el coordinador asigne manualmente a qué chofer darle cada viaje (modelo tradicional de remisería), o que el sistema busque automáticamente al chofer disponible más cercano por GPS y le ofrezca el viaje (modelo Uber/Cabify)? creo que debe ser hibrida, que el sistema la asigne, pero que el coordinador pueda en caso de requerirlo poder modificarlo. 
Obviamente, necesito que todo lo que pase en el sistema quede en los logs (Para brindarle seguridad a los dueños de agencias.)
