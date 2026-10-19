import { renderMarkdown } from "../../markdown.js";

// Rendered on every request, so the log line below shows in the terminal on every reload.
export const dynamic = "force-dynamic";

export default function ServerPage() {
  console.log("[server] /server page rendered on the server");
  const html = renderMarkdown();
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}
