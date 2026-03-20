import { supabase } from "./supabase.js";
import { asignarTecnicoAuto } from "./Tecnico.js";

const ANTHROPIC_API_KEY = "sk-ant-api03-..."; // ← tu key aquí

const SYSTEM_PROMPT = `Eres un asistente técnico virtual del hospital. Cuando recibas el título y descripción de un ticket técnico, responde EXACTAMENTE con este formato y nada más:

🔧 *Posibles soluciones para tu problema:*

✅ *Solución 1: [título corto]*
1. [paso]
2. [paso]
3. [paso]

✅ *Solución 2: [título corto]*
1. [paso]
2. [paso]

✅ *Solución 3: [título corto]*
1. [paso]
2. [paso]
3. [paso]

¿Alguna de estas soluciones resolvió tu problema? Responde con el número (1, 2 o 3) o escribe NO si ninguna funcionó.

REGLAS:
- Responde SOLO con el formato indicado, sin texto extra.
- Cada solución debe ser concreta y aplicable al problema.
- Los pasos deben ser claros y breves.
- SIEMPRE en español.`;

async function llamarClaude(mensajes, systemOverride = null) {
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        system: systemOverride || SYSTEM_PROMPT,
        messages: mensajes
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("❌ Error API Claude:", errorData);
      return null;
    }

    const data = await response.json();
    return data.content?.[0]?.text || null;
  } catch (error) {
    console.error("❌ Error llamando a Claude:", error);
    return null;
  }
}

// ── Genera las 3 soluciones y las guarda en historial_ticket ──
export async function generarSoluciones(ticketId, titulo, descripcion) {
  const prompt = `Título: ${titulo}\nDescripción: ${descripcion}`;

  const respuesta = await llamarClaude([{ role: "user", content: prompt }]);

  if (!respuesta) {
    // Guardar mensaje de error en historial
    await supabase.from("historial_ticket").insert([{
      id_ticket: ticketId,
      id_usuario: null,
      comentario: "⚠️ No pude generar sugerencias automáticas para este ticket. Un técnico lo revisará.",
      fecha: new Date().toISOString()
    }]);
    return null;
  }

  // Guardar las 3 soluciones como mensaje del bot en el historial
  const { data, error } = await supabase
    .from("historial_ticket")
    .insert([{
      id_ticket: ticketId,
      id_usuario: null,
      comentario: respuesta,
      fecha: new Date().toISOString()
    }])
    .select();

  if (error) {
    console.error("❌ Error guardando soluciones en historial:", error);
    return null;
  }

  return data?.[0] || null;
}

// ── Sesión del bot para el chat interactivo ──
class SesionBot {
  constructor(ticketId, ticketTitulo, ticketDescripcion, usuarioId) {
    this.ticketId = ticketId;
    this.ticketTitulo = ticketTitulo;
    this.ticketDescripcion = ticketDescripcion;
    this.usuarioId = usuarioId;
    this.intentos = 0;
    this.maxIntentos = 3;
    this.historialChat = [];
    this.resuelto = false;
    this.escalado = false;
    this.activo = true;
  }

  async iniciar() {
    const contenidoTicket = `Título: ${this.ticketTitulo}\nDescripción: ${this.ticketDescripcion}`.trim();
    this.historialChat.push({ role: "user", content: contenidoTicket });

    const respuestaClaude = await llamarClaude(this.historialChat);
    if (!respuestaClaude) {
      const fallback = "⚠️ Hola, recibí tu ticket. Estoy teniendo dificultades para procesarlo. ¿Podrías darme más detalles del problema?";
      await this.guardarMensaje("bot", fallback);
      return fallback;
    }

    this.historialChat.push({ role: "assistant", content: respuestaClaude });
    await this.guardarMensaje("bot", respuestaClaude);
    return respuestaClaude;
  }

  async procesarMensaje(mensajeUsuario) {
    if (!this.activo) return "La conversación ha finalizado. Si tienes otro problema, crea un nuevo ticket.";

    const mensajeNorm = mensajeUsuario.trim();
    await this.guardarMensaje("usuario", mensajeNorm);

    if (this._esResuelto(mensajeNorm)) return this._cerrarResuelto();

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
    return ["si", "sí", "funciono", "funcionó", "ok", "listo", "resuelto", "gracias", "1", "2", "3"].some(
      p => m === p || m.startsWith(p + " ") || m.endsWith(" " + p)
    );
  }

  _esNegativo(msg) {
    const m = msg.toLowerCase();
    return ["no", "nope", "tampoco", "nada", "sigue", "igual"].some(
      p => m === p || m.startsWith(p + " ")
    );
  }

  _debeEscalar(respuesta) {
    const r = respuesta.toLowerCase();
    return r.includes("escal") || r.includes("técnico humano") || r.includes("soporte presencial");
  }

  async _cerrarResuelto() {
    this.resuelto = true;
    this.activo = false;
    await supabase.from("tickets")
      .update({ resuelto_por_bot: true, fecha_resolucion_bot: new Date().toISOString() })
      .eq("id_ticket", this.ticketId);
    const msgs = [
      "✅ ¡Perfecto! Me alegra que se haya resuelto. Que tengas un excelente día.",
      "✅ ¡Qué bien! Problema solucionado. Quedo a tus órdenes.",
      "✅ El ticket quedará cerrado como resuelto. ¡Hasta pronto!"
    ];
    const respuesta = msgs[Math.floor(Math.random() * msgs.length)];
    await this.guardarMensaje("bot", respuesta);
    return respuesta;
  }

  async _escalarTecnico(mensajePrevio = null) {
    this.escalado = true;
    this.activo = false;
    const tecnico = await asignarTecnicoAuto(this.ticketId);
    await supabase.from("tickets")
      .update({ diagnostico_bot: { intentos: this.intentos, escalado: true, historial_resumido: this.historialChat.slice(-4) } })
      .eq("id_ticket", this.ticketId);

    let respuesta = mensajePrevio ? mensajePrevio + "\n\n" : "⚠️ **No pude resolver el problema de forma automática.**\n\n";
    respuesta += tecnico
      ? `✅ He asignado a **${tecnico.nombre}** como técnico especializado.\n\nTe contactará a la brevedad para asistirte personalmente.`
      : "⚠️ No hay técnicos disponibles en este momento. Un supervisor será notificado.";

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
  getSesion(ticketId, ticketTitulo = "", ticketDescripcion = "", usuarioId = null) {
    if (!this.sesiones.has(ticketId)) {
      this.sesiones.set(ticketId, new SesionBot(ticketId, ticketTitulo, ticketDescripcion, usuarioId));
    }
    return this.sesiones.get(ticketId);
  }
  cerrarSesion(ticketId) { this.sesiones.delete(ticketId); }
}

export const botHospital = new BotHospital();