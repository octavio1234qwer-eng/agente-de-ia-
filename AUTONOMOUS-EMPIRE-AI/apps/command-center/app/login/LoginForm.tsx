"use client";
import { useActionState } from "react";
import { loginAction } from "./actions";

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, undefined);
  return (
    <form action={action} className="card" style={{ maxWidth: 400, margin: "12vh auto" }}>
      <div className="brand" style={{ margin: "0 0 1rem" }}><span className="dot" /> AUTONOMOUS EMPIRE AI</div>
      <h1>Command Center</h1>
      <div className="field"><label htmlFor="email">Correo</label><input id="email" name="email" type="email" required autoComplete="username" defaultValue={state?.email} key={state?.email ?? "e"} /></div>
      <div className="field"><label htmlFor="password">Contraseña</label><input id="password" name="password" type="password" required autoComplete="current-password" /></div>
      {state?.error && <p className="notice">{state.error}</p>}
      <button className="btn" disabled={pending}>{pending ? "Verificando…" : "Entrar"}</button>
    </form>
  );
}
