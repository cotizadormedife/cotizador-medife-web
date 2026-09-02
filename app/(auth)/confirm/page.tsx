"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Status = "verifying" | "invalid" | "done";

export default function ConfirmPage() {
  return (
    <Suspense fallback={<h2 style={{ fontSize: 26, fontWeight: 600, margin: "0 0 8px" }}>Cargando...</h2>}>
      <ConfirmForm />
    </Suspense>
  );
}

function ConfirmForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<Status>("verifying");

  useEffect(() => {
    const supabase = createClient();

    async function verify() {
      const tokenHash = searchParams.get("token_hash");
      const type = searchParams.get("type");

      if (tokenHash && type) {
        const { error } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: type as "signup" | "email_change",
        });
        if (error) {
          setStatus("invalid");
          return;
        }
        setStatus("done");
        setTimeout(() => router.push("/"), 1000);
        return;
      }

      // Algunos clientes ya traen la sesión establecida (hash fragment
      // procesado automáticamente por el SDK) — chequeamos por las dudas.
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        setStatus("done");
        setTimeout(() => router.push("/"), 1000);
      } else {
        setStatus("invalid");
      }
    }

    verify();
  }, [searchParams, router]);

  if (status === "invalid") {
    return (
      <div>
        <h2 style={{ fontSize: 26, fontWeight: 600, margin: "0 0 8px" }}>Link inválido o vencido</h2>
        <p style={{ color: "var(--text-neutral)", fontSize: 15 }}>
          Pedile a tu administrador que te reenvíe la confirmación, o registrate de nuevo.
        </p>
      </div>
    );
  }

  if (status === "done") {
    return (
      <div>
        <h2 style={{ fontSize: 26, fontWeight: 600, margin: "0 0 8px" }}>¡Email confirmado!</h2>
        <p style={{ color: "var(--text-neutral)", fontSize: 15 }}>Ingresando...</p>
      </div>
    );
  }

  return (
    <div>
      <h2 style={{ fontSize: 26, fontWeight: 600, margin: "0 0 8px" }}>Confirmando tu email...</h2>
    </div>
  );
}
