"use client";
import { useEffect, useRef } from "react";
import { saveVideoPositionAction, setLessonCompleteAction } from "@/lib/actions/learning";

/** Reproductor HTML5: reanuda donde te quedaste, guarda la posición y completa al 90 %. */
export function VideoPlayer({ lessonId, src, startAt, completed, canTrack }: { lessonId: string; src: string; startAt: number; completed: boolean; canTrack: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  const lastSaved = useRef(0);
  const markedDone = useRef(completed);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    const onLoaded = () => {
      if (startAt > 5 && startAt < v.duration - 5) v.currentTime = startAt;
    };
    const save = () => {
      if (!canTrack) return;
      const t = Math.floor(v.currentTime);
      if (Math.abs(t - lastSaved.current) >= 10) {
        lastSaved.current = t;
        void saveVideoPositionAction(lessonId, t);
      }
      if (!markedDone.current && v.duration && v.currentTime / v.duration >= 0.9) {
        markedDone.current = true;
        void setLessonCompleteAction(lessonId, true);
      }
    };
    const onPause = () => {
      if (canTrack) void saveVideoPositionAction(lessonId, Math.floor(v.currentTime));
    };
    v.addEventListener("loadedmetadata", onLoaded);
    v.addEventListener("timeupdate", save);
    v.addEventListener("pause", onPause);
    return () => {
      v.removeEventListener("loadedmetadata", onLoaded);
      v.removeEventListener("timeupdate", save);
      v.removeEventListener("pause", onPause);
    };
  }, [lessonId, startAt, canTrack]);

  return (
    <video ref={ref} src={src} controls playsInline preload="metadata" controlsList="nodownload" className="aspect-video w-full rounded-2xl bg-black" onContextMenu={(e) => e.preventDefault()}>
      Tu navegador no puede reproducir este video.
    </video>
  );
}
