"use client";
import { useEffect } from "react";
import { markAnnouncementsSeenAction } from "@/lib/actions/announcements";

/**
 * Marca los avisos como vistos al abrir la página (en el navegador, para que
 * una precarga del enlace no los marque sin que el alumno los vea).
 */
export function MarkAnnouncementsSeen({ courseId }: { courseId: string }) {
  useEffect(() => {
    void markAnnouncementsSeenAction(courseId);
  }, [courseId]);
  return null;
}
