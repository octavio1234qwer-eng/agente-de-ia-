"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { addResourceAction } from "@/lib/actions/admin";
import { UploadField } from "./upload-field";

export function ResourceUploader({ courseId, lessonId }: { courseId: string; lessonId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  return (
    <div>
      <UploadField
        bucket="course-materials"
        pathPrefix={`${courseId}/${lessonId}`}
        accept=".pdf,.zip,.txt,.md,.csv,.json,.png,.jpg,.jpeg,.docx,.xlsx,.pptx"
        maxMb={100}
        label="Subir recurso (PDF, ZIP, Office…)"
        onUploaded={async ({ path, file }) => {
          const res = await addResourceAction({ lessonId, title: file.name.replace(/\.[^.]+$/, ""), path, mime: file.type || "application/octet-stream", size: file.size });
          if (res?.error) setError(res.error);
          else router.refresh();
        }}
      />
      {error && <p role="alert" className="mt-1 text-xs text-red-300">{error}</p>}
    </div>
  );
}
