/**
 * BotEntrenamiento.jsx
 * Panel de administración para entrenar y supervisar el bot.
 * Permite al admin ver el feedback acumulado y agregar nuevas
 * entradas a la base de conocimiento del bot.
 */

import { useState, useEffect } from "react";
import { botHospital } from "../../lib/botHospital";

const CATEGORIAS = [
  "Red / Conectividad",
  "Impresora",
  "Contraseña / Acceso",
  "Rendimiento del equipo",
  "Software / Aplicaciones",
  "Correo electrónico",
  "Hardware / Equipo físico",
  "Otro",
];

export function BotEntrenamiento({ toast }) {
  const [baseConocimiento, setBaseConocimiento] = useState([]);
  const [feedback, setFeedback] = useState([]);
  const [tab, setTab] = useState("base");
  const [modal, setModal] = useState(false);
  const [nueva, setNueva] = useState({
    categoria: "",
    keywords: "",
    pasos: ["", "", ""],
    resolucion: "",
  });

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = () => {
    const base = botHospital.motor._cargarBase ? botHospital.motor.base : [];
    setBaseConocimiento(base);

    const fb = botHospital.motor._cargarFeedback();
    setFeedback(fb.reverse().slice(0, 50));
  };

  const agregarEntrada = () => {
    const keywords = nueva.keywords
      .split(",")
      .map(k => k.trim().toLowerCase())
      .filter(k => k.length > 0);

    const pasos = nueva.pasos.filter(p => p.trim().length > 0);

    if (!nueva.categoria || keywords.length === 0 || pasos.length === 0) {
      toast?.("Completa categoría, keywords y al menos un paso", "error");
      return;
    }

    const entrada = {
      id: `custom_${Date.now()}`,
      categoria: nueva.categoria,
      keywords,
      pasos,
      resolucion: nueva.resolucion || "El técnico continuará con la atención.",
    };

    botHospital.motor.base.push(entrada);
    botHospital.motor._guardarBase();

    toast?.("✅ Entrada agregada a la base de conocimiento", "success");
    setModal(false);
    setNueva({ categoria: "", keywords: "", pasos: ["", "", ""], resolucion: "" });
    cargarDatos();
  };

  const eliminarEntrada = (id) => {
    if (!window.confirm("¿Eliminar esta entrada de la base de conocimiento?")) return;
    botHospital.motor.base = botHospital.motor.base.filter(e => e.id !== id);
    botHospital.motor._guardarBase();
    toast?.("Entrada eliminada", "success");
    cargarDatos();
  };

  const statResueltos = feedback.filter(f => f.resuelto).length;
  const statEscalados = feedback.filter(f => !f.resuelto).length;

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ margin: "0 0 4px", fontSize: 22 }}>🤖 Entrenamiento del Bot</h2>
        <p style={{ color: "#6b7fa3", margin: 0 }}>
          Gestiona la base de conocimiento y supervisa el aprendizaje del asistente virtual
        </p>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16, marginBottom: 24 }}>
        {[
          { label: "Entradas en base", value: baseConocimiento.length, bg: "#e8effe", emoji: "📚" },
          { label: "Resueltos por bot", value: statResueltos, bg: "#dcfce7", emoji: "✅" },
          { label: "Escalados a técnico", value: statEscalados, bg: "#fee2e2", emoji: "👨‍🔧" },
        ].map(s => (
          <div key={s.label} style={{
            background: s.bg, borderRadius: 10,
            padding: "16px 20px", display: "flex", alignItems: "center", gap: 12
          }}>
            <span style={{ fontSize: 28 }}>{s.emoji}</span>
            <div>
              <div style={{ fontSize: 24, fontWeight: 700 }}>{s.value}</div>
              <div style={{ fontSize: 12, color: "#6b7fa3" }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", borderBottom: "2px solid #eef0f6", marginBottom: 20 }}>
        {[
          { id: "base", label: "📚 Base de Conocimiento" },
          { id: "feedback", label: "📊 Historial de Aprendizaje" },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: "10px 18px",
            background: "none",
            border: "none",
            borderBottom: tab === t.id ? "2px solid #5b8dee" : "none",
            color: tab === t.id ? "#5b8dee" : "#6b7fa3",
            fontWeight: tab === t.id ? 700 : 400,
            cursor: "pointer",
            marginBottom: -2,
          }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab: Base de Conocimiento */}
      {tab === "base" && (
        <>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
            <button
              onClick={() => setModal(true)}
              style={{
                background: "#5b8dee", color: "white",
                border: "none", borderRadius: 8,
                padding: "10px 18px", cursor: "pointer", fontWeight: 600,
              }}
            >
              + Agregar entrada
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {baseConocimiento.map((entrada) => (
              <div key={entrada.id} style={{
                border: "1px solid #eef0f6",
                borderRadius: 10, padding: 16,
                background: entrada.id.startsWith("custom") ? "#fffbf0" : "#fff",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                      <span style={{
                        background: "#e8effe", color: "#5b8dee",
                        padding: "2px 8px", borderRadius: 12, fontSize: 11, fontWeight: 600
                      }}>
                        {entrada.categoria}
                      </span>
                      {entrada.id.startsWith("custom") && (
                        <span style={{
                          background: "#fef3c7", color: "#d97706",
                          padding: "2px 8px", borderRadius: 12, fontSize: 11
                        }}>
                          Personalizado
                        </span>
                      )}
                    </div>
                    <div style={{ marginBottom: 8 }}>
                      <span style={{ fontSize: 12, color: "#6b7fa3", fontWeight: 600 }}>Keywords: </span>
                      <span style={{ fontSize: 12 }}>{entrada.keywords.slice(0, 10).join(", ")}{entrada.keywords.length > 10 ? "..." : ""}</span>
                    </div>
                    <div style={{ fontSize: 12, color: "#374151" }}>
                      <strong>{entrada.pasos.length} paso{entrada.pasos.length !== 1 ? "s" : ""} de diagnóstico</strong>
                    </div>
                  </div>
                  <button
                    onClick={() => eliminarEntrada(entrada.id)}
                    style={{
                      background: "#fee2e2", color: "#dc2626",
                      border: "none", borderRadius: 6,
                      padding: "6px 10px", cursor: "pointer", fontSize: 12,
                    }}
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Tab: Feedback */}
      {tab === "feedback" && (
        <div>
          {feedback.length === 0 ? (
            <div style={{ textAlign: "center", padding: 60, color: "#6b7fa3" }}>
              <p style={{ fontSize: 32, margin: 0 }}>📊</p>
              <p>Aún no hay datos de aprendizaje. El bot aprenderá a medida que los usuarios interactúen con él.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {feedback.map((f, i) => (
                <div key={i} style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: 12, borderRadius: 8,
                  background: f.resuelto ? "#f0fdf4" : "#fff7f0",
                  border: `1px solid ${f.resuelto ? "#bbf7d0" : "#fed7aa"}`,
                }}>
                  <span style={{ fontSize: 18 }}>{f.resuelto ? "✅" : "👨‍🔧"}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{f.textoUsuario}</div>
                    <div style={{ fontSize: 11, color: "#6b7fa3" }}>
                      {f.entradaId} · {f.fecha ? new Date(f.fecha).toLocaleDateString("es-PE") : "—"}
                    </div>
                  </div>
                  <span style={{
                    fontSize: 11, fontWeight: 600,
                    color: f.resuelto ? "#16a34a" : "#d97706",
                  }}>
                    {f.resuelto ? "Resuelto" : "Escalado"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal: Agregar entrada */}
      {modal && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 1100,
          background: "rgba(0,0,0,0.5)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <div style={{
            background: "white", borderRadius: 12,
            padding: 28, width: 540, maxHeight: "90vh",
            overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
          }}>
            <h3 style={{ margin: "0 0 20px" }}>➕ Nueva entrada de conocimiento</h3>

            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}>Categoría</label>
                <select
                  value={nueva.categoria}
                  onChange={e => setNueva(p => ({ ...p, categoria: e.target.value }))}
                  style={{ width: "100%", padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: 6 }}
                >
                  <option value="">Seleccionar categoría</option>
                  {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}>
                  Keywords (separadas por comas)
                </label>
                <input
                  value={nueva.keywords}
                  onChange={e => setNueva(p => ({ ...p, keywords: e.target.value }))}
                  placeholder="ej: impresora, no imprime, papel, atasco"
                  style={{ width: "100%", padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: 6 }}
                />
              </div>

              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}>Pasos de diagnóstico</label>
                {nueva.pasos.map((paso, i) => (
                  <div key={i} style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 12, color: "#6b7fa3", marginBottom: 4 }}>Paso {i + 1}</div>
                    <textarea
                      rows={2}
                      value={paso}
                      onChange={e => {
                        const pasos = [...nueva.pasos];
                        pasos[i] = e.target.value;
                        setNueva(p => ({ ...p, pasos }));
                      }}
                      placeholder={`Pregunta o instrucción del paso ${i + 1}...`}
                      style={{ width: "100%", padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: 6, resize: "vertical" }}
                    />
                  </div>
                ))}
              </div>

              <div>
                <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}>
                  Mensaje de resolución/escalado
                </label>
                <textarea
                  rows={2}
                  value={nueva.resolucion}
                  onChange={e => setNueva(p => ({ ...p, resolucion: e.target.value }))}
                  placeholder="Ej: Si persiste el problema, el técnico evaluará el hardware..."
                  style={{ width: "100%", padding: "8px 10px", border: "1px solid #d1d5db", borderRadius: 6, resize: "vertical" }}
                />
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 20, justifyContent: "flex-end" }}>
              <button
                onClick={() => setModal(false)}
                style={{ padding: "9px 18px", borderRadius: 8, border: "1px solid #d1d5db", background: "#fff", cursor: "pointer" }}
              >
                Cancelar
              </button>
              <button
                onClick={agregarEntrada}
                style={{ padding: "9px 18px", borderRadius: 8, border: "none", background: "#5b8dee", color: "white", cursor: "pointer", fontWeight: 600 }}
              >
                Guardar entrada
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
