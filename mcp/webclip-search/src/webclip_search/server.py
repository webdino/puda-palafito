"""WebClip Search MCP Server.

Search Obsidian WebClip files by date or source URL.
"""

from __future__ import annotations

import asyncio
import os
from datetime import date, datetime
from pathlib import Path
from typing import Any

import yaml
from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import TextContent, Tool

app = Server("webclip-search")


def get_webclip_dir() -> Path:
    """Get the WebClip directory from environment variable."""
    webclip_dir = os.environ.get("WEBCLIP_DIR")
    if not webclip_dir:
        raise ValueError("WEBCLIP_DIR environment variable is not set")
    path = Path(webclip_dir)
    if not path.exists():
        raise ValueError(f"WEBCLIP_DIR does not exist: {webclip_dir}")
    return path


def parse_frontmatter(file_path: Path) -> dict[str, Any]:
    """Parse YAML frontmatter from a markdown file.

    Args:
        file_path: Path to the markdown file.

    Returns:
        Dictionary containing the frontmatter data, or empty dict if not found.
    """
    try:
        content = file_path.read_text(encoding="utf-8")
        if content.startswith("---"):
            parts = content.split("---", 2)
            if len(parts) >= 3:
                return yaml.safe_load(parts[1]) or {}
    except Exception:
        pass
    return {}


def parse_file_content(file_path: Path) -> tuple[dict[str, Any], str]:
    """Parse frontmatter and body from a markdown file.

    Args:
        file_path: Path to the markdown file.

    Returns:
        Tuple of (frontmatter dict, body text).
    """
    try:
        content = file_path.read_text(encoding="utf-8")
        if content.startswith("---"):
            parts = content.split("---", 2)
            if len(parts) >= 3:
                frontmatter = yaml.safe_load(parts[1]) or {}
                body = parts[2].strip()
                return frontmatter, body
        return {}, content
    except Exception:
        return {}, ""


def find_file_by_name(directory: Path, filename: str) -> Path | None:
    """Find a file by name in the directory.

    Args:
        directory: Directory to search in.
        filename: Filename to search for.

    Returns:
        Path to the file if found, None otherwise.
    """
    files = list(directory.glob(f"**/{filename}"))
    if files:
        return files[0]
    return None


def get_all_markdown_files(directory: Path) -> list[Path]:
    """Get all markdown files in the directory."""
    return list(directory.glob("**/*.md"))


def format_file_info(file_path: Path, frontmatter: dict[str, Any]) -> str:
    """Format file information for output."""
    title = frontmatter.get("title", "No title")
    source = frontmatter.get("source", "No source")
    created = frontmatter.get("created", "Unknown")
    return f"- {file_path.name}\n  Title: {title}\n  Source: {source}\n  Created: {created}"


def parse_date(date_str: str) -> date | None:
    """Parse a date string in YYYY-MM-DD or YYYY-MM-DD HH:mm:ss format."""
    try:
        # Try YYYY-MM-DD format first
        return date.fromisoformat(date_str)
    except (ValueError, TypeError):
        pass
    
    try:
        # Try YYYY-MM-DD HH:mm:ss format
        dt = datetime.strptime(date_str, "%Y-%m-%d %H:%M:%S")
        return dt.date()
    except (ValueError, TypeError):
        return None


@app.list_tools()
async def list_tools() -> list[Tool]:
    """List available tools."""
    return [
        Tool(
            name="list_files",
            description="List all WebClip files with their metadata",
            inputSchema={
                "type": "object",
                "properties": {},
            },
        ),
        Tool(
            name="search_by_date",
            description="Search WebClip files by creation date range",
            inputSchema={
                "type": "object",
                "properties": {
                    "start_date": {
                        "type": "string",
                        "description": "Start date in YYYY-MM-DD format (inclusive)",
                    },
                    "end_date": {
                        "type": "string",
                        "description": "End date in YYYY-MM-DD format (inclusive)",
                    },
                },
                "required": ["start_date", "end_date"],
            },
        ),
        Tool(
            name="search_by_source",
            description="Search WebClip files by source URL (partial match)",
            inputSchema={
                "type": "object",
                "properties": {
                    "url": {
                        "type": "string",
                        "description": "URL pattern to search for (partial match)",
                    },
                },
                "required": ["url"],
            },
        ),
        Tool(
            name="get_contents",
            description="Get the content of a WebClip file (frontmatter + truncated body)",
            inputSchema={
                "type": "object",
                "properties": {
                    "filename": {
                        "type": "string",
                        "description": "Filename to retrieve (e.g., 'example.md')",
                    },
                    "max_chars": {
                        "type": "integer",
                        "description": "Maximum characters of body to return (default: 2000)",
                    },
                },
                "required": ["filename"],
            },
        ),
        Tool(
            name="search_fulltext",
            description="Search WebClip files by text in the body content (partial match, case-insensitive)",
            inputSchema={
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Text to search for in the body content",
                    },
                },
                "required": ["query"],
            },
        ),
    ]


@app.call_tool()
async def call_tool(name: str, arguments: dict[str, Any]) -> list[TextContent]:
    """Handle tool calls."""
    try:
        webclip_dir = get_webclip_dir()
    except ValueError as e:
        return [TextContent(type="text", text=f"Error: {e}")]

    if name == "list_files":
        return await handle_list_files(webclip_dir)
    elif name == "search_by_date":
        return await handle_search_by_date(
            webclip_dir,
            arguments.get("start_date", ""),
            arguments.get("end_date", ""),
        )
    elif name == "search_by_source":
        return await handle_search_by_source(webclip_dir, arguments.get("url", ""))
    elif name == "get_contents":
        return await handle_get_file(
            webclip_dir,
            arguments.get("filename", ""),
            arguments.get("max_chars", 2000),
        )
    elif name == "search_fulltext":
        return await handle_search_fulltext(webclip_dir, arguments.get("query", ""))
    else:
        return [TextContent(type="text", text=f"Unknown tool: {name}")]


async def handle_list_files(webclip_dir: Path) -> list[TextContent]:
    """Handle list_files tool call."""
    files = get_all_markdown_files(webclip_dir)
    if not files:
        return [TextContent(type="text", text="No WebClip files found.")]

    results = []
    for file_path in sorted(files):
        frontmatter = parse_frontmatter(file_path)
        results.append(format_file_info(file_path, frontmatter))

    output = f"Found {len(files)} WebClip file(s):\n\n" + "\n\n".join(results)
    return [TextContent(type="text", text=output)]


async def handle_search_by_date(
    webclip_dir: Path, start_date_str: str, end_date_str: str
) -> list[TextContent]:
    """Handle search_by_date tool call."""
    start_date = parse_date(start_date_str)
    end_date = parse_date(end_date_str)

    if not start_date:
        return [
            TextContent(
                type="text",
                text=f"Invalid start_date format: {start_date_str}. Use YYYY-MM-DD.",
            )
        ]
    if not end_date:
        return [
            TextContent(
                type="text",
                text=f"Invalid end_date format: {end_date_str}. Use YYYY-MM-DD.",
            )
        ]
    if start_date > end_date:
        return [
            TextContent(
                type="text", text="start_date must be before or equal to end_date."
            )
        ]

    files = get_all_markdown_files(webclip_dir)
    matches = []

    for file_path in files:
        frontmatter = parse_frontmatter(file_path)
        created = frontmatter.get("created")
        if created:
            file_date = parse_date(str(created))
            if file_date and start_date <= file_date <= end_date:
                matches.append((file_path, frontmatter))

    if not matches:
        return [
            TextContent(
                type="text",
                text=f"No files found between {start_date_str} and {end_date_str}.",
            )
        ]

    results = [format_file_info(fp, fm) for fp, fm in sorted(matches)]
    output = f"Found {len(matches)} file(s) between {start_date_str} and {end_date_str}:\n\n"
    output += "\n\n".join(results)
    return [TextContent(type="text", text=output)]


async def handle_search_by_source(
    webclip_dir: Path, url_pattern: str
) -> list[TextContent]:
    """Handle search_by_source tool call."""
    if not url_pattern:
        return [TextContent(type="text", text="URL pattern cannot be empty.")]

    files = get_all_markdown_files(webclip_dir)
    matches = []
    url_pattern_lower = url_pattern.lower()

    for file_path in files:
        frontmatter = parse_frontmatter(file_path)
        source = frontmatter.get("source", "")
        if source and url_pattern_lower in source.lower():
            matches.append((file_path, frontmatter))

    if not matches:
        return [
            TextContent(
                type="text", text=f"No files found with source matching: {url_pattern}"
            )
        ]

    results = [format_file_info(fp, fm) for fp, fm in sorted(matches)]
    output = f"Found {len(matches)} file(s) matching '{url_pattern}':\n\n"
    output += "\n\n".join(results)
    return [TextContent(type="text", text=output)]


async def handle_search_fulltext(
    webclip_dir: Path, query: str
) -> list[TextContent]:
    """Handle search_fulltext tool call."""
    if not query:
        return [TextContent(type="text", text="Query cannot be empty.")]

    files = get_all_markdown_files(webclip_dir)
    matches = []
    query_lower = query.lower()

    for file_path in files:
        frontmatter, body = parse_file_content(file_path)
        if body and query_lower in body.lower():
            matches.append((file_path, frontmatter))

    if not matches:
        return [
            TextContent(
                type="text", text=f"No files found with body containing: {query}"
            )
        ]

    results = [format_file_info(fp, fm) for fp, fm in sorted(matches)]
    output = f"Found {len(matches)} file(s) containing '{query}':\n\n"
    output += "\n\n".join(results)
    return [TextContent(type="text", text=output)]


async def handle_get_file(
    webclip_dir: Path, filename: str, max_chars: int
) -> list[TextContent]:
    """Handle get_file tool call."""
    if not filename:
        return [TextContent(type="text", text="Filename cannot be empty.")]

    file_path = find_file_by_name(webclip_dir, filename)
    if not file_path:
        return [
            TextContent(type="text", text=f"File not found: {filename}")
        ]

    frontmatter, body = parse_file_content(file_path)

    output_parts = [f"# {filename}\n"]

    if frontmatter:
        output_parts.append("## Frontmatter\n")
        for key, value in frontmatter.items():
            output_parts.append(f"- **{key}**: {value}")
        output_parts.append("")

    output_parts.append("## Content\n")
    if len(body) > max_chars:
        output_parts.append(body[:max_chars])
        output_parts.append(f"\n\n... (truncated, {len(body) - max_chars} more characters)")
    else:
        output_parts.append(body)

    return [TextContent(type="text", text="\n".join(output_parts))]


def main() -> None:
    """Run the MCP server."""
    asyncio.run(run_server())


async def run_server() -> None:
    """Run the MCP server with stdio transport."""
    async with stdio_server() as (read_stream, write_stream):
        await app.run(read_stream, write_stream, app.create_initialization_options())


if __name__ == "__main__":
    main()
