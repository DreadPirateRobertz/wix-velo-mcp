# wix-velo-mcp

MCP server for Wix Velo code deployment. Wraps the Wix CLI to enable AI agents to sync, preview, and publish Velo code.

## Tools

| Tool | Description |
|------|-------------|
| velo_status | Check Wix CLI auth and deployment state |
| velo_sync | Copy tagged release from dev repo to production repo |
| velo_diff | Preview what would change on sync |
| velo_preview | Generate shareable preview URL |
| velo_publish | Publish code to production |

## Configuration

Set environment variables:
- `VELO_DEV_REPO` -- Path to carolina-futons dev repo
- `VELO_PROD_REPO` -- Path to carolina_futons_velO production repo

## Usage with Claude Code

Add to your MCP settings:
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
