import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";

/**
 * Normalize file path for storage (relative to cwd if possible)
 */
export function normalizePath(filePath: string): string {
	const cwd = process.cwd();
	const resolved = resolve(filePath);

	if (resolved.startsWith(cwd)) {
		return resolved.slice(cwd.length + 1);
	}
	return resolved;
}

/**
 * Parse comma-separated file paths
 */
export function parseFilePaths(input: string | undefined): string[] {
	if (!input) return [];
	return input
		.split(",")
		.map((p) => p.trim())
		.filter((p) => p.length > 0)
		.map(normalizePath);
}

/**
 * Check if a file exists
 */
export function fileExists(filePath: string): boolean {
	return existsSync(filePath);
}

/**
 * Get directory from path
 */
export function getDir(filePath: string): string {
	return dirname(filePath);
}
