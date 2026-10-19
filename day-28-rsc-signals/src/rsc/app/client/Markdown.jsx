"use client";
import { renderMarkdown } from "../../markdown.js";

export default function Markdown() {
  console.log("[client or server?] Markdown component function ran");
  const html = renderMarkdown();
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}
