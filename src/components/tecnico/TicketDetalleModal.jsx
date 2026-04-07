import { useState } from "react";
import TabAdjuntos from "./TabAdjuntos";
import TabHistorial from "./TabHistorial";

export default function TicketDetalleModal({ ticket, user, onClose, onCambiarEstado }) {
  const [tab, setTab] = useState("detalles");

  return (
    <div className="hd-overlay">
      <div className="hd-modal">

        {/* HEADER */}
        <div className="hd-modal__header">
          <div>
            <div className="hd-modal__id">TICKET #{ticket.id_ticket}</div>
            <div className="hd-modal__title">{ticket.titulo}</div>
            <div className="hd-modal__meta">
              <span className="hd-badge cerrado">Cerrado</span>
            </div>
          </div>

          <button className="hd-modal__close" onClick={onClose}>
            ✕
          </button>
        </div>

        {/* BODY */}
        <div className="hd-modal__body">

          {/* TABS */}
          <div style={{ marginBottom: 15 }}>
            <button
              className={`hd-tab ${tab === "detalles" ? "active" : ""}`}
              onClick={() => setTab("detalles")}
            >
              Detalles
            </button>

            <button
              className={`hd-tab ${tab === "adjuntos" ? "active" : ""}`}
              onClick={() => setTab("adjuntos")}
            >
              Adjuntos
            </button>

            <button
              className={`hd-tab ${tab === "historial" ? "active" : ""}`}
              onClick={() => setTab("historial")}
            >
              Historial
            </button>
          </div>

          {/* CONTENIDO */}
          {tab === "detalles" && (
            <>
              <div className="hd-info-grid">
                <div className="hd-field-row">
                  <div className="hd-field-row__label">Usuario</div>
                  <div className="hd-field-row__value">{ticket.usuario}</div>
                </div>

                <div className="hd-field-row">
                  <div className="hd-field-row__label">Área</div>
                  <div className="hd-field-row__value">{ticket.area}</div>
                </div>
              </div>

              <div className="hd-section-lbl">Descripción</div>
              <div className="hd-desc-box">{ticket.descripcion}</div>

              {ticket.id_estado === 3 && (
                <div className="hd-closed-box">
                  ✅ Ticket cerrado
                </div>
              )}

              {ticket.id_estado !== 3 && (
                <button
                  className="hd-btn-primary"
                  onClick={() => onCambiarEstado(ticket, 3)}
                >
                  Cerrar Ticket
                </button>
              )}
            </>
          )}

          {tab === "adjuntos" && <TabAdjuntos ticket={ticket} />}

          {tab === "historial" && (
            <TabHistorial
              ticket={ticket}
              user={user}
              onComentarioEnviado={() => {}}
            />
          )}
        </div>
      </div>
    </div>
  );
}