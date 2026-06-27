"""WebClip Search MCP Server.

Search WebClip files by date, source URL, fulltext, or semantic similarity.
"""

from __future__ import annotations

import asyncio
import os
from datetime import date
from pathlib import Path
from typing import Any

import yaml
from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import TextContent, Tool

from webclip_search.frontmatter_fields import (
    normalize_to_date,
    get_created,
    get_created_date,
    get_source,
    get_tab_id,
    get_visit_duration,
    get_window_id,
)
from webclip_search.semantic_index import get_index_status, search_semantic, sync_index

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


def _is_frontmatter_close(line: str) -> bool:
    return line.strip() == "---"


def _read_markdown_parts(
    file_path: Path, *, read_body: bool
) -> tuple[dict[str, Any], str]:
    """Read YAML frontmatter from a markdown file.

    When read_body is False, stops after the closing delimiter without reading
    the body (faster for metadata-only lookups).
    """
    try:
        with file_path.open(encoding="utf-8") as f:
            first_line = f.readline()
            if first_line == "":
                return {}, ""

            if not first_line.startswith("---"):
                if read_body:
                    return {}, first_line + f.read()
                return {}, ""

            yaml_lines: list[str] = []
            while True:
                line = f.readline()
                if line == "":
                    if read_body:
                        return {}, first_line + "".join(yaml_lines)
                    return {}, ""

                if _is_frontmatter_close(line):
                    frontmatter = yaml.safe_load("".join(yaml_lines)) or {}
                    if read_body:
                        return frontmatter, f.read().strip()
                    return frontmatter, ""

                yaml_lines.append(line)

    except Exception:
        return {}, ""


def parse_frontmatter(file_path: Path) -> dict[str, Any]:
    """Parse YAML frontmatter from a markdown file.

    Args:
        file_path: Path to the markdown file.

    Returns:
        Dictionary containing the frontmatter data, or empty dict if not found.
    """
    frontmatter, _ = _read_markdown_parts(file_path, read_body=False)
    return frontmatter


def parse_file_content(file_path: Path) -> tuple[dict[str, Any], str]:
    """Parse frontmatter and body from a markdown file.

    Args:
        file_path: Path to the markdown file.

    Returns:
        Tuple of (frontmatter dict, body text).
    """
    return _read_markdown_parts(file_path, read_body=True)


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


def relative_path(webclip_dir: Path, file_path: Path) -> str:
    """Return file path relative to the WebClip directory."""
    return file_path.relative_to(webclip_dir).as_posix()


def format_file_info(file_path: Path, frontmatter: dict[str, Any]) -> str:
    """Format file information for output."""
    title = frontmatter.get("title", "No title")
    source = get_source(frontmatter) or "No source"
    created = get_created(frontmatter) or "Unknown"
    lines = [
        f"- {file_path.name}",
        f"  Title: {title}",
        f"  Source: {source}",
        f"  Created: {created}",
    ]
    visit_duration = get_visit_duration(frontmatter)
    if visit_duration:
        lines.append(f"  Visit duration: {visit_duration}")
    window_id = get_window_id(frontmatter)
    if window_id:
        lines.append(f"  Window ID: {window_id}")
    tab_id = get_tab_id(frontmatter)
    if tab_id:
        lines.append(f"  Tab ID: {tab_id}")
    summary = frontmatter.get("summary")
    if summary:
        lines.append(f"  Summary: {summary}")
    return "\n".join(lines)


def format_file_info_with_path(
    webclip_dir: Path, file_path: Path, frontmatter: dict[str, Any]
) -> str:
    """Format file information including relative path."""
    info = format_file_info(file_path, frontmatter)
    return f"{info}\n  Relative path: {relative_path(webclip_dir, file_path)}"


def match_files_by_date(
    webclip_dir: Path, start_date: date, end_date: date
) -> list[tuple[Path, dict[str, Any]]]:
    """Return files whose created date falls within the inclusive range."""
    matches: list[tuple[Path, dict[str, Any]]] = []
    for file_path in get_all_markdown_files(webclip_dir):
        frontmatter = parse_frontmatter(file_path)
        file_date = get_created_date(frontmatter)
        if file_date and start_date <= file_date <= end_date:
            matches.append((file_path, frontmatter))
    return sorted(matches)


def parse_date_range(
    start_date_str: str, end_date_str: str
) -> tuple[date | None, date | None, str | None]:
    """Parse and validate a date range. Returns (start, end, error_message)."""
    start_date = parse_date(start_date_str)
    if not start_date:
        return None, None, f"Invalid start_date format: {start_date_str}. Use YYYY-MM-DD."

    end_date = parse_date(end_date_str)
    if not end_date:
        return None, None, f"Invalid end_date format: {end_date_str}. Use YYYY-MM-DD."

    if start_date > end_date:
        return None, None, "start_date must be before or equal to end_date."

    return start_date, end_date, None


async def sync_semantic_index(webclip_dir: Path) -> None:
    """Remove orphaned semantic index entries after file deletion."""
    files = get_all_markdown_files(webclip_dir)
    await asyncio.to_thread(sync_index, webclip_dir, files, parse_file_content)


def parse_date(date_str: str) -> date | None:
    """Parse a date string in common WebClip frontmatter formats."""
    return normalize_to_date(date_str)


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
        Tool(
            name="search_semantic",
            description=(
                "Search WebClip files by semantic similarity to the query. "
                "Indexes markdown body chunks (with optional title/description/summary context)."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Natural language search query",
                    },
                    "top_k": {
                        "type": "integer",
                        "description": "Maximum number of files to return (default: 10)",
                    },
                    "rebuild_index": {
                        "type": "boolean",
                        "description": "Rebuild the entire semantic index (default: false)",
                    },
                },
                "required": ["query"],
            },
        ),
        Tool(
            name="index_status",
            description="Show semantic index statistics and frontmatter coverage",
            inputSchema={
                "type": "object",
                "properties": {},
            },
        ),
        Tool(
            name="remove_contents",
            description="Permanently delete a WebClip file by filename",
            inputSchema={
                "type": "object",
                "properties": {
                    "filename": {
                        "type": "string",
                        "description": "Filename to delete (e.g., 'example.md')",
                    },
                    "dry_run": {
                        "type": "boolean",
                        "description": "Preview deletion without modifying files (default: false)",
                    },
                },
                "required": ["filename"],
            },
        ),
        Tool(
            name="remove_contents_by_date",
            description="Permanently delete WebClip files by creation date range",
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
                    "dry_run": {
                        "type": "boolean",
                        "description": "Preview deletion without modifying files (default: false)",
                    },
                },
                "required": ["start_date", "end_date"],
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
    elif name == "search_semantic":
        return await handle_search_semantic(
            webclip_dir,
            arguments.get("query", ""),
            arguments.get("top_k", 10),
            arguments.get("rebuild_index", False),
        )
    elif name == "index_status":
        return await handle_index_status(webclip_dir)
    elif name == "remove_contents":
        return await handle_remove_contents(
            webclip_dir,
            arguments.get("filename", ""),
            arguments.get("dry_run", False),
        )
    elif name == "remove_contents_by_date":
        return await handle_remove_contents_by_date(
            webclip_dir,
            arguments.get("start_date", ""),
            arguments.get("end_date", ""),
            arguments.get("dry_run", False),
        )
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
    start_date, end_date, error = parse_date_range(start_date_str, end_date_str)
    if error:
        return [TextContent(type="text", text=error)]

    matches = match_files_by_date(webclip_dir, start_date, end_date)

    if not matches:
        return [
            TextContent(
                type="text",
                text=f"No files found between {start_date_str} and {end_date_str}.",
            )
        ]

    results = [format_file_info(fp, fm) for fp, fm in matches]
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
        source = get_source(frontmatter)
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


async def handle_search_semantic(
    webclip_dir: Path,
    query: str,
    top_k: int,
    rebuild_index: bool,
) -> list[TextContent]:
    """Handle search_semantic tool call."""
    if not query:
        return [TextContent(type="text", text="Query cannot be empty.")]
    if top_k < 1:
        return [TextContent(type="text", text="top_k must be at least 1.")]

    files = get_all_markdown_files(webclip_dir)
    if not files:
        return [TextContent(type="text", text="No WebClip files found.")]

    try:
        hits, _index_data = await asyncio.to_thread(
            search_semantic,
            webclip_dir,
            query,
            files,
            parse_file_content,
            top_k=top_k,
            rebuild=rebuild_index,
        )
    except Exception as e:
        return [TextContent(type="text", text=f"Semantic search failed: {e}")]

    if not hits:
        return [
            TextContent(
                type="text",
                text=f"No semantically similar files found for: {query}",
            )
        ]

    results = []
    for rank, hit in enumerate(hits, start=1):
        lines = [
            f"{rank}. {hit.filename} (score: {hit.score:.3f})",
            f"   Title: {hit.title or 'No title'}",
            f"   Source: {hit.source or 'No source'}",
            f"   Created: {hit.created or 'Unknown'}",
        ]
        if hit.visit_duration:
            lines.append(f"   Visit duration: {hit.visit_duration}")
        if hit.window_id:
            lines.append(f"   Window ID: {hit.window_id}")
        if hit.tab_id:
            lines.append(f"   Tab ID: {hit.tab_id}")
        lines.append(f"   Snippet: {hit.snippet}")
        results.append("\n".join(lines))

    output = f"Found {len(hits)} semantically similar file(s) for '{query}':\n\n"
    output += "\n\n".join(results)
    return [TextContent(type="text", text=output)]


async def handle_index_status(webclip_dir: Path) -> list[TextContent]:
    """Handle index_status tool call."""
    files = get_all_markdown_files(webclip_dir)
    if not files:
        return [TextContent(type="text", text="No WebClip files found.")]

    try:
        status = await asyncio.to_thread(
            get_index_status,
            webclip_dir,
            files,
            parse_frontmatter,
        )
    except Exception as e:
        return [TextContent(type="text", text=f"Failed to read index status: {e}")]

    summary_pct = (
        100 * status.with_summary / status.total_files if status.total_files else 0
    )
    description_pct = (
        100 * status.with_description / status.total_files if status.total_files else 0
    )

    lines = [
        "Semantic index status:",
        f"- Index path: {status.index_path}",
        f"- Model: {status.model}",
        f"- Total files: {status.total_files}",
        f"- Indexed files (in cache): {status.indexed_files}",
        f"- Pending update: {status.pending_files}",
        f"- Total chunks: {status.chunk_count}",
        f"- With summary: {status.with_summary} ({summary_pct:.0f}%)",
        f"- With description: {status.with_description} ({description_pct:.0f}%)",
    ]
    return [TextContent(type="text", text="\n".join(lines))]


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


async def handle_remove_contents(
    webclip_dir: Path, filename: str, dry_run: bool
) -> list[TextContent]:
    """Handle remove_contents tool call."""
    if not filename:
        return [TextContent(type="text", text="Filename cannot be empty.")]

    file_path = find_file_by_name(webclip_dir, filename)
    if not file_path:
        return [TextContent(type="text", text=f"File not found: {filename}")]

    frontmatter = parse_frontmatter(file_path)
    file_info = format_file_info_with_path(webclip_dir, file_path, frontmatter)

    if dry_run:
        output = (
            "[dry_run] remove_contents preview\n\n"
            "Summary:\n"
            "- matched: 1\n"
            "- would_remove: 1\n\n"
            "Would remove 1 file:\n\n"
            f"{file_info}\n\n"
            "No files were modified."
        )
        return [TextContent(type="text", text=output)]

    try:
        file_path.unlink()
    except OSError as e:
        return [TextContent(type="text", text=f"Failed to delete {filename}: {e}")]

    try:
        await sync_semantic_index(webclip_dir)
    except Exception as e:
        return [
            TextContent(
                type="text",
                text=(
                    f"Deleted {filename}, but failed to update semantic index: {e}"
                ),
            )
        ]

    output = (
        "Removed 1 file:\n\n"
        f"{file_info}"
    )
    return [TextContent(type="text", text=output)]


async def handle_remove_contents_by_date(
    webclip_dir: Path, start_date_str: str, end_date_str: str, dry_run: bool
) -> list[TextContent]:
    """Handle remove_contents_by_date tool call."""
    start_date, end_date, error = parse_date_range(start_date_str, end_date_str)
    if error:
        return [TextContent(type="text", text=error)]

    matches = match_files_by_date(webclip_dir, start_date, end_date)
    if not matches:
        return [
            TextContent(
                type="text",
                text=f"No files found between {start_date_str} and {end_date_str}.",
            )
        ]

    file_infos = [
        format_file_info_with_path(webclip_dir, file_path, frontmatter)
        for file_path, frontmatter in matches
    ]

    if dry_run:
        output = (
            "[dry_run] remove_contents_by_date preview\n\n"
            "Criteria:\n"
            f"  - start_date: {start_date_str}\n"
            f"  - end_date: {end_date_str}\n\n"
            "Summary:\n"
            f"- matched: {len(matches)}\n"
            f"- would_remove: {len(matches)}\n\n"
            f"Would remove {len(matches)} file(s):\n\n"
            + "\n\n".join(file_infos)
            + "\n\nNo files were modified."
        )
        return [TextContent(type="text", text=output)]

    removed: list[str] = []
    errors: list[str] = []
    for file_path, frontmatter in matches:
        file_info = format_file_info_with_path(webclip_dir, file_path, frontmatter)
        try:
            file_path.unlink()
            removed.append(file_info)
        except OSError as e:
            errors.append(f"- {file_path.name}: {e}")

    if removed:
        try:
            await sync_semantic_index(webclip_dir)
        except Exception as e:
            errors.append(f"Failed to update semantic index: {e}")

    output_parts = [f"Removed {len(removed)} file(s):"]
    if removed:
        output_parts.append("")
        output_parts.append("\n\n".join(removed))
    if errors:
        output_parts.append("")
        output_parts.append(f"Errors ({len(errors)}):")
        output_parts.extend(errors)

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
