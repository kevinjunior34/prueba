import { useState, useEffect, useRef } from "react";
import { Ic } from "../common/Ic";
import { Badge } from "../common/Badge";
import { getEstado, getPrioridad, fmtDate } from "../../utils/helpers";
import { supabase } from "../../lib/supabase";
import { botHospital, generarSoluciones } from "../../lib/botHospital";

function TabHistorial({ ticket, users = [] }) {
  const historial = ticket?.historial ?? [];
  const getUser = (id) => users?.find(u => u?.id_usuario === id) || null;

  if (!historial || historial.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: 40, color: "#6b7fa3" }}>
        <Ic n="clock" size={32} style={{ opacity: 0.25 }} />
        <p>Sin entradas en el historial</p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {historial.map((entry, idx) => {
        const autor = getUser(entry.id_usuario);
        const esBot = entry.id_usuario === null;
        return (
          <div key={entry.id_historial || idx} style={{
            padding: 12,
            background: esBot ? "#f0f7ff" : "#f8f9fd",
            borderRadius: 8,
            borderLeft: esBot ? "4px solid #5b8dee" : "4px solid #e5e7eb"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: esBot ? "#5b8dee" : "#374151" }}>
                {esBot ? "🤖 Asistente Virtual" : autor?.nombre || "Usuario"}
              </span>
              <span style={{ fontSize: 11, color: "#6b7fa3" }}>{fmtDate(entry.fecha)}</span>
            </div>
            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
              {entry.comentario}
            </p>
          </div>
        );
      })}
    </div>
  );
}

function TabAdjuntos({ ticket }) {
  const [adjuntos, setAdjuntos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState(null);

  useEffect(() => {
    const cargar = async () => {
      if (!ticket?.id_ticket) return;
      try {
        const { data, error } = await supabase
          .from("adjuntos")
          .select("id_adjunto, archivo")
          .eq("id_ticket", ticket.id_ticket);
        if (error) throw error;
        const conUrls = (data || []).map(adj => ({
          ...adj,
          url: supabase.storage.from("adjuntos").getPublicUrl(adj.archivo).data.publicUrl
        }));
        setAdjuntos(conUrls);
      } catch (error) {
        console.error("Error:", error);
      } finally {
        setLoading(false);
      }
    };
    cargar();
  }, [ticket?.id_ticket]);

  if (loading) return <div style={{ textAlign: "center", padding: 40 }}>Cargando...</div>;
  if (adjuntos.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: 40, color: "#6b7fa3" }}>
        <Ic n="image" size={32} style={{ opacity: 0.25 }} />
        <p>Sin imágenes adjuntas</p>
      </div>
    );
  }

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 10 }}>
        {adjuntos.map(adj => (
          <div key={adj.id_adjunto} onClick={() => setPreview(adj)} style={{
            cursor: "pointer", border: "1px solid #eef0f6", borderRadius: 8, overflow: "hidden"
          }}>
            <img src={adj.url} alt="" style={{ width: "100%", height: 120, objectFit: "cover" }} />
            <div style={{ padding: 6, fontSize: 11, color: "#6b7fa3" }}>
              {adj.archivo.split('/').pop()}
            </div>
          </div>
        ))}
      </div>
      {preview && (
        <div onClick={() => setPreview(null)} style={{
          position: "fixed", inset: 0, zIndex: 1200,
          background: "rgba(0,0,0,0.9)",
          display: "flex", alignItems: "center", justifyContent: "center"
        }}>
          <img src={preview.url} alt="" style={{ maxWidth: "90vw", maxHeight: "90vh" }} />
        </div>
      )}
    </>
  );
}

function ChatBot({ ticket, currentUser, onUpdate, toast }) {
  const [mensajes, setMensajes] = useState([]);
  const [input, setInput] = useState("");
  const [esperando, setEsperando] = useState(false);
  const [sesion, setSesion] = useState(null);
  const [botTerminado, setBotTerminado] = useState(false);
  const bottomRef = useRef(null);
  const iniciado = useRef(false);

  useEffect(() => {
    if (!ticket?.id_ticket || iniciado.current) return;
    iniciado.current = true;

    const inicializar = async () => {
      // Cargar historial existente de Supabase
      const { data: historialDB } = await supabase
        .from("historial_ticket")
        .select("*")
        .eq("id_ticket", ticket.id_ticket)
        .order("fecha", { ascending: true });

      const historialExistente = historialDB || [];

      if (historialExistente.length > 0) {
        // Ya tiene mensajes — mostrarlos
        const msgs = historialExistente.map(h => ({
          id: h.id_historial,
          esBot: h.id_usuario === null,
          texto: h.comentario,
          fecha: h.fecha
        }));
        setMensajes(msgs);

        // Reconstruir contexto del bot
        const s = botHospital.getSesion(
          ticket.id_ticket,
          ticket.titulo,
          ticket.descripcion,
          currentUser?.id_usuario
        );
        historialExistente.forEach(h => {
          s.historialChat.push({
            role: h.id_usuario === null ? "assistant" : "user",
            content: h.comentario
          });
        });
        setSesion(s);
      } else {
        // Sin mensajes — generar las 3 soluciones ahora
        setEsperando(true);
        try {
          const s = botHospital.getSesion(
            ticket.id_ticket,
            ticket.titulo,
            ticket.descripcion,
            currentUser?.id_usuario
          );
          setSesion(s);

          const entrada = await generarSoluciones(
            ticket.id_ticket,
            ticket.titulo,
            ticket.descripcion
          );

          if (entrada) {
            const msgBot = {
              id: entrada.id_historial || Date.now(),
              esBot: true,
              texto: entrada.comentario,
              fecha: entrada.fecha
            };
            setMensajes([msgBot]);
            s.historialChat.push({ role: "assistant", content: entrada.comentario });
            onUpdate?.({ ...ticket, historial: [...(ticket.historial ?? []), entrada] });
          }
        } catch (err) {
          console.error("Error generando soluciones:", err);
        } finally {
          setEsperando(false);
        }
      }
    };

    inicializar();
  }, [ticket?.id_ticket]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensajes, esperando]);

  const enviar = async () => {
    if (!input.trim() || esperando || botTerminado) return;

    const textoUsuario = input.trim();
    setInput("");

    const msgUsuario = {
      id: Date.now(),
      esBot: false,
      texto: textoUsuario,
      fecha: new Date().toISOString()
    };
    setMensajes(prev => [...prev, msgUsuario]);
    setEsperando(true);

    try {
      const s = sesion || botHospital.getSesion(
        ticket.id_ticket,
        ticket.titulo,
        ticket.descripcion,
        currentUser?.id_usuario
      );
      if (!sesion) setSesion(s);

      const respuesta = await s.procesarMensaje(textoUsuario);

      const msgBot = {
        id: Date.now() + 1,
        esBot: true,
        texto: respuesta,
        fecha: new Date().toISOString()
      };
      setMensajes(prev => [...prev, msgBot]);

      onUpdate?.({
        ...ticket,
        historial: [
          ...(ticket.historial ?? []),
          { id_historial: msgUsuario.id, id_usuario: currentUser?.id_usuario, comentario: textoUsuario, fecha: msgUsuario.fecha },
          { id_historial: msgBot.id, id_usuario: null, comentario: respuesta, fecha: msgBot.fecha }
        ]
      });

      const estado = s.getEstado();
      if (!estado.activo) {
        setBotTerminado(true);
        if (estado.resuelto) toast?.("✅ Problema resuelto por el asistente", "success");
        else if (estado.escalado) toast?.("👨‍🔧 Se ha asignado un técnico", "info");
      }
    } catch (err) {
      console.error("Error:", err);
      toast?.("Error al enviar mensaje", "error");
      setInput(textoUsuario);
    } finally {
      setEsperando(false);
    }
  };

  return (
    <div style={{
      marginTop: 16, border: "1px solid #dbeafe",
      borderRadius: 10, overflow: "hidden", background: "#f8faff"
    }}>
      {/* Header */}
      <div style={{
        padding: "10px 16px", background: "#5b8dee",
        display: "flex", alignItems: "center", gap: 8
      }}>
        <span style={{ fontSize: 16 }}>🤖</span>
        <span style={{ color: "white", fontSize: 13, fontWeight: 600 }}>Asistente Virtual</span>
        <span style={{
          marginLeft: "auto", fontSize: 11,
          color: "rgba(255,255,255,0.9)",
          background: "rgba(255,255,255,0.2)",
          padding: "2px 8px", borderRadius: 10
        }}>
          {botTerminado ? "Conversación cerrada" : sesion ? `Intento ${sesion.intentos + 1}/3` : "Activo"}
        </span>
      </div>

      {/* Mensajes */}
      <div style={{
        maxHeight: 360, overflowY: "auto", padding: 16,
        display: "flex", flexDirection: "column", gap: 12
      }}>
        {mensajes.map((msg, idx) => (
          <div key={msg.id || idx} style={{
            display: "flex", flexDirection: "column",
            alignItems: msg.esBot ? "flex-start" : "flex-end"
          }}>
            <div style={{
              maxWidth: "85%", padding: "10px 14px",
              borderRadius: msg.esBot ? "4px 12px 12px 12px" : "12px 4px 12px 12px",
              background: msg.esBot ? "white" : "#5b8dee",
              color: msg.esBot ? "#1e3a5f" : "white",
              fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-wrap",
              boxShadow: "0 1px 3px rgba(0,0,0,0.08)"
            }}>
              {msg.texto}
            </div>
            <span style={{ fontSize: 10, color: "#9ca3af", marginTop: 3, paddingLeft: 4 }}>
              {msg.esBot ? "🤖 Asistente" : currentUser?.nombre || "Tú"} · {fmtDate(msg.fecha)}
            </span>
          </div>
        ))}

        {esperando && (
          <div style={{ display: "flex", alignItems: "flex-start" }}>
            <div style={{
              padding: "10px 14px", borderRadius: "4px 12px 12px 12px",
              background: "white", boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
              display: "flex", gap: 4, alignItems: "center"
            }}>
              {[0, 1, 2].map(i => (
                <span key={i} style={{
                  width: 6, height: 6, borderRadius: "50%",
                  background: "#5b8dee", display: "inline-block",
                  animation: "bounce 1.2s infinite",
                  animationDelay: `${i * 0.2}s`
                }} />
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      {!botTerminado && (
        <div style={{
          padding: "10px 12px", borderTop: "1px solid #dbeafe",
          display: "flex", gap: 8, background: "white"
        }}>
          <input
            type="text"
            placeholder="Responde al asistente..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && !e.shiftKey && enviar()}
            disabled={esperando}
            style={{
              flex: 1, padding: "8px 12px",
              border: "1px solid #dbeafe", borderRadius: 20,
              fontSize: 13, outline: "none",
              opacity: esperando ? 0.6 : 1
            }}
          />
          <button
            onClick={enviar}
            disabled={!input.trim() || esperando}
            style={{
              background: "#5b8dee", color: "white", border: "none",
              borderRadius: 20, padding: "8px 16px", fontSize: 13,
              cursor: "pointer", opacity: !input.trim() || esperando ? 0.5 : 1
            }}
          >
            Enviar
          </button>
        </div>
      )}

      <style>{`
        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-6px); }
        }
      `}</style>
    </div>
  );
}

export function TicketDetail({ ticket, onClose, users = [], areas = [], currentUser, onUpdate, toast }) {
  const [tab, setTab] = useState("detalles");

  if (!ticket) return null;

  const prioridad = getPrioridad(ticket.id_prioridad);
  const getUser = (id) => users?.find(u => u?.id_usuario === id) || null;
  const getArea = (id) => areas?.find(a => a?.id_area === id) || null;
  const nHistorial = ticket.historial?.length ?? 0;
  const tecnicoAsignado = getUser(ticket.id_tecnico);
  const esCerrado = ticket.id_estado === 3;

  const tabs = [
    { id: "detalles", label: "Detalles", icon: "file-text" },
    { id: "adjuntos", label: "Adjuntos", icon: "image" },
    { id: "historial", label: "Historial", icon: "clock", badge: nHistorial }
  ];

  return (
    <div className="hd-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="hd-modal" style={{ maxWidth: 700, maxHeight: "90vh", overflow: "auto" }}>

        <div className="hd-modal__header" style={{
          padding: 20, borderBottom: "1px solid #eef0f6",
          display: "flex", justifyContent: "space-between", alignItems: "flex-start"
        }}>
          <div>
            <div style={{ fontSize: 12, color: "#6b7fa3", marginBottom: 4 }}>TICKET #{ticket.id_ticket}</div>
            <h3 style={{ margin: "0 0 8px 0", fontSize: 18 }}>{ticket.titulo}</h3>
            <div style={{ display: "flex", gap: 10 }}>
              <Badge id_estado={ticket.id_estado} />
              <span style={{ fontSize: 12, color: prioridad?.color, fontWeight: 600 }}>● {prioridad?.label}</span>
            </div>
          </div>
          <button onClick={onClose} style={{
            background: "#f3f4f6", border: "none",
            width: 32, height: 32, borderRadius: 16, cursor: "pointer", fontSize: 16
          }}>✕</button>
        </div>

        <div style={{ display: "flex", borderBottom: "1px solid #eef0f6", padding: "0 20px" }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              padding: "12px 16px", background: "none", border: "none",
              borderBottom: tab === t.id ? "2px solid #5b8dee" : "none",
              color: tab === t.id ? "#5b8dee" : "#6b7fa3",
              fontWeight: tab === t.id ? 600 : 400, cursor: "pointer",
              display: "flex", alignItems: "center", gap: 6
            }}>
              <Ic n={t.icon} size={14} />
              {t.label}
              {t.badge > 0 && (
                <span style={{
                  background: tab === t.id ? "#5b8dee" : "#eef0f6",
                  color: tab === t.id ? "#fff" : "#6b7fa3",
                  padding: "2px 6px", borderRadius: 10, fontSize: 10
                }}>{t.badge}</span>
              )}
            </button>
          ))}
        </div>

        <div style={{ padding: 24 }}>
          {tab === "detalles" && (
            <>
              <div style={{
                display: "grid", gridTemplateColumns: "repeat(2, 1fr)",
                gap: 16, background: "#f8f9fd", padding: 16,
                borderRadius: 8, marginBottom: 20
              }}>
                <div>
                  <div style={{ fontSize: 11, color: "#6b7fa3" }}>Usuario</div>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>{getUser(ticket.id_usuario)?.nombre || "—"}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: "#6b7fa3" }}>Área</div>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>{getArea(ticket.id_area)?.nombre_area || "—"}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: "#6b7fa3" }}>Fecha creación</div>
                  <div style={{ fontSize: 14 }}>{fmtDate(ticket.fecha_creacion)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: "#6b7fa3" }}>Técnico asignado</div>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>
                    {tecnicoAsignado ? tecnicoAsignado.nombre : <span style={{ color: "#f97316" }}>Pendiente</span>}
                  </div>
                </div>
              </div>

              <div style={{ marginBottom: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Descripción</div>
                <div style={{
                  background: "#f8f9fd", padding: 16,
                  borderRadius: 8, fontSize: 14, lineHeight: 1.6
                }}>
                  {ticket.descripcion}
                </div>
              </div>

              {!esCerrado && (
                <ChatBot
                  ticket={ticket}
                  currentUser={currentUser}
                  onUpdate={onUpdate}
                  toast={toast}
                />
              )}

              {esCerrado && (
                <div style={{
                  marginTop: 16, background: "#f0fdf4",
                  border: "1px solid #bbf7d0", borderRadius: 8, padding: 12,
                  display: "flex", alignItems: "center", gap: 8, color: "#166534"
                }}>
                  <span>✅ Ticket cerrado</span>
                </div>
              )}
            </>
          )}

          {tab === "adjuntos" && <TabAdjuntos ticket={ticket} />}
          {tab === "historial" && <TabHistorial ticket={ticket} users={users} />}
        </div>
      </div>
    </div>
  );
}