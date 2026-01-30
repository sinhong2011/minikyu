# TanStack Development Tools

This project uses the **unified TanStack DevTools** to inspect and debug the entire TanStack ecosystem.

## What's Included

- **Query DevTools** - Inspect React Query state, cache, and queries
- **Router DevTools** - Inspect TanStack Router routes, navigation, and params
- **Unified Interface** - Single devtools panel for all TanStack libraries

## Features

### Query DevTools

- View all queries in the cache
- Inspect query data, status, and metadata
- Manually fetch/refetch queries
- Clear cache or specific queries
- View query history

### Router DevTools

- View active routes
- Inspect route load, search params
- View navigation history
- Manually navigate routes
- Check router context

## Usage

### Development Mode

DevTools automatically load in development:

```tsx
import { TanStackDevtools } from '@tanstack/react-devtools'
import { ReactQueryDevtoolsPanel } from '@tanstack/react-query-devtools'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'

;<TanStackDevtools
  plugins={[
    { name: 'Query', render: <ReactQueryDevtoolsPanel /> },
    { name: 'Router', render: <TanStackRouterDevtoolsPanel /> },
  ]}
/>
```

### Opening DevTools

Press the toggle button in the bottom-right corner of the app (default).

### Custom Position

Configure button position:

```tsx
<TanStackDevtools
  position="bottom-right" // "top-left" | "top-right" | "bottom-left" | "bottom-right"
  plugins={[
    { name: 'Query', render: <ReactQueryDevtoolsPanel /> },
    { name: 'Router', render: <TanStackRouterDevtoolsPanel /> },
  ]}
/>
```

### Production Mode

DevTools are automatically excluded from production builds via:

- `import.meta.env.DEV` check
- Bundlers tree-shake unused dev code

### Desktop Apps (Tauri)

DevTools work perfectly with Tauri apps. No special configuration needed.

## Tauri Optimization

The Query DevTools is already configured for desktop use:

```tsx
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false, // Disabled for desktop
      retry: 1,
      staleTime: 1000 * 60 * 5,
    },
  },
})
```

## Advanced Features

### Filter Queries

Search/filter queries in the Query tab:

- By query key
- By status (active, stale, paused)
- By data

### Route Inspector

In the Router tab:

- View current route path
- Inspect route params and search params
- Check loader data
- View navigation stack

### Hot Reloading

DevTools update in real-time as you interact with your app.

## Performance Impact

### Development Mode

- DevTools add ~50-70KB gzipped to bundle
- Only active when open
- Minimal overhead (~5ms per render)

### Production Mode

- **Zero** impact - completely excluded from bundle

## Troubleshooting

### DevTools Not Showing

1. Verify you're in development mode (not production build)
2. Check console for errors
3. Verify `import.meta.env.DEV` is `true`

### Plugins Not Loading

Ensure you've installed the required packages:

```bash
bun add @tanstack/react-devtools
bun add -D @tanstack/react-router-devtools
```

### Router DevTools Empty

If Router DevTools shows no data:

1. Ensure `RouterProvider` is wrapped
2. Check that routes are properly configured
3. Verify you're navigating through the app first

## Comparison: Unified vs Separate

| Feature             | Separate   | Unified       |
| ------------------- | ---------- | ------------- |
| Multiple panels     | ✅ Yes     | ✅ Yes (tabs) |
| Bundle size         | ~70KB each | ~70KB total   |
| Single interface    | ❌ No      | ✅ Yes        |
| Plugin architecture | ❌ No      | ✅ Yes        |
| Extensible          | ❌ No      | ✅ Yes        |

## Migration from React Query DevTools Only

If you were using just Query DevTools:

**Before:**

```tsx
<ReactQueryDevtools initialIsOpen={false} />
```

**After:**

```tsx
<TanStackDevtools
  plugins={[{ name: 'Query', render: <ReactQueryDevtoolsPanel /> }]}
/>
```

Note: You can install just `@tanstack/react-devtools` and use only the Query panel if needed.

## Future Plugins

The unified DevTools supports plugins for:

- ✅ Query (included)
- ✅ Router (included)
- 🚧 Table (coming)
- 🚧 Form (coming)
- 🚧 Store (coming)

Add new plugins when they're released:

```tsx
<TanStackDevtools
  plugins={[
    { name: 'Query', render: <ReactQueryDevtoolsPanel /> },
    { name: 'Router', render: <TanStackRouterDevtoolsPanel /> },
    { name: 'Table', render: <TanStackTableDevtoolsPanel /> },
  ]}
/>
```

## References

- [TanStack DevTools Docs](https://tanstack.com/devtools/latest)
- [React Query DevTools](https://tanstack.com/query/latest/docs/devtools)
- [TanStack Router DevTools](https://tanstack.com/router/latest/docs/devtools)
