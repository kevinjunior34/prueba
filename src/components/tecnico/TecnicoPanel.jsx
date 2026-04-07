import { useState, useEffect } from "react";
import { TRow } from "../common/TRow";
import { Badge } from "../common/Badge";
import { Ic } from "../common/Ic";
import { getPrioridad, fmtDate } from "../../utils/helpers";
import { supabase } from "../../lib/supabase";
import TicketDetalleModal from "./TicketDetalleModal";

// ─── Tab: Adjuntos ─────────────────────────────────────────
function TabAdjuntos({ ticket }) {
  const [adjuntos, setAdjuntos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState(null);

  useEffect(() => {
    const cargar = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("adjuntos")
          .select("id_adjunto, archivo")
          .eq("id_ticket", ticket.id_ticket);

        if (error) throw error;

        const conUrls = (data || []).map(adj => {
          const { data: urlData } = supabase.storage
            .from("adjuntos")
            .getPublicUrl(adj.archivo);
          return { ...adj, url: urlData.publicUrl };
        });

        setAdjuntos(conUrls);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    cargar();
  }, [ticket.id_ticket]);

  if (loading) return <div style={{ padding: 40 }}>Cargando...</div>;

  if (!adjuntos.length) return <div style={{ padding: 40 }}>Sin adjuntos</div>;

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 10 }}>
        {adjuntos.map(adj => (
          <img
            key={adj.id_adjunto}
            src={adj.url}
            alt=""
            style={{ width: "100%", height: 110, objectFit: "cover", cursor: "pointer" }}
            onClick={() => setPreview(adj)}
          />
        ))}
      </div>

      {preview && (
        <div onClick={() => setPreview(null)} style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.9)",
          display: "flex", justifyContent: "center", alignItems: "center"
        }}>
          <img src={preview.url} style={{ maxWidth: "90%", maxHeight: "90%" }} />
        </div>
      )}
    </>
  );
}

// ─── Tab: Historial ────────────────────────────────────────
function TabHistorial({ ticket, user, onComentarioEnviado }) {
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);

  const enviar = async () => {
  if (!texto.trim()) return;

  setEnviando(true);
  try {
    // 1. Guardar comentario
    const { data, error } = await supabase
      .from("historial_ticket")
      .insert([{
        id_ticket: ticket.id_ticket,
        id_usuario: user.id_usuario,
        comentario: texto.trim(),
      }])
      .select();

    if (error) throw error;

    onComentarioEnviado(data[0]);
    setTexto("");

    // =========================
    // 📩 2. OBTENER CORREO DEL USUARIO DEL TICKET
    // =========================
    const { data: ticketData } = await supabase
      .from("tickets")
      .select("id_usuario")
      .eq("id_ticket", ticket.id_ticket)
      .single();

    if (!ticketData) return;

    const { data: usuario } = await supabase
      .from("usuarios")
      .select("correo, nombre")
      .eq("id_usuario", ticketData.id_usuario)
      .single();

    if (!usuario?.correo) return;

    // =========================
    // 📩 3. ENVIAR CORREO
    // =========================
    await fetch("https://gelngkrfmbzjpbhesexd.supabase.co/functions/v1/enviar-correo", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        email: usuario.correo, // ⚠️ en pruebas usa tu correo
        mensaje: `El técnico ${user.nombre} respondió a tu ticket #${ticket.id_ticket}: \n\n"${texto}"`,
        ticket: ticket.id_ticket
      })
    });

  } catch (err) {
    console.error("Error:", err);
  } finally {
    setEnviando(false);
  }
  };

  return (
    <div>
      {(ticket.historial || []).map(h => (
        <div key={h.id_historial}>{h.comentario}</div>
      ))}

      <textarea value={texto} onChange={e => setTexto(e.target.value)} />
      <button onClick={enviar}>{enviando ? "..." : "Enviar"}</button>
    </div>
  );
}

// ─── Modal ────────────────────────────────────────────────
function TicketDetalleModal({ ticket: initialTicket, user, areas, onClose, onCambiarEstado }) {
  const [ticket, setTicket] = useState(initialTicket);

  return (
    <div className="hd-overlay">
      <div className="hd-modal">
        <h3>{ticket.titulo}</h3>

        <button onClick={() => onCambiarEstado(ticket, 3, setTicket)}>
          ✅ Cerrar Ticket
        </button>
      </div>
    </div>
  );
}

// ─── PANEL TECNICO ─────────────────────────────────────────
export function TecnicoPanel({ user, tickets, setTickets, areas, toast }) {
  const [sel, setSel] = useState(null);

  const cambiar = async (t, estado, setTicketLocal) => {
    try {
      const upd = {
        ...t,
        id_estado: estado,
        fecha_cierre: estado === 3 ? new Date().toISOString() : null
      };

      // 1. Actualizar BD
      const { error } = await supabase
        .from("tickets")
        .update({
          id_estado: estado,
          fecha_cierre: upd.fecha_cierre
        })
        .eq("id_ticket", t.id_ticket);

      if (error) throw error;

      // 2. Historial
      await supabase.from("historial_ticket").insert([{
        id_ticket: t.id_ticket,
        id_usuario: user.id_usuario,
        comentario: `Estado cambiado a: ${estado === 3 ? "Cerrado" : "En proceso"}`
      }]);

      // 3. 📩 EMAIL AL ADMIN
      if (estado === 3) {
        await fetch("https://gelngkrfmbzjpbhesexd.supabase.co/functions/v1/enviar-correo", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            email: "rodolfomartinsincheflores1@gmail.com",
            mensaje: `El ticket #${t.id_ticket} fue cerrado por ${user.nombre}`,
            ticket: t.id_ticket
          })
        });
      }

      // 4. UI
      setTickets(prev =>
        prev.map(x => x.id_ticket === t.id_ticket ? upd : x)
      );

      if (setTicketLocal) setTicketLocal(upd);

      toast("Estado actualizado", "success");

    } catch (err) {
      console.error(err);
      toast("Error", "error");
    }
  };

  return (
    <div>
      <h2>Panel Técnico</h2>

      {tickets.map(t => (
        <div key={t.id_ticket} onClick={() => setSel(t)}>
          {t.titulo}
        </div>
      ))}

      {sel && (
        <TicketDetalleModal
          ticket={sel}
          user={user}
          areas={areas}
          onClose={() => setSel(null)}
          onCambiarEstado={cambiar}
        />
      )}
    </div>
  );
}