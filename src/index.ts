#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
	CallToolRequestSchema,
	GetPromptRequestSchema,
	ListPromptsRequestSchema,
	ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { runInit } from "./cli/init.js";
import { initDatabase } from "./db/schema.js";
import {
	memoryRitualContent,
	memoryRitualPrompt,
} from "./prompts/memory-ritual.js";
import { handleToolCall, registerTools } from "./server.js";
import { ensureDataDir, getConfig } from "./utils/config.js";

// Handle CLI commands
const command = process.argv[2];

if (command === "init") {
	runInit();
	process.exit(0);
}

if (command === "help" || command === "--help" || command === "-h") {
	console.log(`
hontoni-mcp-memory - Persistent AI memory via MCP

Usage:
  npx hontoni-mcp-memory           Start MCP server (stdio)
  npx hontoni-mcp-memory init      Create AGENTS.md template in current directory
  npx hontoni-mcp-memory init -f   Overwrite existing AGENTS.md
  npx hontoni-mcp-memory help      Show this help message

Storage:
  Memory is stored locally at ~/.hontoni-memory/memory.db
  Set HONTONI_MEMORY_DIR to customize location.

Documentation:
  https://github.com/khaismile1997/hontoni-mcp-memory
`);
	process.exit(0);
}

// If unknown command provided, show error
if (command && !command.startsWith("-")) {
	console.error(`Unknown command: ${command}`);
	console.error("Run 'npx hontoni-mcp-memory help' for usage.");
	process.exit(1);
}

// Default: Start MCP server
async function main() {
	const config = getConfig();
	ensureDataDir(config);

	const db = initDatabase(config);

	const server = new Server(
		{
			name: "hontoni-memory",
			version: "0.2.3",
		},
		{
			capabilities: {
				tools: {},
				prompts: {},
			},
		},
	);

	// Register tool listing handler
	server.setRequestHandler(ListToolsRequestSchema, async () => {
		return {
			tools: registerTools(),
		};
	});

	// Register tool call handler
	server.setRequestHandler(CallToolRequestSchema, async (request) => {
		return handleToolCall(
			db,
			config,
			request.params.name,
			request.params.arguments ?? {},
		);
	});

	// Register prompt listing handler
	server.setRequestHandler(ListPromptsRequestSchema, async () => {
		return {
			prompts: [memoryRitualPrompt],
		};
	});

	// Register prompt get handler
	server.setRequestHandler(GetPromptRequestSchema, async (request) => {
		if (request.params.name === "memory_ritual") {
			return memoryRitualContent;
		}
		throw new Error(`Unknown prompt: ${request.params.name}`);
	});

	// Start server
	const transport = new StdioServerTransport();
	await server.connect(transport);

	// Handle graceful shutdown
	process.on("SIGINT", () => {
		db.close();
		process.exit(0);
	});

	process.on("SIGTERM", () => {
		db.close();
		process.exit(0);
	});
}

main().catch((error) => {
	console.error("Fatal error:", error);
	process.exit(1);
});
