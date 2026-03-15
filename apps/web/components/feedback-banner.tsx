"use client";

type FeedbackTone = "success" | "error" | "info";

export function FeedbackBanner({
  tone,
  message,
}: {
  tone: FeedbackTone;
  message: string;
}) {
  if (!message) {
    return null;
  }

  return <p className={`feedback-banner ${tone}`}>{message}</p>;
}
