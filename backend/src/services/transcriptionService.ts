import { whatsappService } from './whatsappService';

// ==============================================================================
// SERVICIO DE TRANSCRIPCIÓN DE AUDIO POR IA (WHATSAPP CLOUD API + GROQ WHISPER)
// ==============================================================================

export const transcriptionService = {
  /**
   * Descarga un archivo de audio/voz de WhatsApp desde Meta y lo transcribe con Groq Whisper Large v3
   */
  async transcribirAudioWhatsApp(audioId: string): Promise<string | null> {
    try {
      const WHATSAPP_TOKEN =
        process.env.WHATSAPP_ACCESS_TOKEN ||
        process.env.WHATSAPP_TOKEN ||
        whatsappService.getCredentials().token;

      const GROQ_API_KEY = process.env.GROQ_API_KEY;

      if (!WHATSAPP_TOKEN || !GROQ_API_KEY || !audioId) {
        console.warn(
          `transcribirAudioWhatsApp: Faltan credenciales (Token: ${Boolean(WHATSAPP_TOKEN)}, Groq: ${Boolean(GROQ_API_KEY)}) o audioId: ${audioId}`
        );
        return null;
      }

      console.log(`🎙️ [AudioTranscription] Consultando mediaId ${audioId} en Meta Graph API...`);

      // 1. Obtener URL de descarga del media desde Meta Graph API
      const metaRes = await fetch(`https://graph.facebook.com/v21.0/${audioId}`, {
        headers: {
          Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        },
      });

      if (!metaRes.ok) {
        console.error('Error al obtener URL del audio de Meta:', await metaRes.text());
        return null;
      }

      const metaData = (await metaRes.json()) as { url?: string; mime_type?: string };
      if (!metaData.url) {
        console.warn('Meta no devolvió URL para el audioId:', audioId);
        return null;
      }

      console.log(`🎙️ [AudioTranscription] Descargando binario de audio (${metaData.mime_type})...`);

      // 2. Descargar el archivo binario del audio desde Meta
      const audioRes = await fetch(metaData.url, {
        headers: {
          Authorization: `Bearer ${WHATSAPP_TOKEN}`,
          'User-Agent': 'AppRemises/1.0',
        },
      });

      if (!audioRes.ok) {
        console.error('Error al descargar binario del audio de Meta:', await audioRes.text());
        return null;
      }

      const arrayBuffer = await audioRes.arrayBuffer();
      const mimeType = metaData.mime_type || 'audio/ogg';
      const extension = mimeType.includes('ogg') ? 'ogg' : mimeType.includes('mp4') ? 'm4a' : 'mp3';

      console.log(
        `🎙️ [AudioTranscription] Audio descargado (${arrayBuffer.byteLength} bytes). Enviando a Groq Whisper Large v3...`
      );

      // 3. Enviar a Groq Whisper (whisper-large-v3)
      const formData = new FormData();
      const blob = new Blob([arrayBuffer], { type: mimeType });
      formData.append('file', blob, `audio.${extension}`);
      formData.append('model', 'whisper-large-v3');
      formData.append('language', 'es');
      formData.append('response_format', 'json');
      formData.append('temperature', '0.0');

      const groqRes = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${GROQ_API_KEY}`,
        },
        body: formData,
      });

      if (!groqRes.ok) {
        console.error('Error en API de Groq Whisper:', await groqRes.text());
        return null;
      }

      const groqData = (await groqRes.json()) as { text?: string };
      const texto = (groqData.text || '').trim();

      console.log(`🎙️ [AudioTranscription] Transcripción exitosa: "${texto}"`);
      return texto.length > 0 ? texto : null;
    } catch (error) {
      console.error('Error en transcribirAudioWhatsApp:', error);
      return null;
    }
  },

  /**
   * Limpia frases introductorias habituales en audios de remís para extraer la dirección
   * Ej: "Hola, mandame un auto a Rivadavia 250" -> "Rivadavia 250"
   * Ej: "Estoy en Eustaquia Sánchez 64" -> "Eustaquia Sánchez 64"
   * Ej: "Llevame al Hospital Municipal" -> "Hospital Municipal"
   */
  extraerDireccion(texto: string): string {
    let t = texto.trim();

    // Eliminar saludos y frases de petición iniciales
    t = t.replace(
      /^(hola|buenas|buen d[ií]a|buenas tardes|buenas noches|por favor|che|hola quetal|hola que tal)[,\s]+/gi,
      ''
    );
    t = t.replace(
      /^(mandame|mandanos|m[aá]ndame|enviame|env[ií]ame|necesito|quiero|preciso|solicito|me mand[aá]s|me envi[aá]s|podr[ií]as mandarme|pod[eé]s mandarme)\s+(un\s+)?(remis|rem[ií]s|auto|m[oó]vil|coche|viaje)\s+(a|hacia|para|en)\s+/gi,
      ''
    );
    t = t.replace(/^(estoy\s+en|estamos\s+en|desde|origen|salgo\s+de)\s+/gi, '');
    t = t.replace(/^(llevame|ll[eé]vame|vamos\s+a|vamos\s+al|vamos\s+hacia|para\s+el|para\s+la|hacia\s+el|hacia\s+la|al|a\s+la|a)\s+/gi, '');

    // Eliminar puntos finales o comas sueltas
    t = t.replace(/[.,;!?]+$/, '').trim();

    return t.length >= 3 ? t : texto.trim();
  },
};
