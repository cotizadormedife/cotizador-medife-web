"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { checkInviteTokenAction, redeemInviteTokenAction } from "./actions";

type Status = "verifying" | "ready" | "invalid" | "saving" | "done";

export default function SetPasswordPage() {
  return (
    <Suspense fallback={<h2 style={{ fontSize: 26, fontWeight: 600, margin: "0 0 8px" }}>Cargando...</h2>}>
      <SetPasswordForm />
    </Suspense>
  );
}

function SetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<Status>("verifying");
  const [email, setEmail] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();

    async function verify() {
      const invite = searchParams.get("invite");
      const tokenHash = searchParams.get("token_hash");
      const type = searchParams.get("type");

      // RF-21/RF-56/RF-57: link de primer ingreso propio, sin vencimiento —
      // no pasa por el token_hash/verifyOtp de Supabase.
      if (invite) {
        const res = await checkInviteTokenAction(invite);
        if (!res.ok) {
          setStatus("invalid");
          return;
        }
        setEmail(res.email);
        setStatus("ready");
        return;
      }

      if (tokenHash && type) {
        const { data, error: verifyErr } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: type as "invite" | "recovery",
        });
        if (verifyErr || !data.user) {
          setStatus("invalid");
          return;
        }
        setEmail(data.user.email ?? null);
        setStatus("ready");
        return;
      }

      // Algunos clientes ya traen la sesión establecida (hash fragment procesado
      // automáticamente por el SDK) — chequeamos por las dudas.
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        setEmail(data.user.email ?? null);
        setStatus("ready");
      } else {
        setStatus("invalid");
      }
    }

    verify();
  }, [searchParams]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    if (password !== confirm) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    setStatus("saving");
    const supabase = createClient();
    const invite = searchParams.get("invite");

    if (invite) {
      const res = await redeemInviteTokenAction(invite, password);
      if (!res.ok) {
        setError(res.error);
        setStatus("ready");
        return;
      }
      // El token propio no establece sesión (no depende de Supabase Auth) —
      // iniciamos sesión normalmente con la contraseña recién definida.
      const { error: signInErr } = await supabase.auth.signInWithPassword({ email: res.email, password });
      if (signInErr) {
        setError(signInErr.message);
        setStatus("ready");
        return;
      }
    } else {
      const { error: updErr } = await supabase.auth.updateUser({ password });
      if (updErr) {
        setError(updErr.message);
        setStatus("ready");
        return;
      }
    }
    setStatus("done");
    setTimeout(() => router.push("/quotes"), 1200);
  }

  if (status === "verifying") {
    return (
      <div>
        <h2 style={{ fontSize: 26, fontWeight: 600, margin: "0 0 8px" }}>Verificando tu invitación...</h2>
      </div>
    );
  }

  if (status === "invalid") {
    return (
      <div>
        <h2 style={{ fontSize: 26, fontWeight: 600, margin: "0 0 8px" }}>Link inválido o vencido</h2>
        <p style={{ color: "var(--text-neutral)", fontSize: 15 }}>
          Pedile a tu administrador que te genere un nuevo link de invitación.
        </p>
      </div>
    );
  }

  if (status === "done") {
    return (
      <div>
        <h2 style={{ fontSize: 26, fontWeight: 600, margin: "0 0 8px" }}>¡Listo!</h2>
        <p style={{ color: "var(--text-neutral)", fontSize: 15 }}>Tu contraseña quedó configurada. Ingresando...</p>
      </div>
    );
  }

  return (
    <div>
      <h2 style={{ fontSize: 26, fontWeight: 600, margin: "0 0 8px" }}>Creá tu contraseña</h2>
      <p style={{ color: "var(--text-neutral)", fontSize: 15, margin: "0 0 28px" }}>
        Cuenta: <strong>{email}</strong>
      </p>
      <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 14, fontWeight: 600 }}>
          Nueva contraseña
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            autoComplete="new-password"
          />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 14, fontWeight: 600 }}>
          Repetir contraseña
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            minLength={6}
            autoComplete="new-password"
          />
        </label>
        {error && (
          <p role="alert" style={{ color: "#c0392b", fontSize: 14, margin: 0 }}>
            {error}
          </p>
        )}
        <button type="submit" disabled={status === "saving"} style={{ marginTop: 8 }}>
          {status === "saving" ? "Guardando..." : "Guardar y entrar"}
        </button>
      </form>
    </div>
  );
}
