import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

export default function TabAdjuntos({ ticket }) {
  const [adjuntos, setAdjuntos] = useState([]);

  useEffect(() => {
    const cargar = async () => {
      const { data } = await supabase
        .from("adjuntos")
        .select("*")
        .eq("id_ticket", ticket.id_ticket);

      const conUrl = (data || []).map(a => {
        const { data: urlData } = supabase.storage
          .from("adjuntos")
          .getPublicUrl(a.archivo);

        return { ...a, url: urlData.publicUrl };
      });

      setAdjuntos(conUrl);
    };

    cargar();
  }, [ticket.id_ticket]);

  if (!adjuntos.length) return <p>Sin adjuntos</p>;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
      {adjuntos.map(a => (
        <img
          key={a.id_adjunto}
          src={a.url}
          style={{ width: "100%", height: 100, objectFit: "cover" }}
        />
      ))}
    </div>
  );
}