import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const jsDir = path.resolve(__dirname, 'resources/js');
const iconBaseDir = path.resolve(__dirname, 'resources/assets/icons');

// Dynamisch alle Icon-Folder erkennen
const iconFolders = fs.readdirSync(iconBaseDir).filter(folder =>
  fs.statSync(path.join(iconBaseDir, folder)).isDirectory(),
);

// Aus jedem Ordner ein IconType-Objekt erstellen
const iconTypes = iconFolders.map(folder => ({
  folder,
  regex: new RegExp(`i-${folder}-([\\w-]+)`, 'g'),
}));

function getAllFiles(dir, ext = ['.vue', '.ts'], fileList = []) {
  fs.readdirSync(dir).forEach((file) => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      getAllFiles(fullPath, ext, fileList);
    }
    else if (ext.includes(path.extname(fullPath))) {
      fileList.push(fullPath);
    }
  });
  return fileList;
}

function extractIconUsages(files, regex, prefix) {
  const usages = new Map(); // key = fullKey (prefix + icon) => [{file, line}]

  for (const file of files) {
    const lines = fs.readFileSync(file, 'utf-8').split('\n');

    lines.forEach((line, index) => {
      let match;
      while ((match = regex.exec(line)) !== null) {
        const icon = match[1];
        const key = `${prefix}${icon}`;
        if (!usages.has(key)) usages.set(key, []);
        usages.get(key).push({ file, line: index + 1 });
      }
    });
  }

  return usages;
}

function getExistingIcons(dir) {
  if (!fs.existsSync(dir)) return new Set();
  return new Set(
    fs.readdirSync(dir)
      .filter(file => file.endsWith('.svg'))
      .map(file => path.basename(file, '.svg')),
  );
}

// MAIN
const allFiles = getAllFiles(jsDir);
const allUsages = new Map(); // key: i-[prefix]-name => [{file, line}]
const iconMap = new Map(); // key: iconName => Set of folders

iconTypes.forEach(({ folder, regex }) => {
  const prefix = `i-${folder}-`;
  const readableLabel = `Ordner "${folder}"`;
  const usages = extractIconUsages(allFiles, regex, prefix);

  usages.forEach((locations, key) => {
    const iconName = key.replace(prefix, '');
    allUsages.set(key, locations);

    if (!iconMap.has(iconName)) iconMap.set(iconName, new Set());
    iconMap.get(iconName).add(folder);
  });

  const existingIcons = getExistingIcons(path.join(iconBaseDir, folder));
  const missingIcons = [...usages.keys()]
    .map(k => k.replace(prefix, ''))
    .filter(icon => !existingIcons.has(icon));

  if (missingIcons.length > 0) {
    console.log(`\n❌ Fehlende Icons aus ${readableLabel}:`);
    missingIcons.forEach((icon) => {
      const fullKey = `${prefix}${icon}`;
      console.log(`\n🔸 Icon "${icon}"`);
      usages.get(fullKey).forEach(({ file, line }) => {
        console.log(`  ↪ ${file}:${line}`);
      });
    });
  }
  else {
    console.log(`\n✅ Alle Icons aus ${readableLabel} sind vorhanden.`);
  }
});

// Mehrfachverwendungen mit verschiedenen Präfixen
console.log(`\n🔎 Icons, die mit mehreren Ordnern verwendet werden:`);
let conflictFound = false;
iconMap.forEach((folders, iconName) => {
  if (folders.size > 1) {
    conflictFound = true;
    console.log(`\n⚠️  Icon "${iconName}" wird in mehreren Ordnern verwendet: ${[...folders].join(', ')}`);
    folders.forEach((folder) => {
      const prefix = `i-${folder}-`;
      const fullKey = `${prefix}${iconName}`;
      const usages = allUsages.get(fullKey);
      if (usages) {
        usages.forEach(({ file, line }) => {
          console.log(`  ↪ ${file}:${line} (aus Ordner "${folder}")`);
        });
      }
    });
  }
});

if (!conflictFound) {
  console.log('✅ Kein Icon wurde mit mehreren Ordnern (Präfixen) verwendet.');
}
