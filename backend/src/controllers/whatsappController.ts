import { Request, Response } from 'express';
import { whatsappBotService } from '../services/whatsappBotService';

// ==============================================================================
// CONTROLADOR DE WEBHOOKS DE WHATSAPP (META CLOUD API)
// ==============================================================================

export const whatsappController = {
  /**
   * Endpoint de verificación inicial requerido por Meta (Handshake)
   * GET /api/webhook/whatsapp
   */
  async verificarWebhook(req: Request, res: Response) {
    try {
      const mode = req.query['hub.mode'];
      const token = req.query['hub.verify_token'];
      const challenge = req.query['hub.challenge'];

      const VERIFY_TOKEN =
        process.env.WHATSAPP_VERIFY_TOKEN || 'remises_bruno_meta_webhook_2026';

      if (mode === 'subscribe' && token === VERIFY_TOKEN) {
        console.log('✅ Webhook de Meta WhatsApp verificado correctamente.');
        return res.status(200).send(challenge);
      } else {
        console.warn('⚠️ Intento de verificación de Webhook con token inválido:', token);
        return res.status(403).send('Forbidden');
      }
    } catch (error: any) {
      console.error('Error en verificarWebhook:', error);
      return res.status(500).send('Error');
    }
  },

  /**
   * Receptor de eventos y mensajes entrantes de WhatsApp
   * POST /api/webhook/whatsapp
   */
  async recibirWebhook(req: Request, res: Response) {
    // 1. Responder de inmediato 200 OK a Meta para evitar reintentos o timeouts
    res.status(200).send('EVENT_RECEIVED');

    try {
      const body = req.body;

      // Validar si es un evento de WhatsApp Business API
      if (body.object !== 'whatsapp_business_account') {
        return;
      }

      const entries = body.entry || [];
      for (const entry of entries) {
        const changes = entry.changes || [];
        for (const change of changes) {
          if (change.field !== 'messages') continue;

          const value = change.value;
          if (!value || !value.messages || value.messages.length === 0) continue;

          const senderContact = value.contacts?.[0];
          const senderName = senderContact?.profile?.name || undefined;

          for (const msg of value.messages) {
            const from = msg.from;
            const messageId = msg.id;
            const msgType = msg.type;

            let tipo: 'text' | 'interactive' | 'location' | 'audio' = 'text';
            let texto: string | undefined;
            let botonId: string | undefined;
            let location: { latitude: number; longitude: number; name?: string; address?: string } | undefined;
            let audioId: string | undefined;

            if (msgType === 'text') {
              tipo = 'text';
              texto = msg.text?.body;
            } else if (msgType === 'interactive') {
              tipo = 'interactive';
              if (msg.interactive?.type === 'button_reply') {
                botonId = msg.interactive.button_reply?.id;
                texto = msg.interactive.button_reply?.title;
              } else if (msg.interactive?.type === 'list_reply') {
                botonId = msg.interactive.list_reply?.id;
                texto = msg.interactive.list_reply?.title;
              }
            } else if (msgType === 'location') {
              tipo = 'location';
              location = {
                latitude: msg.location?.latitude,
                longitude: msg.location?.longitude,
                name: msg.location?.name,
                address: msg.location?.address,
              };
            } else if (msgType === 'audio' || msgType === 'voice') {
              tipo = 'audio';
              audioId = msg.audio?.id || msg.voice?.id;
            }

            // Procesar en segundo plano con el servicio del bot
            whatsappBotService
              .procesarMensaje({
                from,
                messageId,
                tipo,
                texto,
                botonId,
                location,
                audioId,
                senderName,
              })
              .catch((err) => {
                console.error(`Error procesando mensaje de WhatsApp de ${from}:`, err);
              });
          }
        }
      }
    } catch (error: any) {
      console.error('Error procesando payload de WhatsApp Webhook:', error);
    }
  },
};
