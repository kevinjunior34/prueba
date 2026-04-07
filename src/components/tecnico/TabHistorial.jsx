import { useState } from "react";
import { supabase } from "../../lib/supabase";

export default function TabHistorial({ ticket, user, onComentarioEnviado }) {
  const [texto, setTexto] = useState("");

  const enviar = async () => {
    if (!texto.trim()) return;

    const { data, error } = await supabase
      .from("historial_ticket")
      .insert([{
        id_ticket: ticket.id_ticket,
        id_usuario: user.id_usuario,
        comentario: texto
      }])
      .select();

    if (error) return console.error(error);

    onComentarioEnviado(data[0]);
    setTexto("");
  };

  return (
    <div>
      <div style={{ marginBottom: 10 }}>
        {(ticket.historial || []).map(h => (
          <div key={h.id_historial} style={{ padding: 5, borderBottom: "1px solid #eee" }}>
            {h.comentario}
          </div>
        ))}
      </div>

      <textarea
        value={texto}
        onChange={e => setTexto(e.target.value)}
        placeholder="Escribe un comentario..."
        style={{ width: "100%" }}
      />

      <button onClick={enviar}>Enviar</button>
    </div>
  );
}