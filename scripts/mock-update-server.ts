/**
 * Mock update server for testing the Tauri updater locally.
 *
 * Usage:
 *   bun run scripts/mock-update-server.ts
 *
 * This serves a fake latest.json at http://localhost:3737/latest.json
 * that tells the updater a new version is available.
 *
 * To use it:
 * 1. In src-tauri/src/lib.rs, temporarily remove the `if !cfg!(debug_assertions)` guard
 *    so the updater plugin loads in dev mode.
 * 2. In src-tauri/tauri.conf.json, change the updater endpoint to:
 *    "endpoints": ["http://localhost:3737/latest.json"]
 * 3. Run this server: bun run scripts/mock-update-server.ts
 * 4. Run the app: bun run dev (in another terminal)
 *
 * The mock server returns a version higher than your current app version.
 * The download URL is fake — download will fail, which is expected for testing
 * the check → available → download-error → retry flow.
 *
 * To test the full download → ready flow, you'd need to point the URL to a real
 * signed update artifact.
 */

const MOCK_VERSION = '99.0.0';
const CURRENT_DATE = new Date().toISOString();

const latestJson = {
  version: `v${MOCK_VERSION}`,
  notes: `Test release v${MOCK_VERSION}\n\n- Mock update for local testing\n- Tests progress bar and toast UI`,
  pub_date: CURRENT_DATE,
  platforms: {
    'darwin-aarch64': {
      signature: '',
      url: 'http://localhost:3737/fake-update.tar.gz',
    },
    'darwin-x86_64': {
      signature: '',
      url: 'http://localhost:3737/fake-update.tar.gz',
    },
    'linux-x86_64': {
      signature: '',
      url: 'http://localhost:3737/fake-update.AppImage.tar.gz',
    },
    'windows-x86_64': {
      signature: '',
      url: 'http://localhost:3737/fake-update.msi.zip',
    },
  },
};

const server = Bun.serve({
  port: 3737,
  fetch(req) {
    const url = new URL(req.url);

    if (url.pathname === '/latest.json') {
      console.log(`[${new Date().toLocaleTimeString()}] Served latest.json → v${MOCK_VERSION}`);
      return Response.json(latestJson);
    }

    if (url.pathname.includes('fake-update')) {
      // Return a small dummy file to simulate download progress
      console.log(`[${new Date().toLocaleTimeString()}] Serving fake update binary`);
      const fakeData = new Uint8Array(1024 * 100); // 100KB fake binary
      return new Response(fakeData, {
        headers: {
          'Content-Type': 'application/octet-stream',
          'Content-Length': String(fakeData.length),
        },
      });
    }

    return new Response('Not found', { status: 404 });
  },
});

console.log(`Mock update server running at http://localhost:${server.port}`);
console.log(`Serving version: v${MOCK_VERSION}`);
console.log('');
console.log('To test, update these files temporarily:');
console.log('');
console.log('1. src-tauri/src/lib.rs — remove the debug_assertions guard:');
console.log('   Change: if !cfg!(debug_assertions) {');
console.log('   To:     if true {');
console.log('');
console.log('2. src-tauri/tauri.conf.json — change endpoint:');
console.log(`   "endpoints": ["http://localhost:${server.port}/latest.json"]`);
console.log('');
console.log('3. Run: bun run dev');
console.log('');
console.log('Press Ctrl+C to stop.');
