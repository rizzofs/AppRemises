// ==============================================================================
// SERVICIO DE MENSAJERÍA OUTBOUND - META WHATSAPP CLOUD API (NATIVE FETCH)
// ==============================================================================

const GRAPH_API_VERSION = 'v21.0';

export interface WhatsAppButton {
  id: string;
  title: string;
}

export interface WhatsAppListRow {
  id: string;
  title: string;
  description?: string;
}

export interface WhatsAppListSection {
  title: string;
  rows: WhatsAppListRow[];
}

export const whatsappService = {
  getCredentials() {
    const token = process.env.WHATSAPP_ACCESS_TOKEN || process.env.WHATSAPP_TOKEN || '';
    const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID || process.env.WHATSAPP_PHONE_ID || '';
    return { token, phoneId };
  },

  isConfigured(): boolean {
    const { token, phoneId } = this.getCredentials();
    return Boolean(token && phoneId);
  },

  /**
   * Limpia el número de teléfono para el formato internacional de WhatsApp (E.164)
   * ej: +54 9 2346 123456 -> 542346123456 (Quirk de Argentina en Meta API)
   */
  formatearNumero(numero: string): string {
    let clean = numero.replace(/\D/g, '');
    // Quirk de números móviles de Argentina (+54) en Meta Cloud API:
    // Los webhooks entrantes traen 549... (13 dígitos con el prefijo móvil '9').
    // Pero Meta exige que la llamada al API se haga a 54... (sin el 9),
    // y Meta internamente lo mapea a wa_id 549...
    // Si se envía con 549 en sandbox, Meta rechaza con código 131030.
    if (clean.startsWith('549') && clean.length === 13) {
      clean = '54' + clean.slice(3);
    }
    return clean;
  },

  /**
   * Enviar mensaje de texto plano
   */
  async enviarTexto(to: string, texto: string) {
    const cleanTo = this.formatearNumero(to);
    const { token, phoneId } = this.getCredentials();

    if (!this.isConfigured()) {
      console.log(`[WhatsApp Simulado ➔ ${cleanTo}]:\n${texto}`);
      return { success: true, simulated: true };
    }

    try {
      const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneId}/messages`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: cleanTo,
          type: 'text',
          text: {
            preview_url: false,
            body: texto,
          },
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        console.error(`Error enviando WhatsApp a ${cleanTo}:`, data);
        return { success: false, error: data };
      }

      return { success: true, data };
    } catch (error: any) {
      console.error(`Error de red enviando WhatsApp a ${cleanTo}:`, error.message);
      return { success: false, error: error.message };
    }
  },

  /**
   * Enviar mensaje interactivo con hasta 3 botones de respuesta rápida
   */
  async enviarBotones(to: string, texto: string, botones: WhatsAppButton[], header?: string, footer?: string) {
    const cleanTo = this.formatearNumero(to);
    const { token, phoneId } = this.getCredentials();

    if (!this.isConfigured()) {
      const botonesStr = botones.map((b) => `[ ${b.title} ]`).join(' ');
      console.log(`[WhatsApp Simulado Botones ➔ ${cleanTo}]:\n${texto}\nBotones: ${botonesStr}`);
      return { success: true, simulated: true };
    }

    // Meta permite máximo 3 botones por mensaje interactivo
    const botonesFormat = botones.slice(0, 3).map((b) => ({
      type: 'reply',
      reply: {
        id: b.id,
        title: b.title.slice(0, 20), // Máximo 20 caracteres por botón
      },
    }));

    try {
      const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneId}/messages`;
      const payload: any = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: cleanTo,
        type: 'interactive',
        interactive: {
          type: 'button',
          body: { text: texto },
          action: { buttons: botonesFormat },
        },
      };

      if (header) {
        payload.interactive.header = { type: 'text', text: header };
      }
      if (footer) {
        payload.interactive.footer = { text: footer };
      }

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        console.error(`Error enviando botones WhatsApp a ${cleanTo}:`, data);
        // Fallback a texto plano si falla el formato interactivo
        const fallbackTexto = `${texto}\n\nOpciones:\n` + botones.map((b, i) => `${i + 1}. ${b.title}`).join('\n');
        return this.enviarTexto(cleanTo, fallbackTexto);
      }

      return { success: true, data };
    } catch (error: any) {
      console.error(`Error enviando botones WhatsApp a ${cleanTo}:`, error.message);
      const fallbackTexto = `${texto}\n\nOpciones:\n` + botones.map((b, i) => `${i + 1}. ${b.title}`).join('\n');
      return this.enviarTexto(cleanTo, fallbackTexto);
    }
  },

  /**
   * Enviar lista desplegable con secciones y opciones
   */
  async enviarLista(
    to: string,
    bodyText: string,
    buttonTitle: string,
    sections: WhatsAppListSection[],
    headerTitle?: string,
    footerText?: string
  ) {
    const cleanTo = this.formatearNumero(to);
    const { token, phoneId } = this.getCredentials();

    if (!this.isConfigured()) {
      console.log(`[WhatsApp Simulado Lista ➔ ${cleanTo}]:\n${bodyText}`);
      return { success: true, simulated: true };
    }

    try {
      const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneId}/messages`;
      const payload: any = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: cleanTo,
        type: 'interactive',
        interactive: {
          type: 'list',
          body: { text: bodyText },
          action: {
            button: buttonTitle.slice(0, 20),
            sections,
          },
        },
      };

      if (headerTitle) {
        payload.interactive.header = { type: 'text', text: headerTitle };
      }
      if (footerText) {
        payload.interactive.footer = { text: footerText };
      }

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        console.error(`Error enviando lista WhatsApp a ${cleanTo}:`, data);
        return this.enviarTexto(cleanTo, bodyText);
      }

      return { success: true, data };
    } catch (error: any) {
      console.error(`Error enviando lista WhatsApp a ${cleanTo}:`, error.message);
      return this.enviarTexto(cleanTo, bodyText);
    }
  },

  /**
   * Marcar mensaje entrante como leído (doble tilde azul)
   */
  async marcarComoLeido(messageId: string) {
    const { token, phoneId } = this.getCredentials();
    if (!this.isConfigured() || !messageId) return;

    try {
      const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneId}/messages`;
      await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          status: 'read',
          message_id: messageId,
        }),
      });
    } catch {
      // Ignorar errores menores al marcar leído
    }
  },
};
