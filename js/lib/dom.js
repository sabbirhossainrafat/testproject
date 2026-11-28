export const $ = (id) => document.getElementById(id);
export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === "text") node.textContent = value;
    else if (key === "class") node.className = value;
    else node.setAttribute(key, value);
  }
  node.append(...children.filter(Boolean));
  return node;
}
export const put = (id, ...nodes) => $(id).replaceChildren(...nodes);
export function externalLink(href, label, className = "") {
  return el("a", { href, target: "_blank", rel: "noopener noreferrer", class: className }, label);
}
