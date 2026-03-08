# wix-velo-mcp

Custom MCP (Model Context Protocol) server for Wix Velo code deployment. Wraps the Wix CLI to enable AI agents to sync, preview, and publish Velo site code through a safe, structured interface.

## Architecture

This server bridges a **dev repo** (where code is developed and tested) and a **prod repo** (where code is deployed to Wix). Only tagged releases can be synced to production, enforcing a release-gated deployment model.

```
carolina-futons (dev)          wix-velo-mcp           carolina_futons_velO (prod)
  ├── src/                    ┌──────────────┐          ├── src/
  ├── tests/         ───────► │  5 MCP tools │ ───────► ├── tests/
  ├── package.json            │  stdio transport│       ├── package.json
  └── git tags (v0.0.0...)    └──────────────┘          └── wix.config.json
                                                              │
                                                         Wix GitHub Integration
                                                              │
                                                         Live Site
```

## Tools

| Tool | Description |
|------|-------------|
| `velo_status` | Check Wix CLI auth status, prod repo git state, and current deployed tag |
| `velo_sync` | Copy a tagged release from dev repo to prod repo. Validates semver tag, checks out via worktree, copies `src/`, `tests/`, `package.json`, `vitest.config.js`, commits as `release: <tag>`, and pushes |
| `velo_diff` | Preview what would change in prod if synced to a given tag (or latest). Uses `rsync --dry-run` against a worktree checkout |
| `velo_preview` | Start `wix dev` server and capture the preview URL. Server runs in background; use `velo_preview_stop` to shut down |
| `velo_publish` | Publish prod repo to live Wix site. Pre-flight checks: clean worktree + passing tests (5-min timeout). Then runs `wix publish` |

### Safety guarantees

- **Tag-gated**: `velo_sync` only accepts semver release tags (`v0.0.0`, `v1.2.3`). Branch names, commit hashes, and arbitrary refs are rejected.
- **Pre-flight checks**: `velo_publish` requires a clean worktree and passing tests before publishing.
- **Worktree isolation**: `velo_sync` and `velo_diff` checkout tags into temporary worktrees, never modifying the dev repo's working tree. Worktrees are cleaned up in `finally` blocks.
- **Idempotent sync**: If prod already matches the tag, `velo_sync` reports "no changes" without creating an empty commit.

## Setup

### Prerequisites

- Node.js >= 20
- Wix CLI authenticated (`npx wix login`)
- Git repos for dev and prod clones

### Install

```bash
git clone git@github.com:DreadPirateRobertz/wix-velo-mcp.git
cd wix-velo-mcp
npm install
npm run build
```

### Verify

```bash
npm test        # Run test suite
node dist/index.js  # Starts MCP server on stdio (will wait for MCP client)
```

## Configuration

Two environment variables are required:

| Variable | Description | Example |
|----------|-------------|---------|
| `VELO_DEV_REPO` | Absolute path to the development repo (carolina-futons) | `/path/to/carolina-futons` |
| `VELO_PROD_REPO` | Absolute path to the production repo (carolina_futons_velO) | `/path/to/carolina_futons_velO` |

The server will throw on startup if either is missing.

## Usage with Claude Code

Add to your MCP settings (project-level `.claude/settings.local.json` or global `~/.claude/settings.json`):

```json
{
  "mcpServers": {
    "wix-velo": {
      "command": "node",
      "args": ["/path/to/wix-velo-mcp/dist/index.js"],
      "env": {
        "VELO_DEV_REPO": "/path/to/carolina-futons",
        "VELO_PROD_REPO": "/path/to/carolina_futons_velO"
      }
    }
  }
}
```

Then in any Claude Code session, the 5 tools will be available as MCP tools.

### Typical deployment workflow

```
1. velo_status          # Verify auth + prod repo state
2. velo_diff v0.1.0     # Preview what would change
3. velo_sync v0.1.0     # Sync tagged release to prod
4. velo_preview         # Start dev server, get preview URL
5. velo_publish         # Publish to live site (runs tests first)
```

## Development

```bash
npm run dev         # Watch mode (tsc --watch)
npm test            # Run tests once
npm run test:watch  # Watch mode tests
npm run build       # Build to dist/
```

### Project structure

```
src/
  index.ts              # MCP server entry point, tool registration
  lib/
    exec.ts             # Shell execution helpers (run, runInDir, spawnUntilMatch)
    config.ts           # Environment configuration
  tools/
    veloStatus.ts       # velo_status implementation
    veloSync.ts         # velo_sync implementation
    veloDiff.ts         # velo_diff implementation
    veloPreview.ts      # velo_preview + velo_preview_stop
    veloPublish.ts      # velo_publish implementation
tests/
    *.test.ts           # Vitest tests with mocked exec layer
```

### Tech stack

- **TypeScript** with strict mode, ES2022 target, Node16 module resolution
- **@modelcontextprotocol/sdk** for MCP server framework (stdio transport)
- **execa** for shell command execution
- **zod** for input schema validation
- **vitest** for testing

## License

Private. Carolina Futons internal tooling.
