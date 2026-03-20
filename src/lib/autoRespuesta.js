import { supabase } from "./supabase.js";
import { generarSoluciones } from "./botHospital.js";

export async function enviarAutoRespuesta(ticket, areaNombre, onHistorialUpdate) {
  try {
    const entrada = await generarSoluciones(
      ticket.id_ticket,
      ticket.titulo,
      ticket.descripcion
    );

    if (onHistorialUpdate && entrada) {
      onHistorialUpdate(ticket.id_ticket, entrada);
    }

    return entrada;
  } catch (error) {
    console.error("Error enviando auto-respuesta:", error);
    return null;
  }
}

export async function enviarNotificacionAsignacion(ticketId, tecnicoNombre) {
  try {
    const { error } = await supabase.from("historial_ticket").insert([{
      id_ticket: ticketId,
      id_usuario: null,
      comentario: `Tu ticket ha sido asignado a ${tecnicoNombre}.`,
      fecha: new Date().toISOString()
    }]);
    if (error) throw error;
  } catch (error) {
    console.error("Error enviando notificación:", error);
  }
}

export async function enviarNotificacionCierre(ticketId) {
  try {
    const { error } = await supabase.from("historial_ticket").insert([{
      id_ticket: ticketId,
      id_usuario: null,
      comentario: "Tu ticket ha sido cerrado. Gracias por usar nuestro sistema.",
      fecha: new Date().toISOString()
    }]);
    if (error) throw error;
  } catch (error) {
    console.error("Error enviando notificación:", error);
  }
}