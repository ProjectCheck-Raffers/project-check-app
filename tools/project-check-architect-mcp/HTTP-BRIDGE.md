# Project Check MCP HTTP bridge

This is the remote transport for the existing Project Check architect MCP. The existing root `.mcp.json` and `index.js` remain the local stdio integration used by Claude Code.

## Start in Codespaces

From this directory:

```bash
npm run start:http
```

The endpoint is:

```
http://0.0.0.0:8787/mcp
```

Set `MCP_PORT` to change the port. Set `MCP_AUTH_TOKEN` to require a bearer token. Keep `OPENAI_API_KEY` in the Codespace secret store; never commit it.

For ChatGPT, expose the Codespace port through an HTTPS endpoint or the OpenAI Secure MCP Tunnel, then register the resulting public URL ending in `/mcp` as a custom MCP server. The bridge exposes only read-only status/ping tools and the existing architect query; it does not expose arbitrary shell commands or repository writes.

Before connecting a public endpoint, require authentication at the tunnel or with `MCP_AUTH_TOKEN`, and verify the endpoint with the MCP inspector.
