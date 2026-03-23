/**
 * autoRespuesta.js
 * Envía un mensaje automático de confirmación al historial del ticket
 * inmediatamente después de su creación.
 */

import { supabase } from "./supabase";

/**
 * Genera un mensaje de bienvenida personalizado según el área y prioridad
 */
function generarMensaje(ticket, areaNombre) {
  const prioridadTexto = {
    1: "🔴 **Crítica** — será atendida con máxima urgencia.",
    2: "🟠 **Alta** — será atendida a la brevedad.",
    3: "🟡 **Media** — será atendida en el orden de llegada.",
    4: "🟢 **Baja** — será atendida cuando el flujo de trabajo lo permita.",
  };

  const prio = prioridadTexto[ticket.id_prioridad] || "en el orden correspondiente.";

  return [
    `✅ **Ticket recibido correctamente.**`,
    ``,
    `Hola, tu solicitud de soporte ha sido registrada en el sistema de helpdesk del área de **${areaNombre}**.`,
    ``,
    `📋 **Resumen de tu ticket:**`,
    `• **Título:** ${ticket.titulo}`,
    `• **Prioridad:** ${prio}`,
    `• **Estado inicial:** Abierto`,
    ``,
    `Un técnico revisará tu caso. También puedes usar el **asistente virtual** para intentar resolver el problema de inmediato haciendo clic en "Iniciar asistente virtual" dentro de tu ticket.`,
    ``,
    `_Si tienes información adicional, agrega un comentario en este ticket._`,
  ].join("\n");
}

/**
 * Inserta la respuesta automática en el historial del ticket
 * @param {object} ticket - Objeto del ticket recién creado
 * @param {string} areaNombre - Nombre del área del ticket
 * @param {function} onUpdate - Callback para actualizar el estado local
 */
export async function enviarAutoRespuesta(ticket, areaNombre, onUpdate) {
  try {
    const comentario = generarMensaje(ticket, areaNombre);

    const { data, error } = await supabase
      .from("historial_ticket")
      .insert([{
        id_ticket: ticket.id_ticket,
        id_usuario: null, // null = mensaje del bot
        comentario,
        fecha: new Date().toISOString(),
      }])
      .select()
      .single();

    if (error) throw error;

    if (onUpdate && data) {
      onUpdate(ticket.id_ticket, data);
    }

    return data;
  } catch (error) {
    console.error("Error enviando auto-respuesta:", error);
    return null;
  }
}
