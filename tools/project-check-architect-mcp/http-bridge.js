import { createServer } from "node:http";
import { McpServer, createMcpHandler } from "@modelcontextprotocol/server";
import OpenAI from "openai";
import { z } from "zod/v4";

const PORT = Number(process.env.MCP_PORT ?? 8787);
const HOST = process.env.MCP_HOST ?? "0.0.0.0";
const AUTH_TOKEN = process.env.MCP_AUTH_TOKEN ?? "";

function buildServer() {
  const server = new McpServer(
    { name: "project-check-architect-http", version: "0.1.0" },
    { capabilities: { tools: {} } }
  );

  server.registerTool(
    "bridge_status",
    {
      description: "Read-only health check for the Project Check MCP bridge.",
      inputSchema: z.object({})
    },
    async () => ({
      content: [{
        type: "text",
        text: JSON.stringify({
          connected: true,
          transport: "streamable-http",
          endpoint: "/mcp",
          repository: "ProjectCheck-Raffers/project-check-app"
        })
      }]
    })
  );

  server.registerTool(
    "architect_ping",
    {
      description: "Read-only connectivity check for the Project Check architect service.",
      inputSchema: z.object({})
    },
    async () => ({
      content: [{ type: "text", text: "Project Check Architect MCP is connected." }]
    })
  );

  server.registerTool(
    "ask_project_check_architect",
    {
      description: "Ask the Project Check chief architect for implementation guidance.",
      inputSchema: z.object({
        prompt: z.string().min(1),
        context: z.string().optional()
      })
    },
    async ({ prompt, context }) => {
      if (!process.env.OPENAI_API_KEY) {
        return {
          isError: true,
          content: [{ type: "text", text: "OPENAI_API_KEY is not configured in the Codespace environment." }]
        };
      }

      const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const response = await client.responses.create({
        model: process.env.ARCHITECT_MODEL ?? "gpt-5.4-mini",
        instructions: [
          "You are the Project Check chief architect.",
          "Give concise, implementation-ready guidance.",
          "Separate verified facts, documented requirements, and proposals.",
          "Protect production, secrets, authentication, billing, and RLS.",
          "Recommend the smallest reversible change and the checks needed to verify it.",
          "Claude Code is the implementation developer; human approval is required before merge or deploy."
        ].join("\n"),
        input: context ? `Context:\n${context}\n\nRequest:\n${prompt}` : prompt,
        max_output_tokens: 800
      });

      return { content: [{ type: "text", text: response.output_text || "No architect response was returned." }] };
    }
  );

  return server;
}

function authorized(req) {
  if (!AUTH_TOKEN) return true;
  const value = req.headers.authorization ?? "";
  return value === `Bearer ${AUTH_TOKEN}`;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", chunk => {
      size += chunk.length;
      if (size > 2 * 1024 * 1024) {
        reject(new Error("Request body too large."));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

async function handle(req, res) {
  if (!authorized(req)) {
    res.writeHead(401, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "Unauthorized" }));
    return;
  }

  const body = req.method === "GET" || req.method === "HEAD" ? undefined : await readBody(req);
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (Array.isArray(value)) headers.set(key, value.join(", "));
    else if (value !== undefined) headers.set(key, value);
  }

  const request = new Request(`http://${req.headers.host ?? "localhost"}${req.url ?? "/"}`, {
    method: req.method,
    headers,
    body: body?.length ? body : undefined,
    ...(body?.length ? { duplex: "half" } : {})
  });
  const response = await handler.fetch(request);

  const responseHeaders = {};
  response.headers.forEach((value, key) => { responseHeaders[key] = value; });
  res.writeHead(response.status, responseHeaders);
  if (!response.body) {
    res.end();
    return;
  }

  const reader = response.body.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }
  res.end();
}

const handler = createMcpHandler(() => buildServer(), { maxRequestBodySize: 2 * 1024 * 1024 });
const httpServer = createServer((req, res) => {
  handle(req, res).catch(error => {
    console.error(error);
    if (!res.headersSent) res.writeHead(500, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "MCP bridge request failed." }));
  });
});

httpServer.listen(PORT, HOST, () => {
  console.error(`Project Check MCP HTTP bridge listening on http://${HOST}:${PORT}/mcp`);
});

process.on("SIGINT", async () => {
  await handler.close();
  httpServer.close(() => process.exit(0));
});
