"use client";
import { useActionState, useState, useSyncExternalStore } from "react";
import { updateTimeZoneAction } from "@/lib/actions/profile";
import { timeZoneOptions, utcOffset } from "@/lib/learning-stats";
import { Field, FormMessage, Select } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";

const noopSubscribe = () => () => {};
const deviceTimeZone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
};

export function TimeZoneForm({ current }: { current: string }) {
  const [state, action] = useActionState(updateTimeZoneAction, null);
  const detected = useSyncExternalStore(noopSubscribe, deviceTimeZone, () => null);
  const [value, setValue] = useState(current);
  const options = timeZoneOptions(current, detected);
  const detectedLabel = options.find((o) => o.value === detected)?.label;
  return (
    <form action={action} className="max-w-md space-y-4">
      <Field label="Zona horaria" htmlFor="time-zone" hint="Define cuándo empieza y termina cada día de tu racha y cada semana de tu meta.">
        <Select id="time-zone" name="timeZone" value={value} onChange={(e) => setValue(e.target.value)}>
          {options.map((o) => (
            <option key={o.value} value={o.value}>{o.label} ({utcOffset(o.value)})</option>
          ))}
        </Select>
      </Field>
      {detected && detected !== value && (
        <p className="text-sm text-mist-300" data-testid="detected-time-zone">
          Tu dispositivo usa <span className="text-white">{detectedLabel ?? detected}</span>.{" "}
          <button type="button" className="text-electric-300 underline underline-offset-2 hover:text-electric-200" onClick={() => setValue(detected)}>Usar esta</button>
        </p>
      )}
      <FormMessage state={state} />
      <SubmitButton variant="secondary" pendingLabel="Guardando…">Guardar zona horaria</SubmitButton>
    </form>
  );
}
