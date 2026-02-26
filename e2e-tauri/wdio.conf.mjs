import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// The compiled debug binary path
const application = path.resolve(
  __dirname,
  '../src-tauri/target/debug/minikyu',
);

export const config = {
  // WebDriver server started by tauri-plugin-webdriver inside the app
  hostname: '127.0.0.1',
  port: 4445,

  specs: ['./test/specs/**/*.mjs'],

  // Run one spec at a time — all specs share the same app and webview
  maxInstances: 1,

  capabilities: [{}],

  reporters: ['spec'],

  framework: 'mocha',
  mochaOpts: {
    ui: 'bdd',
    timeout: 30_000,
  },

  // Wait for the app to start and WebDriver server to be ready
  waitforTimeout: 10_000,
  connectionRetryTimeout: 30_000,
  connectionRetryCount: 5,
};
