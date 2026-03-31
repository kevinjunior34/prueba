import { supabase } from "./supabase";

export async function asignarTecnicoAuto(idTicket) {
  try {
    // 1. Obtener técnicos
    const { data: tecnicos, error: errorTecnicos } = await supabase
      .from("usuarios")
      .select("id_usuario, nombre, correo")
      .eq("rol", "TECNICO")
      .eq("estado", "ACTIVO");

    if (errorTecnicos) throw errorTecnicos;
    if (!tecnicos || tecnicos.length === 0) return null;

    // 2. Contar tickets activos
    const conteos = await Promise.all(
      tecnicos.map(async (tecnico) => {
        const { count } = await supabase
          .from("tickets")
          .select("*", { count: "exact", head: true })
          .eq("id_tecnico", tecnico.id_usuario)
          .in("id_estado", [1, 2]);

        return {
          ...tecnico,
          ticketsActivos: count || 0
        };
      })
    );

    // 3. Elegir técnico con menos carga
    conteos.sort((a, b) => a.ticketsActivos - b.ticketsActivos);
    const tecnicoSeleccionado = conteos[0];

    // 4. Asignar técnico
    const { error: errorAsignacion } = await supabase
      .from("tickets")
      .update({
        id_tecnico: tecnicoSeleccionado.id_usuario,
        id_estado: 2
      })
      .eq("id_ticket", idTicket);

    if (errorAsignacion) throw errorAsignacion;

    // =========================
    // 📩 5. ENVIAR CORREO
    // =========================
    await fetch("https://gelngkrfmbzjpbhesexd.supabase.co/functions/v1/enviar-correo", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        email: tecnicoSeleccionado.correo, // ⚠️ en pruebas usa tu correo
        mensaje: `Nuevo ticket asignado #${idTicket}. Revisa el sistema.`,
        ticket: idTicket
      })
    });

    // =========================
    // 📝 6. HISTORIAL
    // =========================
    await supabase
      .from("historial_ticket")
      .insert([{
        id_ticket: idTicket,
        id_usuario: null,
        comentario: `Ticket asignado a ${tecnicoSeleccionado.nombre}`,
        fecha: new Date().toISOString()
      }]);

    return tecnicoSeleccionado;

  } catch (error) {
    console.error("Error:", error);
    return null;
  }
}