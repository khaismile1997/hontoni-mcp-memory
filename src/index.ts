#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
	CallToolRequestSchema,
	GetPromptRequestSchema,
	ListPromptsRequestSchema,
	ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { initDatabase } from "./db/schema.js";
import {
	memoryRitualContent,
	memoryRitualPrompt,
} from "./prompts/memory-ritual.js";
import { handleToolCall, registerTools } from "./server.js";
import { ensureDataDir, getConfig } from "./utils/config.js";

async function main() {
	const config = getConfig();
	ensureDataDir(config);

	const db = initDatabase(config);

	const server = new Server(
		{
			name: "hontoni-memory",
			version: "0.2.0",
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
