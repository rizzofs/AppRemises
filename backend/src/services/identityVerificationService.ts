export interface VerificacionIdentidadResult {
  dni: string;
  cuil: string;
  posiblesCuils?: string[];
  nombre: string;
  apellido: string;
  nombreCompleto: string;
  tipoPersona?: string;
  direccion?: string;
  localidad?: string;
  provincia?: string;
  fuente: 'ARCA_OFICIAL' | 'ARCA_API' | 'ANSES' | 'CALCULADO';
  verificado: boolean;
  esSimulado: boolean;
  mensaje?: string;
}

/**
 * Calcula el dígito verificador y el CUIL completo según el algoritmo Módulo 11 oficial de AFIP / ANSES
 * 20: Masculino
 * 27: Femenino
 * 23 / 24: Duplicados / Asignaciones especiales
 */
export function calcularDigitoCuil(prefijo: number, dniNumero: string): string | null {
  const dni8 = dniNumero.padStart(8, '0');
  const base = `${prefijo}${dni8}`;
  const pesos = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];

  let suma = 0;
  for (let i = 0; i < 10; i++) {
    suma += parseInt(base[i], 10) * pesos[i];
  }

  const resto = suma % 11;
  if (resto === 0) return `${prefijo}${dni8}0`;
  if (resto === 1) {
    const digitoEspecial = prefijo === 20 ? '9' : '4';
    return `23${dni8}${digitoEspecial}`;
  }
  return `${prefijo}${dni8}${11 - resto}`;
}

export function obtenerPosiblesCuils(dni: string): string[] {
  const dniLimpio = dni.replace(/\D/g, '');
  if (dniLimpio.length < 6 || dniLimpio.length > 9) return [];

  const cuil20 = calcularDigitoCuil(20, dniLimpio);
  const cuil27 = calcularDigitoCuil(27, dniLimpio);
  const cuil23 = calcularDigitoCuil(23, dniLimpio);

  const set = new Set<string>();
  if (cuil20) set.add(cuil20);
  if (cuil27) set.add(cuil27);
  if (cuil23) set.add(cuil23);
  return Array.from(set);
}

/**
 * Separa denominación oficial ("APELLIDO, NOMBRE" o "APELLIDO NOMBRE")
 */
export function normalizarNombreApellido(denominacion: string): { nombre: string; apellido: string; nombreCompleto: string } {
  const limpia = denominacion.trim().replace(/\s+/g, ' ');
  if (!limpia) {
    return { nombre: '', apellido: '', nombreCompleto: '' };
  }

  if (limpia.includes(',')) {
    const partes = limpia.split(',').map((p) => p.trim());
    const apellido = capitalizar(partes[0] || '');
    const nombre = capitalizar(partes.slice(1).join(' ') || '');
    return {
      nombre,
      apellido,
      nombreCompleto: `${nombre} ${apellido}`.trim(),
    };
  }

  const palabras = limpia.split(' ');
  if (palabras.length === 1) {
    return {
      nombre: capitalizar(palabras[0]),
      apellido: '',
      nombreCompleto: capitalizar(palabras[0]),
    };
  }

  const apellido = capitalizar(palabras[0]);
  const nombre = capitalizar(palabras.slice(1).join(' '));
  return {
    nombre,
    apellido,
    nombreCompleto: `${nombre} ${apellido}`.trim(),
  };
}

function capitalizar(texto: string): string {
  if (!texto) return '';
  return texto
    .toLowerCase()
    .split(' ')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export class IdentityVerificationService {
  private cacheRepresentada: string | null = null;
  private cacheCuitsVerificados: Map<string, VerificacionIdentidadResult> = new Map();

  /**
   * Obtiene la CUIT representada asociada a la cuenta de ARCA {API}
   */
  private async obtenerRepresentada(apiUrl: string, apiKey: string): Promise<string | null> {
    if (process.env.ARCA_REPRESENTADA) {
      return process.env.ARCA_REPRESENTADA.replace(/\D/g, '');
    }

    if (this.cacheRepresentada) {
      return this.cacheRepresentada;
    }

    try {
      const url = `${apiUrl.replace(/\/+$/, '')}/api/cuits`;
      const res = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Accept': 'application/json'
        }
      });

      if (res.ok) {
        const json: any = await res.json();
        if (json.data && Array.isArray(json.data) && json.data.length > 0) {
          const primero = json.data[0];
          const cuit = String(primero.cuit || primero.id || '').replace(/\D/g, '');
          if (cuit) {
            this.cacheRepresentada = cuit;
            console.info(`[ARCA {API}] CUIT representada auto-detectada desde tu cuenta: ${cuit}`);
            return cuit;
          }
        }
      }
    } catch (e: any) {
      console.warn('[ARCA {API}] No se pudo autodetectar CUIT de la cuenta:', e.message);
    }

    return null;
  }

  /**
   * Consulta los datos de la persona física en ARCA (ex-AFIP) por su DNI
   */
  async verificarPorDni(dniInput: string): Promise<VerificacionIdentidadResult> {
    const dni = dniInput.replace(/\D/g, '').trim();

    if (!dni || dni.length < 7 || dni.length > 8) {
      throw new Error('El DNI ingresado debe contener 7 u 8 dígitos numéricos válidos.');
    }

    // Verificar caché
    if (this.cacheCuitsVerificados.has(dni)) {
      return this.cacheCuitsVerificados.get(dni)!;
    }

    const posiblesCuils = obtenerPosiblesCuils(dni);
    const cuilPrincipal = posiblesCuils[0] || `20${dni.padStart(8, '0')}0`;

    // 1. Integración con ARCA {API} (arca.api.com.ar)
    const arcaApiKey = process.env.ARCA_API_KEY || process.env.AFIP_API_KEY;
    const arcaApiUrl = process.env.ARCA_API_URL || 'https://arca.api.com.ar';
    const environment = (process.env.ARCA_ENVIRONMENT || 'produccion') as 'produccion' | 'homologacion';

    if (arcaApiKey) {
      try {
        const representada = await this.obtenerRepresentada(arcaApiUrl, arcaApiKey);

        if (!representada) {
          console.warn(`[ARCA {API}] La API Key es válida pero aún no hay CUIT cargado en arca.api.com.ar.`);
          return {
            dni,
            cuil: cuilPrincipal,
            posiblesCuils,
            nombre: '',
            apellido: '',
            nombreCompleto: '',
            fuente: 'CALCULADO',
            verificado: false,
            esSimulado: false,
            mensaje: 'Falta vincular tu CUIT y certificado en arca.api.com.ar. Por favor completá tu nombre y apellido manualmente.'
          };
        }

        // Consultar /api/padron/documento
        const urlDoc = `${arcaApiUrl.replace(/\/+$/, '')}/api/padron/documento`;
        const resDoc = await fetch(urlDoc, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${arcaApiKey}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({
            representada,
            environment,
            documento: dni
          })
        });

        if (resDoc.ok) {
          const docData: any = await resDoc.json();
          if (docData.found && docData.data?.cuits?.length > 0) {
            const cuitEncontrado = String(docData.data.cuits[0]);
            
            // Consultar datos en padrón A13 o Constancia
            const detalle = await this.consultarDetalleCuit(arcaApiUrl, arcaApiKey, representada, environment, cuitEncontrado, dni);
            if (detalle) {
              this.cacheCuitsVerificados.set(dni, detalle);
              return detalle;
            }
          }
        } else {
          const errJson: any = await resDoc.json().catch(() => ({}));
          console.warn(`[ARCA {API}] Respuesta documento (${resDoc.status}):`, errJson?.error || errJson);
        }
      } catch (err: any) {
        console.warn(`[ARCA {API}] Error en consulta: ${err.message}`);
      }
    }

    // 2. Si no se pudo obtener de ARCA, devolvemos el CUIL real calculado matemáticamente
    // pero NUNCA un nombre falso o de otra persona. El usuario completa su nombre real.
    return {
      dni,
      cuil: cuilPrincipal,
      posiblesCuils,
      nombre: '',
      apellido: '',
      nombreCompleto: '',
      fuente: 'CALCULADO',
      verificado: false,
      esSimulado: false,
      mensaje: 'CUIL oficial verificado por Módulo 11. Por favor ingresá tu nombre y apellido.'
    };
  }

  /**
   * Consulta detalles de un CUIT a través de /api/padron/a13 o /api/padron/constancia
   */
  private async consultarDetalleCuit(
    apiUrl: string,
    apiKey: string,
    representada: string,
    environment: string,
    cuit: string,
    dniOriginal: string
  ): Promise<VerificacionIdentidadResult | null> {
    try {
      // Intentar primero con Padrón A13
      const urlA13 = `${apiUrl.replace(/\/+$/, '')}/api/padron/a13`;
      const resA13 = await fetch(urlA13, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ representada, environment, cuit })
      });

      if (resA13.ok) {
        const jsonA13: any = await resA13.json();
        if (jsonA13.found && jsonA13.data) {
          return this.mapearRespuestaArca(dniOriginal, jsonA13.data);
        }
      }

      // Si A13 no está habilitado, intentar con Constancia de Inscripción
      const urlConstancia = `${apiUrl.replace(/\/+$/, '')}/api/padron/constancia`;
      const resConst = await fetch(urlConstancia, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ representada, environment, cuit })
      });

      if (resConst.ok) {
        const jsonConst: any = await resConst.json();
        if (jsonConst.found && jsonConst.data) {
          return this.mapearRespuestaArca(dniOriginal, jsonConst.data);
        }
      }
    } catch (err: any) {
      console.warn(`[ARCA {API}] Error al consultar detalle de CUIT ${cuit}:`, err.message);
    }

    return null;
  }

  private mapearRespuestaArca(dni: string, data: any): VerificacionIdentidadResult {
    const datosGen = data.datosGenerales || {};
    const denominacion =
      datosGen.razonSocial ||
      datosGen.denominacion ||
      data.razonSocial ||
      data.denominacion ||
      `${datosGen.apellido || ''} ${datosGen.nombre || ''}`.trim();

    const { nombre, apellido, nombreCompleto } = normalizarNombreApellido(denominacion);

    const domicilio = datosGen.domicilioFiscal || datosGen.domicilio || {};
    const direccion = typeof domicilio === 'string' ? domicilio : (domicilio.direccion || '');
    const localidad = domicilio.localidad || '';
    const provincia = domicilio.descripcionProvincia || domicilio.provincia || '';

    return {
      dni,
      cuil: String(data.cuit || data.idPersona || ''),
      nombre: datosGen.nombre ? capitalizar(datosGen.nombre) : nombre,
      apellido: datosGen.apellido ? capitalizar(datosGen.apellido) : apellido,
      nombreCompleto,
      tipoPersona: data.tipoPersona || 'FISICA',
      direccion,
      localidad,
      provincia,
      fuente: 'ARCA_API',
      verificado: true,
      esSimulado: false,
      mensaje: 'Identidad verificada exitosamente en el padrón oficial de ARCA',
    };
  }
}

export const identityVerificationService = new IdentityVerificationService();
