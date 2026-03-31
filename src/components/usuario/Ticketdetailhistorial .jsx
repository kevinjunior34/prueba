import { useState, useEffect } from "react";
import { obtenerHistorialCompleto } from "../../lib/botHospital";

const FILTROS = ["todos", "bot", "usuario"];
const LABELS  = { todos: "Todos", bot: "🤖 Bot", usuario: "👤 Usuario" };
const COLORES = {
  bot:     { bg: "#EFF6FF", borde: "#93C5FD", texto: "#1E40AF" },
  usuario: { bg: "#F8F9FD", borde: "#E5E7EB", texto: "#374151" },
};

export function TicketDetailHistorial({ ticket }) {
  const [historial, setHistorial] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState("todos");

  useEffect(() => {
    if (!ticket?.id_ticket) return;
    setCargando(true);
    obtenerHistorialCompleto(ticket.id_ticket)
      .then(setHistorial)
      .finally(() => setCargando(false));
  }, [ticket?.id_ticket]);

  const filtrado = historial.filter(e => {
    const texto = e.comentario?.toLowerCase() ?? "";
    const autor = e.autor?.toLowerCase() ?? "";
    const pasaBusqueda =
      busqueda === "" ||
      texto.includes(busqueda.toLowerCase()) ||
      autor.includes(busqueda.toLowerCase());
    const pasaFiltro =
      filtro === "todos" ||
      (filtro === "bot" && e.esBot) ||
      (filtro === "usuario" && !e.esBot);
    return pasaBusqueda && pasaFiltro;
  });

  if (cargando) return (
    <div style={{ textAlign: "center", padding: 40, color: "#6b7fa3" }}>
      Cargando historial...
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

      {/* Barra de filtros */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
        {FILTROS.map(f => (
          <button key={f} onClick={() => setFiltro(f)} style={{
            padding: "3px 10px",
            borderRadius: 999,
            fontSize: 11,
            fontWeight: 600,
            cursor: "pointer",
            border: "1px solid",
            borderColor: filtro === f ? "#5b8dee" : "#d1d5db",
            background:  filtro === f ? "#5b8dee" : "#fff",
            color:       filtro === f ? "#fff"    : "#6b7280",
          }}>
            {LABELS[f]}
          </button>
        ))}
        <input
          type="text"
          placeholder="🔍 Buscar..."
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          style={{
            marginLeft: "auto",
            padding: "4px 10px",
            borderRadius: 6,
            border: "1px solid #d1d5db",
            fontSize: 12,
            color: "#374151",
            outline: "none",
            minWidth: 160,
          }}
        />
      </div>

      {/* Conteo */}
      <div style={{ fontSize: 11, color: "#9ca3af" }}>
        {filtrado.length} de {historial.length} entrada{historial.length !== 1 ? "s" : ""}
      </div>

      {/* Entradas */}
      {filtrado.length === 0 ? (
        <div style={{ textAlign: "center", padding: 32, color: "#6b7fa3", fontSize: 13 }}>
          Sin resultados para los filtros seleccionados.
        </div>
      ) : (
        filtrado.map((entry, idx) => {
          const tipo = entry.esBot ? "bot" : "usuario";
          const colores = COLORES[tipo];
          return (
            <div key={entry.id ?? idx} style={{
              padding: 12,
              borderRadius: 8,
              background: colores.bg,
              borderLeft: `4px solid ${colores.borde}`,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: colores.texto }}>
                  {entry.autor}
                </span>
                <span style={{ fontSize: 11, color: "#6b7fa3" }}>
                  {entry.fecha ? new Date(entry.fecha).toLocaleString("es-PE", {
                    day: "2-digit", month: "2-digit", year: "numeric",
                    hour: "2-digit", minute: "2-digit"
                  }) : ""}
                </span>
              </div>
              <p style={{
                margin: 0, fontSize: 13, lineHeight: 1.5,
                whiteSpace: "pre-wrap", color: "#374151"
              }}>
                {entry.comentario}
              </p>
            </div>
          );
        })
      )}
    </div>
  );
}