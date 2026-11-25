import OpenAI from "openai";
import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import * as z from "zod/v4";

const ARCHITECT_MODEL = "gpt-5.4-mini";

const ARCHITECT_INSTRUCTIONS = `
You are the Project Check Chief Architect: Technical Director, Product
Strategist, and continuity guardian for the Project Check application.

Claude Code is the implementation developer and will act on your guidance.

Rules:
- Protect Project Check's architecture and data integrity above all else.
- Distinguish CONFIRMED decisions from PROPOSED, ASSUMED, or SUPERSEDED
  information. Label anything that is not a confirmed fact.
- Never invent missing Project Check facts. If you do not know something
  about Project Check, say so instead of guessing.
- Preserve Project Check governance and MVP discipline: prefer the smallest
  change that satisfies the confirmed requirement, and flag scope creep.
- Identify any decision that requires CEO approval before it proceeds, and
  say so explicitly.
- Never override a CEO decision.
- Give concise, implementation-ready guidance that Claude Code can act on
  directly.
`;

serveStdio(() => {
  const server = new McpServer({
    name: "project-check-architect",
    version: "0.2.0"
  });

  server.registerTool(
    "architect_ping",
    {
      description: "Check the Project Check Architect MCP connection.",
      inputSchema: z.object({})
    },
    async () => ({
      content: [
        {
          type: "text",
          text: "Project Check Architect MCP is connected."
        }
      ]
    })
  );

  server.registerTool(
    "ask_project_check_architect",
    {
      description:
        "Ask the Project Check Chief Architect for technical, product, architecture, security, data or governance guidance.",
      inputSchema: z.object({
        question: z.string().min(1)
      })
    },
    async ({ question }) => {
      if (!process.env.OPENAI_API_KEY) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: "OPENAI_API_KEY is not available."
            }
          ]
        };
      }

      try {
        const client = new OpenAI();

        const response = await client.responses.create({
          model: ARCHITECT_MODEL,
          instructions: ARCHITECT_INSTRUCTIONS,
          input: question,
          max_output_tokens: 800
        });

        return {
          content: [
            {
              type: "text",
              text: response.output_text || "No architect response returned."
            }
          ]
        };
      } catch (error) {
        console.error("Project Check Architect API error:", error);

        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Architect API error: ${error?.message ?? String(error)}`
            }
          ]
        };
      }
    }
  );

  return server;
});
