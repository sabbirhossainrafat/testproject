import { SITE } from "../data/site.js";
import { $, el, put } from "../lib/dom.js";
import { icon, technologyIcon } from "../lib/icons.js?v=20261119-2";
import { renderSocialLinks } from "./social.js";

function makeAboutCard(fact, index) {
  const classes = `about-card about-reveal${fact.interactive ? " about-card--interactive" : ""}`;
  const card = fact.map
    ? el("a", { class: classes, href: fact.map, target: "_blank", rel: "noopener noreferrer", "aria-label": `Open ${fact.value} in Google Maps` })
    : el("article", { class: classes });
  card.style.setProperty("--reveal-delay", `${Math.min(index * 55, 220)}ms`);
  const content = el("span", { class: "about-card-content" },
    el("span", { class: "about-card-label", text: fact.label }),
    fact.map
      ? el("span", { class: "about-card-value", text: fact.value })
      : fact.href
        ? el("a", { class: "about-card-value", href: fact.href, ...(fact.external ? { target: "_blank", rel: "noopener noreferrer" } : {}), text: fact.value })
        : el("span", { class: "about-card-value", text: fact.value }));
  card.append(el("span", { class: "about-card-icon", "aria-hidden": "true" }, icon(fact.icon)), content);

  return card;
}

function initAboutReveal() {
  const elements = document.querySelectorAll("#about .about-heading, #about .about-lede, #about .about-column, #about .about-card");
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) {
    elements.forEach((element) => element.classList.add("is-visible"));
    return;
  }
  const observer = new IntersectionObserver((entries) => entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    entry.target.classList.add("is-visible");
    observer.unobserve(entry.target);
  }), { threshold: 0.12, rootMargin: "0px 0px -4% 0px" });
  elements.forEach((element) => observer.observe(element));
}

function renderAboutSection() {
  const paragraphs = Array.isArray(SITE.about) ? SITE.about : [];
  $("about-lede").textContent = paragraphs[0] || "";
  put("about-left",
    ...[paragraphs[1], paragraphs[3]].filter(Boolean).map((text) => el("p", { text })));
  put("about-right", ...(paragraphs[2] ? [el("p", { text: paragraphs[2] })] : []));

  const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(SITE.location)}`;
  const facts = [
    { label: "Date of birth", value: SITE.dateOfBirth, icon: "calendar" },
    { label: "Academic title", value: SITE.academicTitle, icon: "academic" },
    { label: "Current location", value: SITE.location, icon: "location", map: mapUrl, interactive: true }
  ];
  put("personal-facts", ...facts.map(makeAboutCard));
  initAboutReveal();
}

export function renderIdentity() {
  $("h-role").textContent = SITE.title;
  $("h-spec").textContent = SITE.specialization;
  $("h-intro").textContent = SITE.intro;

  const portrait = el("img", {
    src: SITE.photo,
    alt: `Portrait of ${SITE.name}`,
    width: 720,
    height: 960,
    fetchpriority: "high"
  });
  portrait.onerror = () => portrait.remove();
  document.querySelector(".portrait").append(portrait);

  renderSocialLinks("h-social");
  renderSocialLinks("f-social", true);

  const stats = [];
  const skillGroups = Object.values(SITE.skills || {});
  if (skillGroups.length && skillGroups.every(Array.isArray)) {
    stats.push([String(skillGroups.reduce((total, group) => total + group.length, 0)), "Skills"]);
  }
  if (Array.isArray(SITE.certificates)) stats.push([String(SITE.certificates.length), "Certificates"]);
  $("hero-stats").hidden = stats.length === 0;
  const renderStats = (projectsCount = null) => {
    const values = [...stats];
    if (Number.isInteger(projectsCount)) values.unshift([String(projectsCount), "Projects"]);
    $("hero-stats").hidden = values.length === 0;
    put("hero-stats", ...values.map(([value, label]) =>
      el("div", { class: "hero-stat" }, el("strong", { text: value }), el("span", { text: label }))));
  };
  renderStats();
  document.addEventListener("portfolio:projects-loaded", (event) => renderStats(event.detail?.total));

  renderAboutSection();

  const groupIcons = {
    "Programming Languages": "terminal",
    "Frontend Development": "layout-panels",
    "Backend and Database": "database",
    "Developer Tools": "wrench"
  };
  const skillGroup = ([group, skills]) =>
    el("article", { class: "skill-group" },
      el("h3", {}, icon(groupIcons[group] || "layers"), el("span", { text: group })),
      el("ul", {}, ...skills.map((skill) => {
        const brand = technologyIcon(skill);
        const item = el("li", {}, ...(brand ? [icon(brand)] : []), el("span", { text: skill }));
        item.classList.add("skill-item");
        return item;
      })));
  const groups = Object.entries(SITE.skills);
  put("technical-skills-body", ...groups.filter(([group]) => group !== "Developer Tools").map(skillGroup));
  put("tools-technologies-body", ...groups.filter(([group]) => group === "Developer Tools").map(skillGroup));
}
