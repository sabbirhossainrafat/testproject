const lucideIcons = {
  send: "send", mail: "mail", location: "map-pin", calendar: "calendar-days",
  academic: "graduation-cap", briefcase: "briefcase", award: "award", copy: "copy", phone: "phone",
  repositories: "book-copy", fork: "git-fork", followers: "users-round", stars: "star",
  language: "languages", code: "code-xml", layers: "layers-2", external: "external-link",
  "chevron-down": "chevron-down", menu: "menu", close: "x", "arrow-up": "arrow-up",
  "arrow-right": "arrow-right", "circle-help": "circle-question-mark", activity: "activity", flame: "flame",
  trophy: "trophy", "book-open": "book-open", "gamepad-2": "gamepad-2", terminal: "terminal",
  "layout-panels": "panels-top-left", database: "database", wrench: "wrench"
};

const brandIcons = new Set([
  "github", "gmail", "whatsapp", "typescript", "javascript", "python", "c", "react",
  "nextdotjs", "tailwindcss", "html5", "nodedotjs", "express", "postgresql", "supabase",
  "git", "linux", "docker", "linkedin", "facebook", "x", "instagram", "telegram", "reddit"
]);
const aliases = { linkedin: "linkedin", email: "gmail", "visual studio code": "visualstudiocode", vscode: "visualstudiocode" };
const technologyIcons = new Map([
  ["typescript", "typescript"], ["javascript", "javascript"], ["python", "python"], ["c", "c"],
  ["react", "react"], ["next.js", "nextdotjs"], ["nextjs", "nextdotjs"], ["tailwind css", "tailwindcss"],
  ["html5", "html5"], ["html", "html5"], ["node.js", "nodedotjs"], ["nodejs", "nodedotjs"], ["express.js", "express"],
  ["express", "express"], ["postgresql", "postgresql"], ["supabase", "supabase"], ["git", "git"],
  ["github", "github"], ["linux", "linux"], ["docker", "docker"],
  ["visual studio code", "visualstudiocode"], ["vscode", "visualstudiocode"]
]);

export function technologyIcon(name) {
  return technologyIcons.get(String(name || "").trim().toLowerCase()) || null;
}

export function icon(name) {
  const namespace = "http://www.w3.org/2000/svg";
  const requested = aliases[name] ?? name;
  if (requested === "visualstudiocode") {
    const image = document.createElement("img");
    image.src = "assets/icons/vscode.svg?v=20261119-1";
    image.className = "i brand-image brand-visualstudiocode";
    image.alt = "";
    image.setAttribute("aria-hidden", "true");
    return image;
  }
  if (brandIcons.has(requested)) {
    const svg = document.createElementNS(namespace, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("class", `i brand-${requested}`);
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    const use = document.createElementNS(namespace, "use");
    use.setAttribute("href", `assets/icons/brands.svg?v=20261119-1#${requested}`);
    svg.append(use);
    return svg;
  }
  const lucideName = Object.hasOwn(lucideIcons, requested) ? requested : "circle-help";
  const svg = document.createElementNS(namespace, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("class", `i lucide-icon lucide-${requested}`);
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  const use = document.createElementNS(namespace, "use");
  use.setAttribute("href", `assets/icons/lucide.svg?v=20261119-2#${lucideName}`);
  svg.append(use);
  return svg;
}
