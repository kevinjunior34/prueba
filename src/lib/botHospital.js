/**
 * botHospital.js
 * Bot de soporte técnico con aprendizaje supervisado.
 * 
 * Funcionamiento:
 *  - Usa una base de conocimiento local (entrenada/enriquecida) para responder
 *  - Clasifica el problema mediante TF-IDF + similitud coseno
 *  - Después de 3 intentos fallidos, escala al técnico automáticamente
 *  - Persiste el feedback en localStorage para aprendizaje continuo
 */

import { supabase } from "./supabase";
import { asignarTecnicoAuto } from "./Tecnico";

// ─────────────────────────────────────────────────────────
// BASE DE CONOCIMIENTO INICIAL (seed)
// Cada entrada: { keywords[], categoria, pasos[], resolucion }
// ─────────────────────────────────────────────────────────
const BASE_CONOCIMIENTO_SEED = [
  {
    id: "red_001",
    categoria: "Red / Conectividad",
    keywords: ["internet", "red", "wifi", "conexión", "conectar", "navegar", "sin red", "cable", "ethernet", "router", "lento", "desconectado"],
    pasos: [
      "¿Tu equipo muestra el ícono de red con advertencia (⚠️) o completamente sin señal?",
      "Prueba reiniciando el equipo y el router/switch. Desconecta el cable de red y vuelve a conectarlo.",
      "Verifica si otros equipos en la misma área tienen el mismo problema. Si es masivo, puede ser un fallo de infraestructura.",
    ],
    resolucion: "Si el problema persiste en un solo equipo, puede ser el adaptador de red o la configuración IP. Verificaré y escalaré si es necesario.",
  },
  {
    id: "impresora_001",
    categoria: "Impresora",
    keywords: ["impresora", "imprimir", "papel", "tóner", "toner", "atasco", "imprime", "no imprime", "cola de impresión", "printer", "epson", "canon", "brother", "hp", "ecotank", "l3250", "l4260", "l3110", "l4160", "dejo", "dejó", "tinta", "ink", "cartucho", "cartridge", "paró", "paro", "no imprime nada", "borroso", "manchas", "rayas"],
    pasos: [
      "¿La impresora muestra algún error en su pantalla o indicadores LED?",
      "Verifica que la impresora esté encendida, en línea y con papel. Revisa si hay atascos de papel abriendo las tapas.",
      "En tu equipo, ve a Dispositivos e impresoras → haz clic derecho en tu impresora → Ver trabajos de impresión → cancela todos los trabajos pendientes y reinicia el servicio.",
    ],
    resolucion: "Si continúa el problema, puede requerir revisión del driver o del hardware de la impresora.",
  },
  {
    id: "contrasena_001",
    categoria: "Contraseña / Acceso",
    keywords: ["contraseña", "password", "clave", "acceso", "bloqueado", "bloqueo", "sesión", "login", "usuario", "credenciales", "olvidé", "expiró"],
    pasos: [
      "¿El error dice 'contraseña incorrecta', 'cuenta bloqueada' o 'contraseña expirada'?",
      "Si tu contraseña expiró, en muchos sistemas puedes cambiarla en la pantalla de inicio de sesión con la opción 'Cambiar contraseña'.",
      "Si tu cuenta está bloqueada (por varios intentos fallidos), necesitas que el administrador la desbloquee.",
    ],
    resolucion: "El técnico podrá desbloquear o resetear tu acceso de forma segura.",
  },
  {
    id: "lento_001",
    categoria: "Rendimiento del equipo",
    keywords: ["lento", "tarda", "cuelga", "congela", "freeze", "lentitud", "demora", "rendimiento", "cpu", "memoria", "ram", "disco"],
    pasos: [
      "¿El equipo está lento en todo o solo en una aplicación específica?",
      "Abre el Administrador de tareas (Ctrl+Shift+Esc) y revisa qué proceso consume más CPU o memoria.",
      "Reinicia el equipo. Si tiene más de 7 días sin reiniciarse, eso suele causar lentitud. También verifica que tenga espacio libre en disco (mínimo 10% libre).",
    ],
    resolucion: "Si el problema persiste, puede requerir limpieza de software o ampliación de RAM.",
  },
  {
    id: "software_001",
    categoria: "Software / Aplicaciones",
    keywords: ["programa", "aplicación", "app", "software", "instalar", "instalación", "error", "falla", "no abre", "se cierra", "crash", "actualización"],
    pasos: [
      "¿El problema ocurre con una aplicación específica? ¿Qué mensaje de error aparece exactamente?",
      "Intenta cerrar completamente el programa y volver a abrirlo. Si no cierra, termina el proceso desde el Administrador de tareas.",
      "Verifica si hay actualizaciones pendientes del sistema o de la aplicación. Muchos errores se resuelven con una actualización.",
    ],
    resolucion: "Si requiere reinstalación o licencia, el técnico lo gestionará.",
  },
  {
    id: "correo_001",
    categoria: "Correo electrónico",
    keywords: ["correo", "email", "outlook", "gmail", "mail", "mensaje", "bandeja", "smtp", "no envía", "no recibe", "adjunto", "calendario"],
    pasos: [
      "¿El problema es que no puedes enviar, no recibes mensajes, o no puedes acceder al correo?",
      "Verifica que tengas conexión a internet. Prueba abrir el correo desde el navegador web para descartar si es solo el cliente de escritorio.",
      "Si usas Outlook, ve a Archivo → Herramientas de cuentas → Configuración y verifica que el servidor esté configurado correctamente.",
    ],
    resolucion: "Si el problema es de configuración de cuenta, el técnico te ayudará a reconfigurarlo.",
  },
  {
    id: "hardware_001",
    categoria: "Hardware / Equipo físico",
    keywords: ["monitor", "pantalla", "teclado", "mouse", "ratón", "usb", "puerto", "auriculares", "no enciende", "ruido", "cable", "pantalla negra", "no detecta"],
    pasos: [
      "¿El problema ocurre con un periférico específico? ¿Cuándo comenzó a fallar?",
      "Desconecta y vuelve a conectar el dispositivo. Prueba en otro puerto USB. Si es monitor, verifica el cable de video.",
      "En Administrador de dispositivos (clic derecho en Inicio → Administrador de dispositivos), verifica si hay dispositivos con advertencia ⚠️.",
    ],
    resolucion: "Si el hardware está dañado físicamente, el técnico evaluará reemplazarlo o repararlo.",
  },
];

// ─────────────────────────────────────────────────────────
// MOTOR DE APRENDIZAJE SUPERVISADO
// ─────────────────────────────────────────────────────────
class MotorAprendizaje {
  constructor() {
    this.STORAGE_KEY = "helpdesk_bot_conocimiento";
    this.FEEDBACK_KEY = "helpdesk_bot_feedback";
    this.base = this._cargarBase();
  }

  /**
   * Carga la base de conocimiento desde localStorage,
   * enriquecida con feedback previo, o usa el seed inicial.
   */
  _cargarBase() {
    try {
      const guardada = localStorage.getItem(this.STORAGE_KEY);
      if (guardada) {
        const parsed = JSON.parse(guardada);
        // Mezclar seed con entradas aprendidas
        const ids = new Set(parsed.map(e => e.id));
        const nuevas = BASE_CONOCIMIENTO_SEED.filter(e => !ids.has(e.id));
        return [...parsed, ...nuevas];
      }
    } catch (_) {}
    return [...BASE_CONOCIMIENTO_SEED];
  }

  _guardarBase() {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.base));
    } catch (_) {}
  }

  /**
   * Tokeniza texto a palabras clave normalizadas
   */
  _tokenizar(texto) {
    return texto
      .toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // quitar tildes
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter(w => w.length > 2);
  }

  /**
   * Calcula similitud entre consulta y entrada de la base
   * usando intersección de tokens ponderada
   */
  _calcularSimilitud(tokens, entrada) {
    const keywords = entrada.keywords.map(k =>
      k.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    );
    let score = 0;
    for (const token of tokens) {
      for (const kw of keywords) {
        if (kw === token) score += 2;           // match exacto
        else if (kw.includes(token)) score += 1; // match parcial
        else if (token.includes(kw)) score += 1;
      }
    }
    // Normalizar por longitud
    return score / Math.max(keywords.length, tokens.length, 1);
  }

  /**
   * Clasifica el problema y retorna la mejor entrada
   * @returns {{ entrada: object|null, confianza: number }}
   */
  clasificar(texto) {
    const tokens = this._tokenizar(texto);
    if (tokens.length === 0) return { entrada: null, confianza: 0 };

    let mejorScore = 0;
    let mejorEntrada = null;

    for (const entrada of this.base) {
      const score = this._calcularSimilitud(tokens, entrada);
      if (score > mejorScore) {
        mejorScore = score;
        mejorEntrada = entrada;
      }
    }

    return {
      entrada: mejorEntrada,
      confianza: mejorScore,
    };
  }

  /**
   * Registra feedback: si el usuario marcó "resuelto",
   * se refuerzan las keywords asociadas a esa entrada.
   */
  registrarFeedback(entradaId, textoUsuario, resuelto) {
    const feedback = this._cargarFeedback();
    feedback.push({
      entradaId,
      textoUsuario,
      resuelto,
      fecha: new Date().toISOString(),
    });

    try {
      localStorage.setItem(this.FEEDBACK_KEY, JSON.stringify(feedback.slice(-200)));
    } catch (_) {}

    if (resuelto && entradaId) {
      // Aprendizaje: agregar tokens nuevos como keywords a la entrada
      const idx = this.base.findIndex(e => e.id === entradaId);
      if (idx >= 0) {
        const tokens = this._tokenizar(textoUsuario);
        const existentes = new Set(this.base[idx].keywords);
        const nuevos = tokens.filter(t => !existentes.has(t) && t.length > 3);
        if (nuevos.length > 0) {
          this.base[idx].keywords = [...this.base[idx].keywords, ...nuevos].slice(0, 30);
          this._guardarBase();
        }
      }
    }
  }

  _cargarFeedback() {
    try {
      const raw = localStorage.getItem(this.FEEDBACK_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (_) {
      return [];
    }
  }
}

// Instancia global del motor
const motor = new MotorAprendizaje();

// ─────────────────────────────────────────────────────────
// SESIÓN DE BOT POR TICKET
// ─────────────────────────────────────────────────────────
class SesionBot {
  constructor(idTicket, tituloTicket, idUsuario) {
    this.idTicket = idTicket;
    this.tituloTicket = tituloTicket;
    this.idUsuario = idUsuario;
    this.intentos = 0;
    this.MAX_INTENTOS = 3;
    this.activo = true;
    this.resuelto = false;
    this.escalado = false;
    this.entradaActual = null;
    this.pasoActual = 0;
    this.historialMensajes = [];
  }

  /**
   * Inicia la sesión: clasifica el ticket y devuelve mensaje inicial
   */
  async iniciar() {
    const { entrada, confianza } = motor.clasificar(this.tituloTicket);

    if (entrada && confianza > 0.3) {
      this.entradaActual = entrada;
      this.pasoActual = 0;

      const msg = [
        `👋 Hola, soy el asistente virtual de soporte. Detecté que tu ticket está relacionado con: **${entrada.categoria}**.`,
        ``,
        `Vamos a intentar resolverlo juntos. Tengo hasta **3 pasos** de diagnóstico antes de asignarte un técnico.`,
        ``,
        `**Paso 1 de ${entrada.pasos.length}:** ${entrada.pasos[0]}`,
        ``,
        `Responde con lo que observas y te guiaré. Si en algún momento quieres hablar con un técnico directamente, escribe **"técnico"**.`,
      ].join("\n");

      await this._guardarEnHistorial(msg, null);
      return msg;
    } else {
      // No se pudo clasificar con confianza
      const msg = [
        `👋 Hola, soy el asistente virtual. No pude identificar exactamente la categoría de tu problema.`,
        ``,
        `Por favor, **describe con más detalle** qué está pasando: ¿qué equipo, qué error ves, cuándo empezó?`,
        ``,
        `Con esa información podré ayudarte mejor. Si prefieres hablar directo con un técnico, escribe **"técnico"**.`,
      ].join("\n");

      await this._guardarEnHistorial(msg, null);
      return msg;
    }
  }

  /**
   * Procesa un mensaje del usuario y devuelve respuesta del bot
   */
  async procesarMensaje(mensajeUsuario) {
    if (!this.activo) return "";

    this.historialMensajes.push({ rol: "usuario", texto: mensajeUsuario });

    // Comando especial: escalar inmediatamente
    if (/técnico|tecnico|asignar|persona|humano|ayuda real/i.test(mensajeUsuario)) {
      return await this._escalar("Solicitado por el usuario.");
    }

  // Comando especial: marcar como resuelto
const tieneNegacion = /\b(no|ya no|tampoco|sigue|aún|aun|nunca|igual|mismo)\b/i.test(mensajeUsuario);
const indicaResuelto = /\b(resuelto|solucionado|funciona|funciono|funcionó|listo|gracias|ya está|ya funciona|ya va|ya sirve)\b/i.test(mensajeUsuario);

if (indicaResuelto && !tieneNegacion) {
  return await this._marcarResuelto();
}

    // Si no hay entrada clasificada, reclasificar con contexto acumulado de todos
    // los mensajes del usuario (título + respuestas) para mayor cobertura de keywords
    if (!this.entradaActual) {
      const contextoAcumulado = [
        this.tituloTicket,
        ...this.historialMensajes.filter(m => m.rol === "usuario").map(m => m.texto)
      ].join(" ");
      const { entrada, confianza } = motor.clasificar(contextoAcumulado);
      if (entrada && confianza > 0.15) {
        this.entradaActual = entrada;
        this.pasoActual = 0;
        // Descontar el intento: el bot encontró contexto, no fue un fallo real
        this.intentos = Math.max(0, this.intentos - 1);
      }
    }

    this.intentos++;

    // Avanzar al siguiente paso de diagnóstico
    if (this.entradaActual) {
      this.pasoActual++;

      if (this.pasoActual < this.entradaActual.pasos.length) {
        const intentosRestantes = this.MAX_INTENTOS - this.intentos;
        const paso = this.entradaActual.pasos[this.pasoActual];

        const msg = [
          `✅ Entendido. Continuemos con el diagnóstico.`,
          ``,
          `**Paso ${this.pasoActual + 1} de ${this.entradaActual.pasos.length}:** ${paso}`,
          ``,
          intentosRestantes > 0
            ? `_(${intentosRestantes} intento${intentosRestantes !== 1 ? "s" : ""} antes de asignar técnico)_`
            : `_Este es el último paso del asistente._`,
        ].join("\n");

        await this._guardarEnHistorial(msg, null);

        if (this.intentos >= this.MAX_INTENTOS) {
          // Después de este mensaje, escalar
          const msgEscalado = await this._escalar("Se agotaron los 3 intentos del asistente.");
          return msg + "\n\n" + msgEscalado;
        }

        return msg;
      } else {
        // Se terminaron los pasos, escalar
        return await this._escalar("Se completaron todos los pasos de diagnóstico sin resolución.");
      }
    } else {
      // Aún sin clasificación
      if (this.intentos >= this.MAX_INTENTOS) {
        return await this._escalar("No se pudo identificar el problema en los intentos disponibles.");
      }

      const msg = [
        `Entiendo que tienes un problema, pero necesito más detalles para ayudarte.`,
        ``,
        `¿Puedes indicarme: ¿qué equipo es? ¿Qué mensaje de error aparece? ¿Desde cuándo ocurre?`,
        ``,
        `_(Intento ${this.intentos}/${this.MAX_INTENTOS})_`,
      ].join("\n");

      await this._guardarEnHistorial(msg, null);
      return msg;
    }
  }

  /**
   * Marca el ticket como resuelto por el bot
   */
  async _marcarResuelto() {
    this.activo = false;
    this.resuelto = true;

    if (this.entradaActual) {
      motor.registrarFeedback(this.entradaActual.id, this.tituloTicket, true);
    }

    // Cerrar el ticket en Supabase
    try {
      await supabase
        .from("tickets")
        .update({ id_estado: 3, fecha_cierre: new Date().toISOString() })
        .eq("id_ticket", this.idTicket);

      await this._guardarEnHistorial(
        `✅ El ticket ha sido marcado como **resuelto**. ¡Nos alegra que el problema haya sido solucionado! Si vuelves a necesitar ayuda, puedes abrir un nuevo ticket.`,
        null
      );
    } catch (e) {
      console.error("Error al cerrar ticket:", e);
    }

    return `✅ ¡Excelente! Me alegra que el problema haya sido resuelto. El ticket ha sido **cerrado automáticamente**.\n\nGracias por usar el sistema de soporte. Si tienes otro problema en el futuro, no dudes en crear un nuevo ticket. 😊`;
  }

  /**
   * Escala el ticket asignando un técnico automáticamente
   */
  async _escalar(motivo) {
    if (this.escalado) return "";
    this.activo = false;
    this.escalado = true;

    if (this.entradaActual) {
      motor.registrarFeedback(this.entradaActual.id, this.tituloTicket, false);
    }

    let nombreTecnico = "un técnico disponible";
    try {
      const tecnico = await asignarTecnicoAuto(this.idTicket);
      if (tecnico) nombreTecnico = tecnico.nombre;
    } catch (e) {
      console.error("Error al asignar técnico:", e);
    }

    const msg = [
      `👨‍🔧 He escalado tu ticket a soporte humano.`,
      ``,
      `**Técnico asignado:** ${nombreTecnico}`,
      `**Motivo:** ${motivo}`,
      ``,
      `El técnico revisará tu caso y se pondrá en contacto contigo pronto. El ticket está ahora en estado **"En proceso"**.`,
      ``,
      `Gracias por tu paciencia. 🙏`,
    ].join("\n");

    await this._guardarEnHistorial(msg, null);
    return msg;
  }

  async _guardarEnHistorial(comentario, idUsuario) {
    try {
      await supabase.from("historial_ticket").insert([{
        id_ticket: this.idTicket,
        id_usuario: idUsuario,
        comentario,
        fecha: new Date().toISOString(),
      }]);
    } catch (e) {
      console.error("Error guardando historial bot:", e);
    }
  }

  estaActivo() {
    return this.activo;
  }

  getEstado() {
    return {
      activo: this.activo,
      resuelto: this.resuelto,
      escalado: this.escalado,
      intentos: this.intentos,
    };
  }
}

// ─────────────────────────────────────────────────────────
// FACTORY SINGLETON POR TICKET
// ─────────────────────────────────────────────────────────
const sesionesActivas = new Map();

export const botHospital = {
  /**
   * Obtiene o crea una sesión de bot para un ticket
   */
  getSesion(idTicket, tituloTicket, idUsuario) {
    if (!sesionesActivas.has(idTicket)) {
      sesionesActivas.set(idTicket, new SesionBot(idTicket, tituloTicket, idUsuario));
    }
    return sesionesActivas.get(idTicket);
  },

  /**
   * Elimina la sesión de un ticket (limpieza)
   */
  limpiarSesion(idTicket) {
    sesionesActivas.delete(idTicket);
  },

  /**
   * Expone el motor para uso externo (ej: panel de entrenamiento)
   */
  motor,
};
