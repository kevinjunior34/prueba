import { useState } from "react";
import { Ic } from "../common/Ic";
import { Badge } from "../common/Badge";
import { getPrioridad, fmtDate } from "../../utils/helpers";
import { supabase } from "../../lib/supabase";
import { TicketDetailHistorial } from "./TicketHistorial";
import { TicketDetailAdjuntos } from "./TicketDetailAdjuntos";
import { useTicketDetailBot } from "./TicketDetailBot";

const TABS = [
  { id: "detalles",  label: "Detalles",  icon: "file-text" },
  { id: "adjuntos",  label: "Adjuntos",  icon: "image"     },
  { id: "historial", label: "Historial", icon: "clock"     },
];

export function TicketDetail({ ticket, onClose, users = [], areas = [], currentUser, onUpdate, toast }) {
  const [tab, setTab]           = useState("detalles");
  const [comentario, setComentario] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [imagenBot, setImagenBot] = useState(null); // { base64, mime, preview }

  const { botSession, esperandoBot, botActivo, intentos, iniciarBot, responderBot } =
    useTicketDetailBot({ ticket, currentUser, onUpdate, toast });

  if (!ticket) return null;

  const prioridad       = getPrioridad(ticket.id_prioridad);
  const getUser         = (id) => users?.find(u => u?.id_usuario === id) || null;
  const getArea         = (id) => areas?.find(a => a?.id_area    === id) || null;
  const tecnicoAsignado = getUser(ticket.id_tecnico);
  const esCerrado       = ticket.id_estado === 3;

  const enviarComentario = async () => {
    if ((!comentario.trim() && !imagenBot) || esCerrado || !currentUser?.id_usuario) return;

    const mensajeUsuario = comentario.trim();
    const imagenEnvio    = imagenBot;
    setComentario("");
    setImagenBot(null);
    setEnviando(true);

    try {
      if (botActivo) {
        await responderBot({
          mensajeUsuario,
          imagenBot: imagenEnvio,
          historialActual: ticket.historial ?? [],
        });
      } else {
        const { data, error } = await supabase
          .from("historial_ticket")
          .insert([{
            id_ticket:  ticket.id_ticket,
            id_usuario: currentUser.id_usuario,
            comentario: mensajeUsuario,
            fecha:      new Date().toISOString(),
          }])
          .select();

        if (error) throw error;
        onUpdate?.({ ...ticket, historial: [...(ticket.historial ?? []), data[0]] });
      }
    } catch (err) {
      console.error("Error al enviar:", err);
      toast?.("Error al enviar mensaje", "error");
      setComentario(mensajeUsuario);
    } finally {
      setEnviando(false);
    }
  };

  /* ─── Styles ─── */
  const S = {
    overlay: {
      position: "fixed",
      inset: 0,
      zIndex: 1000,
      background: "rgba(15, 23, 42, 0.55)",
      backdropFilter: "blur(4px)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 16,
    },
    modal: {
      background: "#fff",
      borderRadius: 12,
      width: "100%",
      maxWidth: 700,
      maxHeight: "90vh",
      display: "flex",
      flexDirection: "column",
      boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
      overflow: "hidden",
    },
    header: {
      padding: "20px 24px",
      borderBottom: "1px solid #eef0f6",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "flex-start",
      flexShrink: 0,
    },
    tabBar: {
      display: "flex",
      borderBottom: "1px solid #eef0f6",
      padding: "0 24px",
      flexShrink: 0,
      background: "#fff",
    },
    body: {
      padding: 24,
      overflowY: "auto",
      flex: 1,
    },
    closeBtn: {
      background: "#f3f4f6",
      border: "none",
      width: 32,
      height: 32,
      borderRadius: 16,
      cursor: "pointer",
      fontSize: 16,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    },
    infoGrid: {
      display: "grid",
      gridTemplateColumns: "repeat(2, 1fr)",
      gap: 16,
      background: "#f8f9fd",
      padding: 16,
      borderRadius: 8,
      marginBottom: 20,
    },
    label: { fontSize: 11, color: "#6b7fa3", marginBottom: 2 },
    value: { fontSize: 14, fontWeight: 500 },
    descBox: {
      background: "#f8f9fd",
      padding: 16,
      borderRadius: 8,
      fontSize: 14,
      lineHeight: 1.6,
    },
    botBanner: {
      marginTop: 20,
      padding: 16,
      background: "#e8f0fe",
      borderRadius: 8,
      border: "1px solid rgba(91,141,238,0.2)",
    },
    botActive: {
      marginTop: 16,
      padding: 12,
      background: "#f0f7ff",
      borderRadius: 8,
      borderLeft: "4px solid #5b8dee",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
    },
    textarea: {
      width: "100%",
      padding: 10,
      border: "1px solid #d1d5db",
      borderRadius: 6,
      resize: "vertical",
      fontSize: 13,
      fontFamily: "inherit",
      lineHeight: 1.5,
      outline: "none",
      boxSizing: "border-box",
    },
    sendBtn: {
      background: "#5b8dee",
      color: "white",
      border: "none",
      borderRadius: 6,
      padding: "8px 20px",
      fontSize: 13,
      fontWeight: 600,
      cursor: "pointer",
    },
    closedBanner: {
      background: "#f0fdf4",
      border: "1px solid #bbf7d0",
      borderRadius: 8,
      padding: 12,
      display: "flex",
      alignItems: "center",
      gap: 8,
      color: "#166534",
    },
  };

  return (
    <div style={S.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={S.modal}>

        {/* ── Header ── */}
        <div style={S.header}>
          <div>
            <div style={{ fontSize: 12, color: "#6b7fa3", marginBottom: 4 }}>
              TICKET #{ticket.id_ticket}
            </div>
            <h3 style={{ margin: "0 0 8px 0", fontSize: 18 }}>{ticket.titulo}</h3>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <Badge id_estado={ticket.id_estado} />
              {prioridad && (
                <span style={{ fontSize: 12, color: prioridad.color, fontWeight: 600 }}>
                  ● {prioridad.label}
                </span>
              )}
            </div>
          </div>
          <button onClick={onClose} style={S.closeBtn}>✕</button>
        </div>

        {/* ── Tabs ── */}
        <div style={S.tabBar}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              padding: "12px 16px",
              background: "none",
              border: "none",
              borderBottom: tab === t.id ? "2px solid #5b8dee" : "2px solid transparent",
              color:      tab === t.id ? "#5b8dee" : "#6b7fa3",
              fontWeight: tab === t.id ? 600 : 400,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 13,
              transition: "color 0.15s",
            }}>
              <Ic n={t.icon} size={14} />
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Contenido ── */}
        <div style={S.body}>

          {/* Tab: Detalles */}
          {tab === "detalles" && (
            <>
              {/* Info grid */}
              <div style={S.infoGrid}>
                <div>
                  <div style={S.label}>Usuario</div>
                  <div style={S.value}>{getUser(ticket.id_usuario)?.nombre || "—"}</div>
                </div>
                <div>
                  <div style={S.label}>Área</div>
                  <div style={S.value}>{getArea(ticket.id_area)?.nombre_area || "—"}</div>
                </div>
                <div>
                  <div style={S.label}>Fecha creación</div>
                  <div style={{ fontSize: 14 }}>{fmtDate(ticket.fecha_creacion)}</div>
                </div>
                <div>
                  <div style={S.label}>Técnico asignado</div>
                  <div style={S.value}>
                    {tecnicoAsignado
                      ? tecnicoAsignado.nombre
                      : <span style={{ color: "#f97316" }}>Pendiente</span>}
                  </div>
                </div>
              </div>

              {/* Descripción */}
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Descripción</div>
                <div style={S.descBox}>{ticket.descripcion}</div>
              </div>

              {/* Estado cerrado */}
              {esCerrado ? (
                <div style={S.closedBanner}>
                  <span>✅ Ticket cerrado</span>
                </div>
              ) : (
                <>
                  {/* Banner bot */}
                  {!botActivo && (
                    <div style={S.botBanner}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                        <Ic n="bot" size={24} style={{ color: "#5b8dee" }} />
                        <div>
                          <strong>¿Necesitas ayuda con este problema?</strong>
                          <p style={{ fontSize: 12, color: "#6b7fa3", margin: "4px 0 0" }}>
                            El asistente virtual te guiará para resolverlo
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={iniciarBot}
                        disabled={esperandoBot}
                        style={{
                          ...S.sendBtn,
                          opacity: esperandoBot ? 0.6 : 1,
                          cursor: esperandoBot ? "not-allowed" : "pointer",
                        }}
                      >
                        {esperandoBot ? "Iniciando..." : "Iniciar asistente virtual"}
                      </button>
                    </div>
                  )}

                  {/* Bot activo */}
                  {botActivo && (
                    <div style={S.botActive}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <Ic n="message-circle" size={16} style={{ color: "#5b8dee" }} />
                        <span style={{ fontSize: 13 }}>
                          Asistente activo — Intento {intentos + 1}/3
                        </span>
                      </div>
                      {esperandoBot && (
                        <span style={{ fontSize: 11, color: "#6b7fa3" }}>Escribiendo...</span>
                      )}
                    </div>
                  )}

                  {/* Caja comentario */}
                  <div style={{ marginTop: 20 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>
                      Agregar comentario
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <textarea
                        rows={3}
                        placeholder="Escribe tu mensaje o adjunta una imagen..."
                        value={comentario}
                        onChange={e => setComentario(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === "Enter" && e.ctrlKey) {
                            e.preventDefault();
                            enviarComentario();
                          }
                        }}
                        disabled={enviando || esperandoBot}
                        style={{
                          ...S.textarea,
                          opacity: enviando || esperandoBot ? 0.6 : 1,
                        }}
                      />

                      {/* Preview imagen */}
                      {imagenBot && (
                        <div style={{
                          display: "flex", alignItems: "center", gap: 8,
                          padding: "6px 10px", background: "#eff6ff",
                          borderRadius: 6, border: "1px solid #93c5fd",
                        }}>
                          <img src={imagenBot.preview} alt="preview" style={{
                            width: 48, height: 48,
                            objectFit: "cover", borderRadius: 4,
                            border: "1px solid #bfdbfe",
                          }} />
                          <span style={{ fontSize: 12, color: "#1e40af", flex: 1 }}>
                            Imagen lista para analizar
                          </span>
                          <button
                            onClick={() => setImagenBot(null)}
                            style={{ background: "none", border: "none", cursor: "pointer", color: "#6b7fa3", fontSize: 16 }}
                          >✕</button>
                        </div>
                      )}

                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 11, color: "#b0bbd4" }}>Ctrl + Enter para enviar</span>

                          {/* Adjuntar imagen */}
                          <label style={{
                            display: "flex", alignItems: "center", gap: 4,
                            cursor: "pointer", fontSize: 12, color: "#5b8dee",
                            padding: "4px 8px", borderRadius: 6,
                            border: "1px solid #c7d9fb", background: "#f0f5ff",
                            opacity: enviando || esperandoBot ? 0.5 : 1,
                            pointerEvents: enviando || esperandoBot ? "none" : "auto",
                          }}>
                            <Ic n="image" size={13} color="#5b8dee" />
                            <span>Imagen</span>
                            <input
                              type="file"
                              accept="image/*"
                              style={{ display: "none" }}
                              onChange={e => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                const reader = new FileReader();
                                reader.onload = ev => {
                                  const result = ev.target.result;
                                  setImagenBot({
                                    base64: result.split(",")[1],
                                    mime: file.type,
                                    preview: result,
                                  });
                                };
                                reader.readAsDataURL(file);
                                e.target.value = "";
                              }}
                            />
                          </label>
                        </div>

                        <button
                          onClick={enviarComentario}
                          disabled={(!comentario.trim() && !imagenBot) || enviando || esperandoBot}
                          style={{
                            ...S.sendBtn,
                            opacity: ((!comentario.trim() && !imagenBot) || enviando || esperandoBot) ? 0.6 : 1,
                            cursor: ((!comentario.trim() && !imagenBot) || enviando || esperandoBot) ? "not-allowed" : "pointer",
                          }}
                        >
                          {enviando ? "Enviando..." : "Enviar"}
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </>
          )}

          {tab === "adjuntos"  && <TicketDetailAdjuntos ticket={ticket} />}
          {tab === "historial" && <TicketDetailHistorial ticket={ticket} users={users} />}
        </div>
      </div>
    </div>
  );
}