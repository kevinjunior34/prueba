import { useState } from "react";
import { botHospital } from "../../lib/botHospital";

/**
 * Hook que encapsula toda la lógica del asistente virtual (bot).
 *
 * @param {object}   ticket      - Ticket actual
 * @param {object}   currentUser - Usuario autenticado
 * @param {function} onUpdate    - Callback para actualizar el ticket en el padre
 * @param {function} toast       - Función de notificaciones
 */
export function useTicketDetailBot({ ticket, currentUser, onUpdate, toast }) {
  const [botSession,    setBotSession]    = useState(null);
  const [esperandoBot,  setEsperandoBot]  = useState(false);

  const iniciarBot = async () => {
    setEsperandoBot(true);
    try {
      const session = botHospital.getSesion(
        ticket.id_ticket,
        ticket.titulo,
        currentUser?.id_usuario
      );
      setBotSession(session);

      const mensajeInicial = await session.iniciar();

      const nuevoHistorial = [
        ...(ticket.historial ?? []),
        {
          id_historial: Date.now(),
          id_usuario:   null,
          comentario:   mensajeInicial,
          fecha:        new Date().toISOString(),
        },
      ];

      onUpdate?.({ ...ticket, historial: nuevoHistorial });
    } catch (error) {
      console.error("Error al iniciar bot:", error);
      toast?.("Error al iniciar el asistente", "error");
    } finally {
      setEsperandoBot(false);
    }
  };

  const responderBot = async ({ mensajeUsuario, imagenBot, historialActual }) => {
    setEsperandoBot(true);
    try {
      // 1. Agregar mensaje del usuario al historial
      const mensajeUsuarioObj = {
        id_historial: Date.now(),
        id_usuario:   currentUser.id_usuario,
        comentario:   mensajeUsuario || "📎 [Imagen adjunta]",
        fecha:        new Date().toISOString(),
      };
      const historialConUsuario = [...historialActual, mensajeUsuarioObj];
      onUpdate?.({ ...ticket, historial: historialConUsuario });

      // 2. Procesar respuesta del bot
      const respuestaBot = await botSession.procesarMensaje(
        mensajeUsuario,
        imagenBot?.base64 ?? null,
        imagenBot?.mime   ?? "image/jpeg"
      );

      // 3. Agregar respuesta del bot al historial
      const respuestaBotObj = {
        id_historial: Date.now() + 1,
        id_usuario:   null,
        comentario:   respuestaBot,
        fecha:        new Date().toISOString(),
      };
      onUpdate?.({ ...ticket, historial: [...historialConUsuario, respuestaBotObj] });

      // 4. Verificar si el bot terminó
      const estadoBot = botSession.getEstado();
      if (!estadoBot.activo) {
        if (estadoBot.resuelto)  toast?.("✅ Problema resuelto por el asistente", "success");
        else if (estadoBot.escalado) toast?.("👨‍🔧 Se ha asignado un técnico", "info");
      }
    } catch (error) {
      console.error("Error en respuesta del bot:", error);
      toast?.("Error al procesar respuesta del bot", "error");
    } finally {
      setEsperandoBot(false);
    }
  };

  return {
    botSession,
    esperandoBot,
    iniciarBot,
    responderBot,
    botActivo: botSession?.estaActivo() ?? false,
    intentos:  botSession?.intentos    ?? 0,
  };
}