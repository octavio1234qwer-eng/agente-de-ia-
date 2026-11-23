"use client";
import { useActionState, useRef, useState, useTransition } from "react";
import { Camera, LoaderCircle } from "lucide-react";
import { setAvatarAction, updateProfileAction } from "@/lib/actions/profile";
import { createClient } from "@/lib/supabase/client";
import { Field, FormMessage, Input, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { Avatar } from "@/components/ui/avatar";

type Props = { userId: string; fullName: string; headline: string | null; bio: string | null; avatarUrl: string | null };

export function ProfileForm({ userId, fullName, headline, bio, avatarUrl }: Props) {
  const [state, action] = useActionState(updateProfileAction, null);
  const [avatar, setAvatar] = useState(avatarUrl);
  const [avatarMsg, setAvatarMsg] = useState<{ error?: string; success?: string } | null>(null);
  const [uploading, startUpload] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarMsg(null);
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) return setAvatarMsg({ error: "Usa una imagen PNG, JPG o WebP." });
    if (file.size > 2 * 1024 * 1024) return setAvatarMsg({ error: "La imagen debe pesar menos de 2 MB." });
    startUpload(async () => {
      const ext = file.type.split("/")[1].replace("jpeg", "jpg");
      const path = `${userId}/avatar-${Date.now()}.${ext}`;
      const supabase = createClient();
      const { error } = await supabase.storage.from("avatars").upload(path, file, { contentType: file.type, upsert: false });
      if (error) return setAvatarMsg({ error: "No se pudo subir la imagen." });
      const res = await setAvatarAction(path);
      if (res?.error) return setAvatarMsg({ error: res.error });
      setAvatar(supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl);
      setAvatarMsg({ success: "Foto actualizada." });
    });
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-5">
        <Avatar name={fullName} url={avatar} size={80} />
        <div>
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={onFile} />
          <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/10 px-4 text-sm text-mist-100 hover:bg-white/[0.06] disabled:opacity-60">
            {uploading ? <LoaderCircle className="size-4 animate-spin" /> : <Camera className="size-4" />} Cambiar foto
          </button>
          <p className="mt-2 text-xs text-mist-400">PNG, JPG o WebP · máximo 2 MB</p>
          {avatarMsg && <p className={avatarMsg.error ? "mt-1 text-sm text-red-300" : "mt-1 text-sm text-emerald-300"} role="status">{avatarMsg.error ?? avatarMsg.success}</p>}
        </div>
      </div>
      <form action={action} className="space-y-5">
        <Field label="Nombre completo" htmlFor="fullName" hint="Así aparecerá en tus certificados.">
          <Input id="fullName" name="fullName" defaultValue={fullName} required maxLength={120} autoComplete="name" />
        </Field>
        <Field label="Titular" htmlFor="headline" hint="Por ejemplo: Desarrolladora frontend en formación">
          <Input id="headline" name="headline" defaultValue={headline ?? ""} maxLength={160} />
        </Field>
        <Field label="Sobre mí" htmlFor="bio">
          <Textarea id="bio" name="bio" defaultValue={bio ?? ""} maxLength={2000} />
        </Field>
        <FormMessage state={state} />
        <SubmitButton pendingLabel="Guardando…">Guardar cambios</SubmitButton>
      </form>
    </div>
  );
}
