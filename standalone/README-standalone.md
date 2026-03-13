# OAuth2APIlocal - Standalone Executable

A cross-platform standalone OAuth2 API Gateway for GitHub Copilot and Google Gemini Pro, providing an OpenAI-compatible local API interface.

## Features

- **Multi-Provider Support**: Route requests to GitHub Copilot or Google Gemini based on model name
- **OpenAI-Compatible API**: Works with any OpenAI-compatible client (LangChain, Cursor, etc.)
- **Cross-Platform Binaries**: Native executables for macOS, Windows, and Linux
- **Streaming Support**: Server-Sent Events (SSE) for real-time responses
- **Security**: API key authentication, rate limiting, masked logging
- **Configuration**: Persistent config file at `~/.oauth2apilocal/config.json`

## Installation

### Pre-built Binaries

Download the latest binary for your platform from the releases page:

- macOS: `oauth2apilocal-macos`
- Windows: `oauth2apilocal-win.exe`
- Linux: `oauth2apilocal-linux`

Make it executable (macOS/Linux):
```bash
chmod +x oauth2apilocal-*
./oauth2apilocal-macos --help
```

### From Source

```bash
cd standalone
npm install
npm run build
node dist/standalone.js --help
```

### Build Binaries

```bash
cd standalone
make install
make package
```

Binaries will be in `standalone/bin/`.

## Quick Start

### 1. Set up authentication

#### For Google Gemini:
```bash
export GEMINI_API_KEY="your-gemini-api-key"
```

Get your API key from: https://makersuite.google.com/app/apikey

#### For GitHub Copilot:
```bash
export GITHUB_TOKEN="your-github-token"
```

Note: GitHub Copilot requires a valid GitHub account with Copilot access.

### 2. Start the server

```bash
oauth2apilocal --port 1337 --host 127.0.0.1
```

### 3. Test the endpoint

```bash
# Health check
curl http://localhost:1337/health

# List available models
curl http://localhost:1337/v1/models

# Chat completion (Gemini)
curl -X POST http://localhost:1337/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gemini-pro",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'

# Streaming response
curl -X POST http://localhost:1337/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gemini-1.5-flash",
    "messages": [{"role": "user", "content": "Write a haiku"}],
    "stream": true
  }'
```

## Configuration

### Command-Line Options

```
-p, --port <number>          Port to listen on (default: 1337)
-h, --host <string>          Host interface (default: 127.0.0.1)
-l, --log-level <level>      Log level: debug, info, warn, error (default: info)
-c, --config <path>          Path to config file (default: ~/.oauth2apilocal/config.json)
--providers <list>           Comma-separated provider list (default: copilot,gemini)
--api-key <key>              API key for authentication
--copilot-token <token>      GitHub Copilot OAuth2 token
--gemini-api-key <key>       Google Gemini API key
--help, -?                   Show help message
--version, -v                Show version
```

### Environment Variables

```bash
GEMINI_API_KEY               # Google Gemini API key (alternative to --gemini-api-key)
GOOGLE_CLIENT_ID             # Google OAuth2 client ID (for OAuth2 flow)
GOOGLE_CLIENT_SECRET         # Google OAuth2 client secret (for OAuth2 flow)
GITHUB_TOKEN                 # GitHub personal access token
```

### Config File

The config file is automatically created at `~/.oauth2apilocal/config.json`:

```json
{
  "port": 1337,
  "host": "127.0.0.1",
  "providers": {
    "copilot": {
      "enabled": true,
      "token": "..."
    },
    "gemini": {
      "enabled": true,
      "apiKey": "..."
    }
  },
  "preferences": {
    "defaultProvider": "copilot",
    "logLevel": "info",
    "enableLogging": true
  }
}
```

## Provider Routing

The gateway automatically routes requests based on model name:

| Model Prefix | Provider |
|-------------|----------|
| `gpt-*` | Copilot |
| `claude-*` | Copilot |
| `gemini-*` | Gemini |
| `models/gemini-*` | Gemini |

### Supported Models

**GitHub Copilot** (via GitHub API):
- `gpt-4o-copilot`
- `gpt-4-copilot`
- `gpt-3.5-turbo-copilot`
- `claude-3.5-sonnet-copilot`

**Google Gemini**:
- `gemini-pro`
- `gemini-1.5-pro`
- `gemini-1.5-flash`
- `gemini-2.0-flash-exp`

## API Endpoints

### `GET /health`
Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "service": "oauth2apilocal-standalone"
}
```

### `GET /v1/models`
List all available models from all providers.

**Response:**
```json
{
  "object": "list",
  "data": [
    {
      "id": "gemini-pro",
      "object": "model",
      "created": 1234567890,
      "owned_by": "google"
    }
  ]
}
```

### `POST /v1/chat/completions`
OpenAI-compatible chat completion endpoint.

**Request:**
```json
{
  "model": "gemini-pro",
  "messages": [
    {"role": "system", "content": "You are a helpful assistant."},
    {"role": "user", "content": "Hello!"}
  ],
  "temperature": 0.7,
  "max_tokens": 1000,
  "stream": false
}
```

**Response:**
```json
{
  "id": "gemini-1234567890",
  "object": "chat.completion",
  "created": 1234567890,
  "model": "gemini-pro",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "Hello! How can I help you today?"
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 20,
    "completion_tokens": 10,
    "total_tokens": 30
  }
}
```

## Security

### API Key Authentication

Protect your local gateway with an API key:

```bash
oauth2apilocal --api-key your-secret-key
```

Clients must provide the key via Bearer token or x-api-key header:

```bash
curl -H "Authorization: Bearer your-secret-key" \
  http://localhost:1337/v1/models
```

### Masked Logging

All secrets (tokens, API keys, passwords) are automatically masked in logs:

```
2026-03-13T13:35:38.000Z [INFO] Gemini client initialized
2026-03-13T13:35:39.000Z [DEBUG] Calling Gemini API with key: ***
```

### Rate Limiting

Built-in rate limiting (60 requests/minute by default).

## Integration Examples

### Python (OpenAI SDK)

```python
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:1337/v1",
    api_key="not-needed"
)

response = client.chat.completions.create(
    model="gemini-pro",
    messages=[
        {"role": "user", "content": "Hello!"}
    ]
)

print(response.choices[0].message.content)
```

### Node.js

```javascript
const response = await fetch('http://localhost:1337/v1/chat/completions', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model: 'gemini-1.5-flash',
    messages: [{ role: 'user', content: 'Hello!' }]
  })
});

const data = await response.json();
console.log(data.choices[0].message.content);
```

### LangChain

```python
from langchain.chat_models import ChatOpenAI

llm = ChatOpenAI(
    base_url="http://localhost:1337/v1",
    model="gemini-pro",
    openai_api_key="not-needed"
)

response = llm.invoke("Hello!")
print(response.content)
```

## Troubleshooting

### "No providers available"

Make sure you've set authentication credentials:
```bash
export GEMINI_API_KEY="your-key"
export GITHUB_TOKEN="your-token"
```

### "Provider not available"

Check logs with `--log-level debug`:
```bash
oauth2apilocal --log-level debug
```

### Port already in use

Change the port:
```bash
oauth2apilocal --port 8080
```

## Development

### Project Structure

```
standalone/
├── src/
│   ├── index.ts              # CLI entry point
│   ├── gateway/
│   │   ├── Provider.ts       # Base provider interface
│   │   ├── CopilotProvider.ts # GitHub Copilot implementation
│   │   ├── GeminiProvider.ts  # Google Gemini implementation
│   │   ├── ProviderRouter.ts  # Multi-provider routing
│   │   └── LocalServer.ts     # HTTP server
│   ├── auth/
│   │   ├── CopilotAuth.ts    # GitHub OAuth2
│   │   └── GeminiAuth.ts     # Google OAuth2/API key
│   ├── config/
│   │   └── ConfigManager.ts  # Config file management
│   ├── cli/
│   │   └── args.ts           # CLI argument parsing
│   └── utils/
│       └── logger.ts         # Masked logging
├── dist/                     # Build output
├── bin/                      # Native binaries
├── package.json
├── tsconfig.json
├── esbuild.standalone.js
├── pkg.config.json
└── Makefile
```

### Building

```bash
# Install dependencies
make install

# Development build
make build

# Production build
make build-prod

# Create binaries
make package

# Clean build artifacts
make clean
```

### Testing

```bash
npm test
```

## Differences from VS Code Extension

The standalone executable differs from the VS Code extension in these ways:

1. **No VS Code API**: Direct API calls instead of `vscode.lm` abstraction
2. **Configuration**: File-based (`~/.oauth2apilocal/config.json`) instead of VS Code settings
3. **Authentication**: Environment variables and config file instead of extension context
4. **Process Management**: Standalone process with SIGINT/SIGTERM handling

## License

MIT

## Contributing

See the main repository: https://github.com/digitalsorc/Oauth2APIlocal

## Support

For issues or questions, please open an issue on GitHub.
