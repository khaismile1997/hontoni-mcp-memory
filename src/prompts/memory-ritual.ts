import type { Prompt } from "@modelcontextprotocol/sdk/types.js";

export const memoryRitualPrompt: Prompt = {
	name: "memory_ritual",
	description:
		"Instructions for using hontoni-memory tools effectively. Load this at session start.",
	arguments: [],
};

export const memoryRitualContent = {
	description: "Memory Ritual - How to use hontoni-memory",
	messages: [
		{
			role: "user" as const,
			content: {
				type: "text" as const,
				text: `# Memory Ritual

You have access to hontoni-memory, a persistent memory system. Follow this ritual:

## At Session Start
1. Search for relevant past work: \`memory_search({ query: "<task keywords>" })\`
2. Load previous session if continuing: \`session_load()\`

## During Work - Create Observations For:
- **decision**: Architecture choices, tech stack decisions
- **bugfix**: Bug fixes with root cause explanation  
- **pattern**: Recurring patterns discovered in codebase
- **discovery**: Non-obvious findings about how code works
- **warning**: Gotchas, things to avoid, dangerous patterns
- **learning**: New knowledge gained

Example:
\`\`\`
observation({
  type: "pattern",
  title: "API routes use Zod validation",
  narrative: "All API routes validate input with Zod schemas before processing",
  concepts: "validation, zod, api"
})
\`\`\`

## At Session End
Save session summary: \`session_save({ summary: "What was accomplished" })\`

## Proactive Usage
- Create observations WITHOUT being asked when you discover something important
- Search memory BEFORE starting new work to check for relevant context
- The memory persists across sessions - use it to build knowledge over time`,
			},
		},
	],
};
