/** The connector's address and the Claude Code commands, the same in both languages. */

/** The MCP endpoint of the admin console (mail's docs/mcp.md). */
export const connectorUrl = "https://console.abnormalhq.com/api/mcp";
/** Adds the connector to Claude Code under the name mailhq, over Streamable HTTP. */
export const claudeCodeAdd = `claude mcp add --transport http mailhq ${connectorUrl}`;
export const claudeCodeRemove = "claude mcp remove mailhq";
