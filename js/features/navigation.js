import { $, el } from "../lib/dom.js";
import { SITE } from "../data/site.js";
import { icon } from "../lib/icons.js?v=20261119-2";

const NAV_ITEMS = [
  { label: "Home", href: "#home" },
  { label: "About", href: "#about" },
  {
    label: "Expertise", sections: ["technical-skills", "tools-technologies"], children: [
      { label: "Technical Skills", href: "#technical-skills" },
      { label: "Tools & Technologies", href: "#tools-technologies" }
    ]
  },
  {
    label: "Work", sections: ["projects", "journey-experience", "github"], children: [
      { label: "Projects", href: "#projects" },
      { label: "Experience", href: "#journey-experience" },
      { label: "GitHub", href: `https://github.com/${encodeURIComponent(SITE.githubUser)}`, external: true }
    ]
  },
  {
    label: "Qualifications", sections: ["journey-education", "certificates"], children: [
      { label: "Education", href: "#journey-education" },
      { label: "Certificates", href: "#certificates" }
    ]
  },
  { label: "Contact", href: "#contact" }
];

function makeAnchor(item) {
  const attrs = { href: item.href, text: item.label };
  if (item.external) {
    attrs.target = "_blank";
    attrs.rel = "noopener noreferrer";
  }
  return el("a", attrs);
}

function createItem(item, index) {
  if (!item.children) return el("li", { class: "nav-item" }, makeAnchor(item));

  const submenuId = `nav-submenu-${index}`;
  const trigger = el("button", {
    class: "nav-dropdown-trigger",
    type: "button",
    "aria-expanded": "false",
    "aria-controls": submenuId,
    text: item.label
  }, el("span", { class: "nav-chevron", "aria-hidden": "true" }, icon("chevron-down")));
  const submenu = el("ul", { class: "submenu", id: submenuId, "aria-label": `${item.label} pages` },
    ...item.children.map((child) => el("li", {}, makeAnchor(child))));
  return el("li", {
    class: "nav-item has-dropdown",
    "data-sections": item.sections.join(" "),
    "data-label": item.label
  }, trigger, submenu);
}

export function initNavigation() {
  const menu = $("menu");
  const button = document.querySelector(".menu-btn");
  const nav = document.querySelector("header.nav");
  const setMenuIcon = (open) => {
    button.replaceChildren(icon(open ? "close" : "menu"));
    button.setAttribute("aria-label", open ? "Close navigation menu" : "Open navigation menu");
  };
  setMenuIcon(false);
  menu.replaceChildren(...NAV_ITEMS.map(createItem));

  const closeDropdown = (item) => {
    item.classList.remove("is-open");
    item.querySelector(":scope > .nav-dropdown-trigger")?.setAttribute("aria-expanded", "false");
  };
  const closeDropdowns = () => menu.querySelectorAll(".has-dropdown.is-open").forEach(closeDropdown);
  const closeMobileMenu = (restoreFocus = false) => {
    menu.classList.remove("open");
    button.setAttribute("aria-expanded", "false");
    setMenuIcon(false);
    if (restoreFocus) button.focus();
  };

  button.addEventListener("click", () => {
    const isOpen = menu.classList.toggle("open");
    button.setAttribute("aria-expanded", String(isOpen));
    setMenuIcon(isOpen);
    if (!isOpen) closeDropdowns();
  });

  menu.addEventListener("click", (event) => {
    const trigger = event.target.closest(".nav-dropdown-trigger");
    if (trigger) {
      const item = trigger.closest(".has-dropdown");
      const shouldOpen = !item.classList.contains("is-open");
      closeDropdowns();
      item.classList.toggle("is-open", shouldOpen);
      trigger.setAttribute("aria-expanded", String(shouldOpen));
      return;
    }
    if (event.target.closest("a")) {
      closeDropdowns();
      closeMobileMenu();
    }
  });

  document.addEventListener("click", (event) => {
    // composedPath() is fixed when the event is dispatched. event.target cannot be used
    // here: the menu button replaces its own icon while handling the click, so the
    // target is already detached from the page by the time the event reaches document.
    if (!event.composedPath().includes(nav)) {
      closeDropdowns();
      if (menu.classList.contains("open")) closeMobileMenu();
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    const openItem = menu.querySelector(".has-dropdown.is-open");
    closeDropdowns();
    if (menu.classList.contains("open")) closeMobileMenu(true);
    else if (openItem) openItem.querySelector(".nav-dropdown-trigger")?.focus();
  });

  const setActiveSection = (sectionId) => {
    menu.querySelectorAll("a[aria-current],button[aria-current]").forEach((link) => link.removeAttribute("aria-current"));
    menu.querySelectorAll(".nav-item.is-current").forEach((item) => item.classList.remove("is-current"));
    const directLink = menu.querySelector(`a[href="#${CSS.escape(sectionId)}"]`);
    if (directLink) {
      directLink.setAttribute("aria-current", "location");
      directLink.closest(".nav-item")?.classList.add("is-current");
    }
    const parent = [...menu.querySelectorAll(".has-dropdown")]
      .find((item) => item.dataset.sections.split(" ").includes(sectionId));
    if (parent) {
      parent.classList.add("is-current");
      parent.querySelector(":scope > .nav-dropdown-trigger")?.setAttribute("aria-current", "location");
      parent.querySelectorAll(`.submenu a[href="#${CSS.escape(sectionId)}"]`).forEach((link) => link.setAttribute("aria-current", "location"));
    }
  };

  const syncActiveHash = () => {
    const sectionId = decodeURIComponent(window.location.hash.slice(1));
    if (sectionId && $(sectionId)) setActiveSection(sectionId);
  };
  window.addEventListener("hashchange", syncActiveHash);
  window.addEventListener("popstate", syncActiveHash);
  syncActiveHash();

  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver((entries) => {
      const current = entries.filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (current) setActiveSection(current.target.id);
    }, { rootMargin: "-34% 0px -52% 0px", threshold: [0, .15, .35, .6] });
    NAV_ITEMS.flatMap((item) => [
      ...(item.href?.startsWith("#") ? [item.href.slice(1)] : []),
      ...(item.sections || []),
      ...(item.children || []).flatMap((child) => child.href?.startsWith("#") ? [child.href.slice(1)] : [])
    ])
      .filter((id, index, all) => all.indexOf(id) === index)
      .forEach((id) => { const section = $(id); if (section) observer.observe(section); });
  }
}
