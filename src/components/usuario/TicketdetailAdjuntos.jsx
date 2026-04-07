import { useState, useEffect } from "react";
import { Ic } from "../common/Ic";
import { supabase } from "../../lib/supabase";

export function TicketDetailAdjuntos({ ticket }) {
  const [adjuntos, setAdjuntos] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [preview, setPreview]   = useState(null);

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
          url: supabase.storage.from("adjuntos").getPublicUrl(adj.archivo).data.publicUrl,
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

  if (loading) return (
    <div style={{ textAlign: "center", padding: 40, color: "#6b7fa3" }}>
      Cargando adjuntos...
    </div>
  );

  if (adjuntos.length === 0) return (
    <div style={{ textAlign: "center", padding: 40, color: "#6b7fa3" }}>
      <Ic n="image" size={32} style={{ opacity: 0.25 }} />
      <p style={{ margin: "8px 0 0" }}>Sin imágenes adjuntas</p>
    </div>
  );

  return (
    <>
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
        gap: 10,
      }}>
        {adjuntos.map(adj => (
          <div
            key={adj.id_adjunto}
            onClick={() => setPreview(adj)}
            style={{
              cursor: "pointer",
              border: "1px solid #eef0f6",
              borderRadius: 8,
              overflow: "hidden",
              transition: "box-shadow 0.15s",
            }}
            onMouseEnter={e => e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.1)"}
            onMouseLeave={e => e.currentTarget.style.boxShadow = "none"}
          >
            <img
              src={adj.url}
              alt=""
              style={{ width: "100%", height: 120, objectFit: "cover", display: "block" }}
            />
            <div style={{ padding: "6px 8px", fontSize: 11, color: "#6b7fa3", wordBreak: "break-all" }}>
              {adj.archivo.split("/").pop()}
            </div>
          </div>
        ))}
      </div>

      {/* Lightbox */}
      {preview && (
        <div
          onClick={() => setPreview(null)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1200,
            background: "rgba(0,0,0,0.9)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <img
            src={preview.url}
            alt=""
            style={{ maxWidth: "90vw", maxHeight: "90vh", borderRadius: 8 }}
          />
          <button
            onClick={() => setPreview(null)}
            style={{
              position: "absolute",
              top: 20,
              right: 20,
              background: "rgba(255,255,255,0.15)",
              border: "none",
              color: "#fff",
              width: 36,
              height: 36,
              borderRadius: 18,
              cursor: "pointer",
              fontSize: 18,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            ✕
          </button>
        </div>
      )}
    </>
  );
}