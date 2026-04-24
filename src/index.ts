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
import { loadPlugins } from "./plugins.js";
import {
	memoryRitualContent,
	memoryRitualPrompt,
} from "./prompts/memory-ritual.js";
import {
	buildToolRegistry,
	dispatchToolCall,
	getToolSchemas,
	handleToolCall,
	registerTools,
} from "./server.js";
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
  npx hontoni-mcp-memory              Start MCP server (stdio)
  npx hontoni-mcp-memory init         Create AGENTS.md template
  npx hontoni-mcp-memory init -a      Append memory section to existing AGENTS.md
  npx hontoni-mcp-memory init -f      Overwrite existing AGENTS.md
  npx hontoni-mcp-memory help         Show this help message

Flags:
  -a, --append    Add memory section to existing AGENTS.md
  -f, --force     Overwrite entire file

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

	// Build mutable tool registry (built-ins + plugins)
	const registry = buildToolRegistry(db, config);

	// Load plugins and add their tools to the registry
	const plugins = await loadPlugins(config.pluginsDir, db);
	for (const plugin of plugins) {
		for (const tool of plugin.tools) {
			registry.set(tool.name, {
				schema: {
					name: tool.name,
					description: tool.description,
					inputSchema: tool.inputSchema,
				},
				handler: (args) => {
					try {
						const result = tool.handler(args, db);
						return {
							content: [
								{
									type: "text" as const,
									text: JSON.stringify(result, null, 2),
								},
							],
						};
					} catch (error) {
						return {
							content: [
								{
									type: "text" as const,
									text: JSON.stringify({
										error:
											error instanceof Error ? error.message : String(error),
									}),
								},
							],
						};
					}
				},
			});
		}
	}

	const server = new Server(
		{
			name: "hontoni-memory",
			version: "0.2.4",
		},
		{
			capabilities: {
				tools: {},
				prompts: {},
			},
		},
	);

	// Register tool listing handler — uses the live registry
	server.setRequestHandler(ListToolsRequestSchema, async () => {
		return {
			tools: getToolSchemas(registry),
		};
	});

	// Register tool call handler — dispatches through registry
	server.setRequestHandler(CallToolRequestSchema, async (request) => {
		return dispatchToolCall(
			registry,
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
