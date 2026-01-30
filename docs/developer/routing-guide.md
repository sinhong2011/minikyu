# TanStack Router Guide

This project uses **TanStack Router v1** for file-based routing with full TypeScript type safety.

## Quick Start

### File-Based Routing

Routes are defined in `src/routes/` as TypeScript files:

```
src/routes/
├── __root.tsx          # Root layout (required)
├── index.tsx           # / (home)
├── preferences.tsx     # /preferences
└── documents/
    ├── index.tsx       # /documents
    └── $docId.tsx      # /documents/:id
```

### Example Routes

**Root Layout (`routes/__root.tsx`):**

```tsx
import { createRootRoute, Outlet } from '@tanstack/react-router'
import App from '../App'

export const Route = createRootRoute({
  component: RootComponent,
})

function RootComponent() {
  return (
    <App>
      <Outlet />
    </App>
  )
}
```

**Simple Route (`routes/index.tsx`):**

```tsx
import { createFileRoute } from '@tanstack/react-router'
import { MainWindowContent } from '../components/layout/MainWindowContent'

export const Route = createFileRoute('/')({
  component: () => <MainWindowContent />,
})
```

**Dynamic Route (`routes/documents/$docId.tsx`):**

```tsx
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/documents/$docId')({
  loader: async ({ params }) => {
    return fetchDocument(params.docId)
  },
  component: DocumentComponent,
})

function DocumentComponent() {
  const { docId } = Route.useParams()
  const document = Route.useLoaderData()
  return <div>{document.title}</div>
}
```

## Type Safety

TanStack Router provides full TypeScript type safety:

```tsx
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/posts/$postId')({
  component: PostComponent,
})

function PostComponent() {
  // ✅ Type-safe params
  const { postId } = Route.useParams() // postId is string

  // ✅ Type-safe navigation
  const navigate = Route.useNavigate()
  navigate({ to: '/posts/$postId', params: { postId: '123' } })

  // ✅ Type-safe loader data
  const data = Route.useLoaderData()
}
```

## Navigation

### Using Link Component

```tsx
import { Link } from '@tanstack/react-router'

<Link to="/">Home</Link>
<Link to="/documents/$docId" params={{ docId: 'abc' }}>Document</Link>
<Link to="/search"
      search={{ page: 1, query: 'test' }}>Search</Link>
```

### Using useNavigate Hook

```tsx
import { useNavigate } from '@tanstack/react-router'

const navigate = useNavigate()

navigate({ to: '/documents/$docId', params: { docId: 'abc' } })
navigate({ to: '/search', search: { page: 2 } })
navigate({ to: '/documents' })
```

## Search Params with Validation

Zod integration for validated search params:

```tsx
import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

const searchSchema = z.object({
  page: z.coerce.number().default(1),
  category: z.string().optional(),
})

export const Route = createFileRoute('/products')({
  validateSearch: searchSchema,
  component: ProductsComponent,
})

function ProductsComponent() {
  // search.page is number, search.category is string | undefined
  const search = Route.useSearch()

  return <div>Page {search.page}</div>
}
```

## Loaders

Loaders execute before route component renders:

```tsx
import { createFileRoute } from '@tanstack/react-router'
import { queryClient } from '../lib/query-client'

export const Route = createFileRoute('/posts/$postId')({
  loader: async ({ params, context }) => {
    // Access query client from context
    return context.queryClient.fetchQuery({
      queryKey: ['post', params.postId],
      queryFn: () => fetchPost(params.postId),
    })
  },
  component: PostComponent,
})
```

### Parallel Loading

Parallel loader execution with `Promise.all`:

```tsx
loader: async ({ params }) => {
  const [post, comments] = await Promise.all([
    fetchPost(params.postId),
    fetchComments(params.postId),
  ])
  return { post, comments }
}
```

## Tauri Integration

### Guard Tauri API Access

Tauri APIs are only available in the webview context:

```tsx
import { createFileRoute } from '@tanstack/react-router'
import { invoke } from '@tauri-apps/api/core'

export const Route = createFileRoute('/preferences')({
  loader: async () => {
    // Guard check
    if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
      return await invoke('load_preferences')
    }
    return {}
  },
})
```

### SSR Considerations

⚠️ **Important:** TanStack Start's SSR features don't work with Tauri. Use TanStack Router directly without SSR.

## Route Groups

Use `_` prefix for route groups without affecting URL:

```
src/routes/
├── __root.tsx
├── index.tsx
└── dashboard/
    ├── _layout.tsx      # /dashboard/* layout
    ├── index.tsx        # /dashboard
    └── settings/
        └── index.tsx    # /dashboard/settings
```

```tsx
// routes/dashboard/_layout.tsx
import { Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/dashboard/_layout')({
  component: DashboardLayout,
})

function DashboardLayout() {
  return (
    <Dashboard>
      <Outlet />
    </Dashboard>
  )
}
```

## Error Handling

Per-route error boundaries:

```tsx
import { createFileRoute, ErrorComponentProps } from '@tanstack/react-router'

export const Route = createFileRoute('/posts/$postId')({
  errorComponent: PostError,
  component: PostComponent,
})

function PostError({ error }: ErrorComponentProps) {
  return <div>Error loading post: {error.message}</div>
}
```

## Code Splitting

TanStack Router automatically code-splits by route. No manual `React.lazy` needed.

## DevTools

Router devtools are built into the unified TanStack DevTools (see Phase 8).

## Migration from Manual Routing

If migrating from manual component switching:

1. Create route file structure
2. Move components to route files with `createFileRoute`
3. Replace manual state with `useNavigate` and `<Link>`
4. Convert navigation functions to type-safe router calls

```tsx
// BEFORE (manual navigation)
const [currentPage, setCurrentPage] = useState('home')
const handleClick = () => setCurrentPage('preferences')

// AFTER (TanStack Router)
const navigate = useNavigate()
const handleClick = () => navigate({ to: '/preferences' })

// OR with Link
<Link to="/preferences">Preferences</Link>
```

## Advanced Patterns

### Context Accumulation

Pass data through nested routes:

```tsx
// routes/dashboard/_layout.tsx
export const Route = createFileRoute('/dashboard/_layout')({
  loader: () => ({ user: fetchUser() }),
  component: DashboardLayout,
})

function DashboardLayout() {
  const data = Route.useLoaderData()
  return (
    <Dashboard user={data.user}>
      <Outlet />
    </Dashboard>
  )
}
```

### Route Preloading

Control preloading behavior in `src/router.tsx`:

```tsx
export const router = createRouter({
  routeTree,
  defaultPreload: 'intent', // 'intent' | 'viewport' | 'render'
})
```

## References

- [TanStack Router Docs](https://tanstack.com/router/latest)
- [File-Based Routing](https://tanstack.com/router/latest/docs/framework/react/guide/file-based-routing)
- [Search Params](https://tanstack.com/router/latest/docs/framework/react/guide/search-params)
- [Loaders](https://tanstack.com/router/latest/docs/framework/react/guide/loaders)
