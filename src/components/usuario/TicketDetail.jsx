import { useState } from "react";
import { Ic } from "../common/Ic";
import { Badge } from "../common/Badge";
import { getPrioridad, fmtDate } from "../../utils/helpers";
import { supabase } from "../../lib/supabase";
import { TicketDetailHistorial } from "TicketdetailHistorial";
import { TicketDetailAdjuntos } from "TicketdetailAdjuntos";
import { useTicketDetailBot } from "TicketdetailBot";

const TABS = [
  { id: "detalles", label: "Detalles", icon: "file-text" },
  { id: "adjuntos", label: "Adjuntos",  icon: "image" },
  { id: "historial", label: "Historial", icon: "clock" },
];

export function TicketDetail({ ticket, onClose, users = [], areas = [], currentUser, onUpdate, toast }) {
  const [tab, setTab] = useState("detalles");
  const [comentario, setComentario] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [imagenBot, setImagenBot] = useState(null); // { base64, mime, preview }

  const { botSession, esperandoBot, botActivo, intentos, iniciarBot, responderBot } =
    useTicketDetailBot({ ticket, currentUser, onUpdate, toast });

  if (!ticket) return null;

  const prioridad       = getPrioridad(ticket.id_prioridad);
  const getUser         = (id) => users?.find(u => u?.id_usuario === id) || null;
  const getArea         = (id) => areas?.find(a => a?.id_area === id) || null;
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
        // Delegar al hook del bot
        await responderBot({
          mensajeUsuario,
          imagenBot: imagenEnvio,
          historialActual: ticket.historial ?? [],
        });
      } else {
        // Guardar comentario normal en Supabase
        const { data, error } = await supabase
          .from("historial_ticket")
          .insert([{
            id_ticket:   ticket.id_ticket,
            id_usuario:  currentUser.id_usuario,
            comentario:  mensajeUsuario,
            fecha:       new Date().toISOString()
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

  return (
    <div className="hd-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="hd-modal" style={{ maxWidth: 700, maxHeight: "90vh", overflow: "auto" }}>

        {/* ── Header ── */}
        <div className="hd-modal__header" style={{
          padding: 20,
          borderBottom: "1px solid #eef0f6",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start"
        }}>
          <div>
            <div style={{ fontSize: 12, color: "#6b7fa3", marginBottom: 4 }}>
              TICKET #{ticket.id_ticket}
            </div>
            <h3 style={{ margin: "0 0 8px 0", fontSize: 18 }}>{ticket.titulo}</h3>
            <div style={{ display: "flex", gap: 10 }}>
              <Badge id_estado={ticket.id_estado} />
              <span style={{ fontSize: 12, color: prioridad?.color, fontWeight: 600 }}>
                ● {prioridad?.label}
              </span>
            </div>
          </div>
          <button onClick={onClose} style={{
            background: "#f3f4f6", border: "none",
            width: 32, height: 32, borderRadius: 16,
            cursor: "pointer", fontSize: 16
          }}>
            ✕
          </button>
        </div>

        {/* ── Tabs ── */}
        <div style={{ display: "flex", borderBottom: "1px solid #eef0f6", padding: "0 20px" }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              padding: "12px 16px",
              background: "none",
              border: "none",
              borderBottom: tab === t.id ? "2px solid #5b8dee" : "none",
              color:      tab === t.id ? "#5b8dee" : "#6b7fa3",
              fontWeight: tab === t.id ? 600 : 400,
              cursor: "pointer",
              display: "flex", alignItems: "center", gap: 6
            }}>
              <Ic n={t.icon} size={14} />
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Contenido ── */}
        <div style={{ padding: 24 }}>

          {/* Tab: Detalles */}
          {tab === "detalles" && (
            <>
              {/* Info grid */}
              <div style={{
                display: "grid", gridTemplateColumns: "repeat(2, 1fr)",
                gap: 16, background: "#f8f9fd", padding: 16,
                borderRadius: 8, marginBottom: 20
              }}>
                <div>
                  <div style={{ fontSize: 11, color: "#6b7fa3" }}>Usuario</div>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>
                    {getUser(ticket.id_usuario)?.nombre || "—"}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: "#6b7fa3" }}>Área</div>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>
                    {getArea(ticket.id_area)?.nombre_area || "—"}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: "#6b7fa3" }}>Fecha creación</div>
                  <div style={{ fontSize: 14 }}>{fmtDate(ticket.fecha_creacion)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: "#6b7fa3" }}>Técnico asignado</div>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>
                    {tecnicoAsignado
                      ? tecnicoAsignado.nombre
                      : <span style={{ color: "#f97316" }}>Pendiente</span>}
                  </div>
                </div>
              </div>

              {/* Descripción */}
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Descripción</div>
                <div style={{
                  background: "#f8f9fd", padding: 16,
                  borderRadius: 8, fontSize: 14, lineHeight: 1.6
                }}>
                  {ticket.descripcion}
                </div>
              </div>

              {/* Ticket cerrado */}
              {esCerrado ? (
                <div style={{
                  background: "#f0fdf4", border: "1px solid #bbf7d0",
                  borderRadius: 8, padding: 12,
                  display: "flex", alignItems: "center", gap: 8, color: "#166534"
                }}>
                  <span>✅ Ticket cerrado</span>
                </div>
              ) : (
                <>
                  {/* Banner iniciar bot */}
                  {!botActivo && (
                    <div style={{
                      marginTop: 20, padding: 16,
                      background: "#e8f0fe", borderRadius: 8,
                      border: "1px solid #5b8dee33"
                    }}>
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
                          background: "#5b8dee", color: "white",
                          border: "none", borderRadius: 6,
                          padding: "8px 16px", fontSize: 13,
                          cursor: "pointer",
                          opacity: esperandoBot ? 0.6 : 1
                        }}
                      >
                        {esperandoBot ? "Iniciando..." : "Iniciar asistente virtual"}
                      </button>
                    </div>
                  )}

                  {/* Estado bot activo */}
                  {botActivo && (
                    <div style={{
                      marginTop: 16, padding: 12,
                      background: "#f0f7ff", borderRadius: 8,
                      borderLeft: "4px solid #5b8dee",
                      display: "flex", alignItems: "center", justifyContent: "space-between"
                    }}>
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

                  {/* Caja de comentario */}
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
                          width: "100%", padding: 10,
                          border: "1px solid #d1d5db",
                          borderRadius: 6, resize: "vertical",
                          opacity: enviando || esperandoBot ? 0.6 : 1
                        }}
                      />

                      {/* Preview imagen */}
                      {imagenBot && (
                        <div style={{
                          display: "flex", alignItems: "center", gap: 8,
                          padding: "6px 10px", background: "#eff6ff",
                          borderRadius: 6, border: "1px solid #93c5fd"
                        }}>
                          <img src={imagenBot.preview} alt="preview" style={{
                            width: 48, height: 48, objectFit: "cover",
                            borderRadius: 4, border: "1px solid #bfdbfe"
                          }} />
                          <span style={{ fontSize: 12, color: "#1e40af", flex: 1 }}>
                            Imagen lista para analizar
                          </span>
                          <button onClick={() => setImagenBot(null)} style={{
                            background: "none", border: "none",
                            cursor: "pointer", color: "#6b7fa3", fontSize: 16
                          }}>✕</button>
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
                            pointerEvents: enviando || esperandoBot ? "none" : "auto"
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
                                    preview: result
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
                            background: "#5b8dee", color: "white",
                            border: "none", borderRadius: 6,
                            padding: "8px 16px", fontSize: 13,
                            cursor: "pointer",
                            opacity: ((!comentario.trim() && !imagenBot) || enviando || esperandoBot) ? 0.6 : 1
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