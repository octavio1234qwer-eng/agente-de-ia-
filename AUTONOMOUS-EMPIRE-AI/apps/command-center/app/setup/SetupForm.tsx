"use client";
import { useActionState } from "react";
import { setupOwner } from "./actions";
export function SetupForm() {
  const [state, action, pending] = useActionState(setupOwner, undefined);
  return (
    <form action={action} className="card" style={{ maxWidth: 440, margin: "8vh auto" }}>
      <h1>Configuración inicial</h1>
      <p className="muted">Crea la cuenta del propietario. Esta página se desactiva en cuanto exista un usuario.</p>
      <div className="field"><label htmlFor="token">Código de configuración</label><input id="token" name="token" required autoComplete="off" /></div>
      <div className="field"><label htmlFor="name">Nombre</label><input id="name" name="name" required /></div>
      <div className="field"><label htmlFor="email">Correo</label><input id="email" name="email" type="email" required autoComplete="username" /></div>
      <div className="field"><label htmlFor="password">Contraseña (mín. 12)</label><input id="password" name="password" type="password" minLength={12} required autoComplete="new-password" /></div>
      <div className="field"><label htmlFor="password2">Repite la contraseña</label><input id="password2" name="password2" type="password" minLength={12} required autoComplete="new-password" /></div>
      {state?.error && <p className="notice">{state.error}</p>}
      <button className="btn" disabled={pending}>{pending ? "Creando…" : "Crear propietario"}</button>
    </form>
  );
}
