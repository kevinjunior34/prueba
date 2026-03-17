import { supabase } from "./supabase";
import { asignarTecnicoAuto } from "./Tecnico";

// ──────────────────────────────────────────────
//  Bot mejorado con Claude AI (Anthropic API)
// ──────────────────────────────────────────────

const SYSTEM_PROMPT = `Eres un asistente técnico virtual del hospital. Tu trabajo es ayudar al personal hospitalario a resolver problemas técnicos con equipos médicos y sistemas informáticos.

EQUIPOS QUE MANEJAS:
- Monitores de signos vitales / ECG
- Bombas de infusión / perfusoras
- Ventiladores mecánicos / respiradores
- Desfibriladores / cardioversores
- Equipos de rayos X / tomografía / resonancia (PACS)
- Sistema HIM (historia clínica electrónica / expediente)
- Impresoras (pulseras, etiquetas, recetas)
- Red / internet / wifi
- Suministro eléctrico / equipos sin corriente

INSTRUCCIONES:
1. Responde SIEMPRE en español, de manera concisa y clara.
2. Da UNA solución concreta por mensaje, numerada si es un paso a paso.
3. Después de cada solución, pregunta si funcionó (ej: "¿Funcionó esta solución? Responde SI o NO").
4. Si el usuario responde SI: felicítalo brevemente y cierra la conversación.
5. Si el usuario responde NO: ofrece la siguiente solución alternativa.
6. Después de 3 intentos fallidos, indica que escalarás con un técnico humano.
7. Si el problema no es técnico de equipo/sistema, explícalo amablemente y redirige.
8. Mantén un tono profesional pero cercano. Usa emojis con moderación (🔧 ✅ ⚠️).
9. Sé BREVE. Máximo 4-5 líneas por respuesta.
10. NUNCA inventes especificaciones técnicas que no conoces.`;

// ── Llamada a la API de Claude ──
async function llamarClaude(mensajes) {
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        system: SYSTEM_PROMPT,
        messages: mensajes
      })
    });

    if (!response.ok) throw new Error(`API error: ${response.status}`);
    const data = await response.json();
    return data.content?.[0]?.text || null;
  } catch (error) {
    console.error("Error llamando a Claude:", error);
    return null;
  }
}

// ── Sesión del bot ──
class SesionBot {
  constructor(ticketId, ticketTitulo, usuarioId) {
    this.ticketId = ticketId;
    this.ticketTitulo = ticketTitulo;
    this.usuarioId = usuarioId;
    this.intentos = 0;
    this.maxIntentos = 3;
    this.historialChat = [];
    this.resuelto = false;
    this.escalado = false;
    this.activo = true;
  }

  async iniciar() {
    const mensaje = `🏥 **Asistente Virtual del Hospital**\n\nHola, soy el asistente técnico virtual. ¿En qué puedo ayudarte?\n\nDescribe el problema o el equipo que presenta fallas y te guiaré paso a paso.`;
    await this.guardarMensaje("bot", mensaje);
    return mensaje;
  }

  async procesarMensaje(mensajeUsuario) {
    if (!this.activo) {
      return "La conversación ha finalizado. Si tienes otro problema, crea un nuevo ticket.";
    }

    const mensajeNorm = mensajeUsuario.trim();
    await this.guardarMensaje("usuario", mensajeNorm);

    if (this.historialChat.length > 0 && this._esResuelto(mensajeNorm)) {
      return this._cerrarResuelto();
    }

    this.historialChat.push({ role: "user", content: mensajeNorm });

    const respuestaClaude = await llamarClaude(this.historialChat);

    if (!respuestaClaude) {
      this.intentos++;
      if (this.intentos >= this.maxIntentos) return this._escalarTecnico();
      const fallback = "⚠️ Estoy teniendo dificultades. ¿Podrías describir el problema con más detalle?";
      await this.guardarMensaje("bot", fallback);
      return fallback;
    }

    this.historialChat.push({ role: "assistant", content: respuestaClaude });

    if (this._debeEscalar(respuestaClaude)) {
      await this.guardarMensaje("bot", respuestaClaude);
      return this._escalarTecnico(respuestaClaude);
    }

    if (this._esNegativo(mensajeNorm)) {
      this.intentos++;
      if (this.intentos >= this.maxIntentos) return this._escalarTecnico();
    }

    await this.guardarMensaje("bot", respuestaClaude);
    return respuestaClaude;
  }

  _esResuelto(msg) {
    const m = msg.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return ["si", "sí", "funciono", "funcionó", "ok", "listo", "resuelto", "gracias"].some(p => m === p || m.startsWith(p + " ") || m.endsWith(" " + p));
  }

  _esNegativo(msg) {
    const m = msg.toLowerCase();
    return ["no", "nope", "tampoco", "nada", "sigue", "igual"].some(p => m === p || m.startsWith(p + " "));
  }

  _debeEscalar(respuesta) {
    const r = respuesta.toLowerCase();
    return r.includes("escal") || r.includes("técnico humano") || r.includes("soporte presencial");
  }

  async _cerrarResuelto() {
    this.resuelto = true;
    this.activo = false;
    await supabase.from("tickets").update({ resuelto_por_bot: true, fecha_resolucion_bot: new Date().toISOString() }).eq("id_ticket", this.ticketId);
    const msgs = ["✅ ¡Perfecto! Me alegra que se haya resuelto. Que tengas un excelente día.", "✅ ¡Qué bien! Problema solucionado. Quedo a tus órdenes.", "✅ El ticket quedará cerrado como resuelto. ¡Hasta pronto!"];
    const respuesta = msgs[Math.floor(Math.random() * msgs.length)];
    await this.guardarMensaje("bot", respuesta);
    return respuesta;
  }

  async _escalarTecnico(mensajePrevio = null) {
    this.escalado = true;
    this.activo = false;
    const tecnico = await asignarTecnicoAuto(this.ticketId);
    await supabase.from("tickets").update({ diagnostico_bot: { intentos: this.intentos, escalado: true, historial_resumido: this.historialChat.slice(-4) } }).eq("id_ticket", this.ticketId);

    let respuesta = mensajePrevio ? mensajePrevio + "\n\n" : "⚠️ **No pude resolver el problema de forma automática.**\n\n";
    if (tecnico) {
      respuesta += `✅ He asignado a **${tecnico.nombre}** como técnico especializado.\n\nTe contactará a la brevedad para asistirte personalmente.`;
    } else {
      respuesta += "⚠️ No hay técnicos disponibles en este momento. Un supervisor será notificado.";
    }

    await this.guardarMensaje("bot", respuesta);
    return respuesta;
  }

  estaActivo() { return this.activo; }
  getEstado() { return { activo: this.activo, resuelto: this.resuelto, escalado: this.escalado, intentos: this.intentos }; }

  async guardarMensaje(tipo, contenido) {
    try {
      await supabase.from("historial_ticket").insert([{
        id_ticket: this.ticketId,
        id_usuario: tipo === "bot" ? null : this.usuarioId,
        comentario: contenido,
        fecha: new Date().toISOString()
      }]);
    } catch (error) {
      console.error("Error guardando mensaje:", error);
    }
  }
}

class BotHospital {
  constructor() { this.sesiones = new Map(); }
  getSesion(ticketId, ticketTitulo = "", usuarioId = null) {
    if (!this.sesiones.has(ticketId)) this.sesiones.set(ticketId, new SesionBot(ticketId, ticketTitulo, usuarioId));
    return this.sesiones.get(ticketId);
  }
  cerrarSesion(ticketId) { this.sesiones.delete(ticketId); }
}

export const botHospital = new BotHospital();
