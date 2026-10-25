import fs from "node:fs";
import path from "node:path";
const files = [
  "README.md",
  ...fs
    .readdirSync("docs")
    .filter((f) => f.endsWith(".md"))
    .map((f) => "docs/" + f),
];
const errors = [];
for (const file of files) {
  const text = fs.readFileSync(file, "utf8");
  for (const match of text.matchAll(/\]\(([^)]+)\)/g)) {
    const target = match[1].split("#")[0];
    if (!target || /^(https?:|mailto:)/.test(target)) continue;
    if (!fs.existsSync(path.resolve(path.dirname(file), target)))
      errors.push(file + " → " + target);
  }
}
const inventory = JSON.parse(
  fs.readFileSync("docs/figma-inventory.json", "utf8"),
);
if (inventory.source.length !== 836) errors.push("Expected 836 source entries");
if (inventory.prototype.children.length !== 834)
  errors.push("Expected 834 prototype frames");
if (inventory.register.foundation.length !== 48)
  errors.push("Expected 48 foundation entries");
const sourceIds = new Set(inventory.source.map((n) => n.id));
if (sourceIds.size !== inventory.source.length)
  errors.push("Duplicate Figma source node ID");
for (const source of inventory.source) {
  if (!source.implementation?.entry || !source.implementation?.files?.length)
    errors.push("Missing implementation mapping: " + source.id);
  for (const file of source.implementation?.files || [])
    if (!fs.existsSync(file)) errors.push(source.id + " → " + file);
}
const register = JSON.parse(
  fs.readFileSync("docs/feature-register.json", "utf8"),
);
if (register.length !== 430) errors.push("Expected 430 stable requirements");
const requirementIds = new Set(register.map((r) => r.id));
if (requirementIds.size !== register.length)
  errors.push("Duplicate requirement ID");
const checklist = fs.readFileSync("docs/implementation-checklist.md", "utf8");
const checklistIds = [...checklist.matchAll(/\*\*(\d{2}\.\d{2})\*\*/g)].map(
  (match) => match[1],
);
if (
  checklistIds.length !== 430 ||
  new Set(checklistIds).size !== 430 ||
  checklistIds.some((id) => !requirementIds.has(id))
)
  errors.push("Checklist and feature register IDs must match exactly");
for (const requirement of register) {
  if (!requirement.status || !requirement.verification)
    errors.push("Missing requirement status: " + requirement.id);
  for (const file of [
    ...(requirement.implementationFiles || []),
    ...(requirement.evidence || []),
  ])
    if (!fs.existsSync(file)) errors.push(requirement.id + " → " + file);
}
const sourceKeys = new Set(inventory.source.map((n) => n.key));
for (const p of inventory.prototype.children)
  if (!sourceKeys.has(p.name.split(" / ")[1]))
    errors.push("Unmapped prototype: " + p.id);
if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log(
  `${files.length} documentation files checked; 430 requirements, 836 source entries, 834 prototype frames and 48 foundations accounted for.`,
);
