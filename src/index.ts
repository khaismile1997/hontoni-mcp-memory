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
  Memory is stored locally at ~/.hontoni-mcp/memory.db
  Set HONTONI_DATA_DIR to customize location.

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
			// Guard: refuse to overwrite built-in tools or already-registered plugin tools
			if (registry.has(tool.name)) {
				console.error(
					`[hontoni-memory] Warning: Plugin "${plugin.name}" tried to register tool "${tool.name}" which is already registered. Skipping.`,
				);
				continue;
			}

			// Guard: inputSchema must be a valid MCP object schema
			if (
				!tool.inputSchema ||
				typeof tool.inputSchema !== "object" ||
				(tool.inputSchema as Record<string, unknown>)["type"] !== "object"
			) {
				console.error(
					`[hontoni-memory] Warning: Plugin "${plugin.name}" tool "${tool.name}" has an invalid inputSchema (must be type:"object"). Skipping.`,
				);
				continue;
			}

			registry.set(tool.name, {
				schema: {
					name: tool.name,
					description: tool.description,
					inputSchema: tool.inputSchema,
				},
				handler: (args) => {
					try {
						const resultOrPromise = tool.handler(args, db);
						// Support both sync and async handlers
						if (
							resultOrPromise !== null &&
							typeof resultOrPromise === "object" &&
							"then" in resultOrPromise &&
							typeof (resultOrPromise as Promise<unknown>).then === "function"
						) {
							// Async handler: we cannot await inside a sync ToolHandler,
							// so we return a settled Promise result. The MCP SDK handles
							// async request handlers at the call-site level; plugin handlers
							// should prefer sync where possible.
							return (resultOrPromise as Promise<unknown>).then(
								(result) => ({
									content: [
										{
											type: "text" as const,
											text: JSON.stringify(result, null, 2),
										},
									],
								}),
								(error: unknown) => ({
									content: [
										{
											type: "text" as const,
											text: JSON.stringify({
												error:
													error instanceof Error
														? error.message
														: String(error),
											}),
										},
									],
								}),
							) as unknown as {
								content: Array<{ type: "text"; text: string }>;
							};
						}
						return {
							content: [
								{
									type: "text" as const,
									text: JSON.stringify(resultOrPromise, null, 2),
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
