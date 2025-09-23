import { formatTimestamp } from "./formatTimestamp";

export const handleDownloadTranscript = (transcripts) => {
  const transcriptText = transcripts
    .map((t) => `[${formatTimestamp(t.timestamp)}] ${t.speaker}: ${t.text}`)
    .join("\n");
  const blob = new Blob([transcriptText], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "transcript.txt";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};