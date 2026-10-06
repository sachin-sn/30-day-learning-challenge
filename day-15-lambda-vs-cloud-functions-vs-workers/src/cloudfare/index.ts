import { handle } from "../core";

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const out = await handle({
      method: request.method,
      path: url.pathname,
      query: Object.fromEntries(url.searchParams),
      body: request.method === "GET" || request.method === "HEAD" ? "" : await request.text(),
    });
    return new Response(out.body, { status: out.status, headers: out.headers });
  },
};
