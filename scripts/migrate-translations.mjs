import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..');

const en = JSON.parse(fs.readFileSync(path.join(rootDir, 'locales/en.json'), 'utf8'));
const ar = JSON.parse(fs.readFileSync(path.join(rootDir, 'locales/ar.json'), 'utf8'));
const fr = JSON.parse(fs.readFileSync(path.join(rootDir, 'locales/fr.json'), 'utf8'));

const createPo = (translations, lang) => {
  let po =
    'msgid ""\nmsgstr ""\n"POT-Creation-Date: 2026-01-22 22:00+0800\\n"\n"MIME-Version: 1.0\\n"\n"Content-Type: text/plain; charset=utf-8\\n"\n"Content-Transfer-Encoding: 8bit\\n"\n"X-Generator: @lingui/cli\\n"\n"Language: ' +
    lang +
    '\\n\\n"';

  Object.entries(translations).forEach(([key, value]) => {
    po += `\nmsgid "${key}"\n`;
    po += `msgstr "${value}"\n`;
  });

  return po;
};

fs.writeFileSync(path.join(rootDir, 'src/locales/en/messages.po'), createPo(en, 'en'));
fs.writeFileSync(path.join(rootDir, 'src/locales/ar/messages.po'), createPo(ar, 'ar'));
fs.writeFileSync(path.join(rootDir, 'src/locales/fr/messages.po'), createPo(fr, 'fr'));

console.log('PO files created successfully from JSON translations');
