import { SITE } from "../data/site.js";
import { $, el, put, externalLink } from "../lib/dom.js";
import { icon } from "../lib/icons.js?v=20261119-2";

function renderPersonalInterests() {
  put("lang-body", ...SITE.languages.map(([language, level]) =>
    el("li", {}, el("span", { class: "language-name", text: language }), el("span", { class: "language-level", text: level }))));

  const categories = [
    { id: "ai", label: "AI & Intelligent Systems", interests: ["Artificial Intelligence", "Machine Learning", "Intelligent AI Assistants"] },
    { id: "security", label: "Technology & Security", interests: ["Cybersecurity", "Software Development", "Building Original and Meaningful Technology"] },
    { id: "creative", label: "Creative Thinking", interests: ["Visual Storytelling", "Cinematic Aesthetics", "Creative Writing", "Human Behavior and Perception"] }
  ];
  const tabs = $("interest-tabs");
  const panel = $("int-body");
  let categoryTimer = 0;
  const buttons = categories.map((category, index) => el("button", {
    id: `interest-tab-${category.id}`, type: "button", role: "tab",
    "aria-selected": String(index === 0), "aria-controls": "int-body",
    tabindex: index === 0 ? "0" : "-1", text: category.label
  }));
  const selectCategory = (index, moveFocus = false) => {
    const category = categories[index];
    buttons.forEach((button, buttonIndex) => {
      const active = buttonIndex === index;
      button.setAttribute("aria-selected", String(active));
      button.tabIndex = active ? 0 : -1;
    });
    panel.setAttribute("aria-labelledby", buttons[index].id);
    panel.classList.add("is-changing");
    window.clearTimeout(categoryTimer);
    categoryTimer = window.setTimeout(() => {
      put("int-body", ...SITE.interests.filter((interest) => category.interests.includes(interest)).map((interest) =>
        el("li", { class: "interest-item" }, el("span", { class: "interest-marker", "aria-hidden": "true" }), el("span", { text: interest }))));
      panel.setAttribute("aria-labelledby", buttons[index].id);
      panel.classList.remove("is-changing");
      if (moveFocus) buttons[index].focus();
    }, 100);
  };
  buttons.forEach((button, index) => {
    button.addEventListener("click", () => selectCategory(index));
    button.addEventListener("keydown", (event) => {
      let next = index;
      if (event.key === "ArrowRight" || event.key === "ArrowDown") next = (index + 1) % buttons.length;
      else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = (index - 1 + buttons.length) % buttons.length;
      else if (event.key === "Home") next = 0;
      else if (event.key === "End") next = buttons.length - 1;
      else return;
      event.preventDefault();
      selectCategory(next, true);
    });
  });
  put("interest-tabs", ...buttons);
  selectCategory(0);

  const hobbyIcons = { "Reading novels and books": "book-open", "Playing video games": "gamepad-2" };
  put("hob-body", ...SITE.hobbies.map((hobby) => el("article", { class: "hobby-item" },
    el("span", { class: "hobby-icon", "aria-hidden": "true" }, icon(hobbyIcons[hobby] || "activity")),
    el("span", { text: hobby }))));
  $("ambition-body").textContent = "Become an AI Security Specialist and build intelligent systems such as Lumex.";
  initBeyondReveal();
}

function initBeyondReveal() {
  const elements = document.querySelectorAll("#more .more-panel, #more .ambition-card");
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) {
    elements.forEach((element) => element.classList.add("is-visible"));
    return;
  }
  const observer = new IntersectionObserver((entries) => entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    entry.target.classList.add("is-visible");
    observer.unobserve(entry.target);
  }), { threshold: 0.12, rootMargin: "0px 0px -5% 0px" });
  elements.forEach((element, index) => {
    element.classList.add("beyond-reveal");
    element.style.setProperty("--beyond-delay", `${Math.min(index * 70, 210)}ms`);
    observer.observe(element);
  });
}

function renderPersonalAssets() {
  const link = externalLink(SITE.cv, "", "btn primary");
  link.append(el("span", { text: "View CV" }), icon("external"));
  put("assets-body", link);
}

function renderContactDetails() {
  const whatsApp = `https://wa.me/${SITE.whatsapp.replace(/\D/g, "")}`;
  const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(SITE.location)}`;
  $("contact-photo").src = SITE.photo;
  const contactLink = (href, glyph, label, newTab = true) => {
    const link = el("a", { href, class: "contact-detail-link", ...(newTab ? { target: "_blank", rel: "noopener noreferrer" } : {}) },
      el("span", { class: "contact-detail-icon", "aria-hidden": "true" }, icon(glyph)),
      el("span", { class: "contact-detail-value", text: label }));
    return el("li", {}, link);
  };
  put("contact-details",
    contactLink(mapUrl, "location", SITE.location),
    contactLink(whatsApp, "whatsapp", SITE.whatsapp),
    contactLink(`mailto:${SITE.email}`, "gmail", SITE.email, false));
  const telegram = SITE.social.find(([name]) => name === "Telegram")?.[1];
  const telegramButton = telegram && externalLink(telegram, "Telegram", "btn");
  telegramButton?.prepend(icon("telegram"));
  put("contact-actions", ...(telegramButton ? [telegramButton] : []));
}

export function renderProfileDetails() {
  renderPersonalInterests();
  renderPersonalAssets();
  renderContactDetails();
  $("copy").textContent = `© ${new Date().getFullYear()} ${SITE.name}. All rights reserved.`;
}
