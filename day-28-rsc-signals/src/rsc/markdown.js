// Shared by both pages: a longer markdown text, so the work of turning it into HTML is real.
import { marked } from "marked";

const TEXT = `# Day 28

Two pages render **the same markdown**. One does it in a *Server Component*,
the other in a *Client Component*.

- item one
- item two
- item three

> The only difference between the pages is where this function runs.
`;

export function renderMarkdown() {
  return marked.parse(TEXT);
}
