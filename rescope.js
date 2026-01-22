#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const ORG_SCOPE = "@rabacsa-kft";
const REPO_URL_BASE =
  "https://github.com/Rabacsa-Kft/react-spectrum/tree/main/packages";
const PACKAGE_DIRS = ["packages"]; // root folder for workspaces

// Map upstream scopes to your org prefix
const SCOPE_MAP = {
  "@react-spectrum/": "react-spectrum-",
  "@react-aria/": "react-aria-",
  "@react-stately/": "react-stately-",
  "@react-types/": "react-types-",
  "@internationalized/": "internationalized-",
};

let filesVisited = 0;
let filesModified = 0;
const modifiedFiles = [];
const allPackageNames = [];

function walk(dir) {
  for (const entry of fs.readdirSync(dir)) {
    const fullPath = path.join(dir, entry);
    const stat = fs.lstatSync(fullPath);

    // Skip symlinks
    if (stat.isSymbolicLink()) continue;

    if (stat.isDirectory()) {
      walk(fullPath);
    } else if (entry === "package.json") {
      filesVisited++;
      let modified = false;

      const pkgJson = JSON.parse(fs.readFileSync(fullPath, "utf8"));

      if (pkgJson.private) continue; // skip private packages

      // Only proceed if name exists
      if (typeof pkgJson.name !== "string") continue;

      allPackageNames.push(pkgJson.name);

      // 1️⃣ Rescope package name if necessary
      let newName = pkgJson.name;

      if (!newName.startsWith(`${ORG_SCOPE}/`)) {
        for (const [oldScope, newPrefix] of Object.entries(SCOPE_MAP)) {
          if (newName.startsWith(oldScope)) {
            newName = `${ORG_SCOPE}/${newPrefix}${newName.slice(oldScope.length)}`;
            modified = true;
            break;
          }
        }
      }

      if (pkgJson.name !== newName) {
        pkgJson.name = newName;
        modified = true;
      }

      // 2️⃣ Ensure publishConfig.registry is correct (merge instead of overwrite)
      pkgJson.publishConfig = {
        ...pkgJson.publishConfig,
        registry: "https://npm.pkg.github.com",
      };
      modified = true;

      // 3️⃣ Ensure repository URL points to your fork
      const relativePath = path
        .relative("packages", path.dirname(fullPath))
        .replace(/\\/g, "/");
      const correctRepoUrl = `${REPO_URL_BASE}/${relativePath}`;
      if (!pkgJson.repository || pkgJson.repository.url !== correctRepoUrl) {
        pkgJson.repository = { type: "git", url: correctRepoUrl };
        modified = true;
      }

      // 4️⃣ Write changes only if needed
      if (modified) {
        fs.writeFileSync(
          fullPath,
          JSON.stringify(pkgJson, null, 2) + "\n",
          "utf8",
        );
        console.log(`✅ Updated: ${fullPath}`);
        filesModified++;
        modifiedFiles.push(fullPath);
      }
    }
  }
}

// Run
for (const dir of PACKAGE_DIRS) {
  walk(dir);
}

// Check for duplicate package names after rescoping
const nameCounts = allPackageNames.reduce((acc, name) => {
  acc[name] = (acc[name] || 0) + 1;
  return acc;
}, {});
const duplicates = Object.entries(nameCounts)
  .filter(([_, count]) => count > 1)
  .map(([name]) => name);

// Summary
console.log("\n--- Summary ---");
console.log(`Files visited:  ${filesVisited}`);
console.log(`Files modified: ${filesModified}`);
if (modifiedFiles.length) {
  console.log("Modified files:");
  modifiedFiles.forEach((f) => console.log(`  ${f}`));
}
if (duplicates.length) {
  console.warn("\n⚠️ Duplicate package names detected:");
  duplicates.forEach((name) => console.warn(`  ${name}`));
} else {
  console.log("No duplicate package names detected.");
}
console.log("----------------\n");
