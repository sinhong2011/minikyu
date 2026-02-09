# Logging

Simple logging setup for both Rust backend and TypeScript frontend.

## Quick Start

### Rust (Backend)

```rust
log::info!("Application starting up");
log::debug!("Debug info: {}", some_value);
log::warn!("Something unexpected happened");
log::error!("Error occurred: {}", error);
```

### TypeScript (Frontend)

```typescript
import { logger } from '@/lib/logger'

logger.info('User action completed')
logger.debug('Debug data', { userId: 123, action: 'click' })
logger.warn('Performance warning')
logger.error('Request failed', { error: response.error })
```

## Configuration

### Rust Backend

- Uses `tauri-plugin-log` with standard Rust `log` crate
- **Development**: Info level by default, logs to stdout + webview console + JSON log file
- **Production**: Info level, logs to stdout + JSON log file in app log directory
- Configuration in `src-tauri/src/lib.rs`
- **Log Level**: Controlled via `TAURI_LOG_LEVEL` environment variable
- **Environment Loading**: Uses `dotenvy` to load variables from `.env` file in development

#### Environment Variable Configuration

The Rust backend uses `dotenvy` to load environment variables from a `.env` file in the project root during development. This happens early in the application startup, before any environment-dependent configuration is loaded.

**Setting up the .env file:**

1. Copy the example file to create your local `.env`:
   ```bash
   cp .env.example .env
   ```

2. Edit the `.env` file and set `TAURI_LOG_LEVEL`:
   ```bash
   TAURI_LOG_LEVEL=debug
   ```

**Environment Variable Precedence:**
1. System environment variables (highest priority)
2. Variables from `.env` file (loaded by dotenvy in development only)
3. Default values based on build type (lowest priority)

**Valid values** (in order of verbosity): `trace`, `debug`, `info`, `warn`, `error`

**Default behavior:**
- Development: `info` level (shows info, warn, error)
- Production: `info` level (shows info, warn, error)

**Noise filters (backend):**
- These modules are clamped to `warn` by default to keep logs readable: `sqlx`, `reqwest`, `hyper`, `hyper_util`, `tauri`, `tauri_plugin_updater`.
- If you need their debug output, temporarily adjust these filters in `src-tauri/src/lib.rs`.

**Note:** The `.env` file is only loaded in development builds. In production, only system environment variables are used. The application will not panic if the `.env` file is missing.

### TypeScript Frontend

- **Development**: All logs go to browser console
- **Production**: Console logging only (keeps it simple)
- Logger utility at `src/lib/logger.ts`
- **Log Level**: Controlled via `VITE_LOG_LEVEL` environment variable

#### Environment Variable Configuration

Create a `.env` file in the project root (copy from `.env.example`):

```bash
# .env
VITE_LOG_LEVEL=debug
```

Valid values (in order of verbosity): `trace`, `debug`, `info`, `warn`, `error`

**Default behavior:**
- Development: `debug` level (shows debug, info, warn, error)
- Production: `info` level (shows info, warn, error)

You can also change the log level at runtime:

```typescript
import { logger } from '@/lib/logger'

// Get current log level
console.log(logger.getLogLevel()) // 'debug'

// Set log level at runtime
logger.setLogLevel('trace')
```

## Log Levels

| Level   | When to Use            | Dev | Prod |
| ------- | ---------------------- | --- | ---- |
| `trace` | Most verbose debugging | ✅  | ❌   |
| `debug` | Development debugging  | ✅  | ❌   |
| `info`  | General information    | ✅  | ✅   |
| `warn`  | Warning conditions     | ✅  | ✅   |
| `error` | Error conditions       | ✅  | ✅   |

## Where Logs Appear

### Development

- **Rust**: Terminal (stdout) + Browser DevTools console (webview) + JSON log file
- **TypeScript**: Browser DevTools console

### Production

- **Rust**: Terminal (stdout) + JSON log file in app log directory
- **TypeScript**: Browser DevTools console

Log directory locations vary by platform (e.g., `~/Library/Logs/` on macOS). JSON logs are one object per line (JSONL) for easy parsing.

## Examples

### Rust Tauri Commands

```rust
#[tauri::command]
async fn save_data(data: MyData) -> Result<(), String> {
    log::info!("Saving data for user: {}", data.user_id);

    match save_to_disk(&data).await {
        Ok(_) => {
            log::info!("Data saved successfully");
            Ok(())
        }
        Err(e) => {
            log::error!("Failed to save data: {}", e);
            Err(format!("Save failed: {}", e))
        }
    }
}
```

### TypeScript React Components

```typescript
import { logger } from '@/lib/logger'

function MyComponent() {
  const handleClick = () => {
    logger.debug('Button clicked', { component: 'MyComponent' })

    try {
      performAction()
      logger.info('Action completed successfully')
    } catch (error) {
      logger.error('Action failed', { error })
    }
  }

  return <button onClick={handleClick}>Click me</button>
}
```

## Best Practices

1. **Use appropriate log levels** - Don't log everything as `info`
2. **Include context** - Add relevant data to help debugging
3. **Log errors with details** - Include error messages and context
4. **Keep messages concise** - But descriptive enough to be useful
5. **Use structured logging** - Include objects/context for complex data

See [error-handling.md](./error-handling.md) for patterns on when to log vs show errors to users.

## Production Considerations

- Rust logs go to the app's log directory (platform-specific location)
- No sensitive data should be logged (passwords, tokens, etc.)
- The plugin supports log rotation when files reach size limits
- Frontend logs stay in browser - not sent to backend by default
