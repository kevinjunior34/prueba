import { useState } from "react";
import TabAdjuntos from "./TabAdjuntos";
import TabHistorial from "./TabHistorial";

export default function TicketDetalleModal({ ticket: initialTicket, user, onClose, onCambiarEstado }) {
  const [tab, setTab] = useState("historial");
  const [ticket, setTicket] = useState(initialTicket);

  return (
    <div className="hd-overlay">
      <div className="hd-modal">

        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <h2>{ticket.titulo}</h2>
          <button onClick={onClose}>❌</button>
        </div>

        <p>{ticket.descripcion}</p>

        <div>
          <button onClick={() => setTab("historial")}>Historial</button>
          <button onClick={() => setTab("adjuntos")}>Adjuntos</button>
        </div>

        <div style={{ marginTop: 10 }}>
          {tab === "historial" && (
            <TabHistorial
              ticket={ticket}
              user={user}
              onComentarioEnviado={(nuevo) => {
                setTicket(prev => ({
                  ...prev,
                  historial: [...(prev.historial || []), nuevo]
                }));
              }}
            />
          )}

          {tab === "adjuntos" && (
            <TabAdjuntos ticket={ticket} />
          )}
        </div>

        <div style={{ marginTop: 20 }}>
          <button onClick={() => onCambiarEstado(ticket, 2, setTicket)}>
            En proceso
          </button>

          <button onClick={() => onCambiarEstado(ticket, 3, setTicket)}>
            Cerrar
          </button>
        </div>

      </div>
    </div>
  );
}