import { supabase } from "./supabase.js";
import { botHospital } from "./botHospital.js";

export async function enviarAutoRespuesta(ticket, areaNombre, onHistorialUpdate) {
  try {
    const sesion = botHospital.getSesion(
      ticket.id_ticket,
      ticket.titulo,
      ticket.descripcion,
      ticket.id_usuario
    );

    await sesion.iniciar();

    const { data, error } = await supabase
      .from("historial_ticket")
      .select("*")
      .eq("id_ticket", ticket.id_ticket)
      .order("fecha", { ascending: false })
      .limit(1)
      .single();

    if (error) throw error;

    if (onHistorialUpdate && data) {
      onHistorialUpdate(ticket.id_ticket, data);
    }

    return data;
  } catch (error) {
    console.error("Error enviando auto-respuesta:", error);
    return null;
  }
}

export async function enviarNotificacionAsignacion(ticketId, tecnicoNombre) {
  try {
    const { error } = await supabase
      .from("historial_ticket")
      .insert([{
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
    const { error } = await supabase
      .from("historial_ticket")
      .insert([{
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