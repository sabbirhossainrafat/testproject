import { MANUAL_PROJECTS } from "../data/manual-projects.js";
import { $, el, put, externalLink } from "../lib/dom.js";
import { icon, technologyIcon } from "../lib/icons.js?v=20261119-2";
import { scoreProjectSearch } from "../lib/algorithms.js";
import { fetchPublicRepositories, getCachedPublicRepositories, normalizeGitHubRepository } from "../lib/github-api.js";

function projectMedia(project, className = "project-media") {
  const media = el("div", { class: className });
  const preview = project.preview || project.coverImage || project.thumbnail;
  const placeholder = (message) => el("div", {
    class: "project-placeholder",
    role: "img",
    "aria-label": `${project.title}: ${message}`
  }, el("strong", { text: project.title }), el("small", { text: message }));

  if (!preview) {
    media.append(placeholder(project.repoId ? `Repository · ${project.language || "Public source"}` : "Project preview not added yet"));
    return media;
  }

  const fallback = placeholder("Loading screenshot preview");
  const image = el("img", {
    src: preview,
    alt: project.previewAlt || project.coverAlt || `${project.title} project screenshot`,
    loading: className === "case-study-media" ? "eager" : "lazy",
    width: 1280,
    height: 800
  });
  image.onload = () => fallback.remove();
  image.onerror = () => {
    fallback.querySelector("small").textContent = "Real screenshot not added yet";
    fallback.setAttribute("aria-label", `${project.title}: real screenshot not added yet`);
    image.remove();
  };
  media.append(fallback, image);
  return media;
}

function projectActions(project, className = "project-actions") {
  const actions = [];
  if (project.demo && /^https?:\/\//i.test(project.demo)) actions.push(actionLink(project.demo, "Live Demo", "btn primary", "external"));
  else actions.push(el("span", {
    class: "project-status-badge",
    role: "status",
    text: project.private ? "Private project" : "GitHub link",
    "aria-label": project.private ? "This project is private" : "No live demo; a GitHub repository link is provided"
  }));
  if (project.github && /^https:\/\/github\.com\//i.test(project.github)) actions.push(actionLink(project.github, "Source Code", "btn", "github"));
  return el("div", { class: className }, ...actions);
}

function actionLink(href, label, className, iconName) {
  const link = externalLink(href, "", className);
  link.append(icon(iconName), document.createTextNode(label));
  return link;
}

function normalizeProjectUrl(value) {
  const source = String(value || "").trim();
  if (!source) return "";
  try {
    const url = new URL(source);
    if (url.hostname.toLowerCase() === "github.com") return url.pathname.replace(/\/+$/, "").replace(/\.git$/i, "").toLowerCase();
  } catch { /* manual entries can use owner/repository shorthand */ }
  return source.replace(/\/+$/, "").replace(/\.git$/i, "").toLowerCase();
}

function getManualProjects() {
  const seenIds = new Set();
  const seenRepositories = new Set();
  return MANUAL_PROJECTS
    .filter((project) => {
      const id = String(project.id || "").trim();
      const repository = normalizeProjectUrl(project.github || project.repository);
      if (!id || seenIds.has(id) || (repository && seenRepositories.has(repository))) return false;
      seenIds.add(id);
      if (repository) seenRepositories.add(repository);
      return true;
    })
    .map((project) => ({ ...project, id: `manual:${String(project.id).trim()}`, source: "manual", repoId: null }))
    .sort((a, b) => (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER));
}

function formatUpdated(value) {
  if (!value) return "Date unavailable";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Date unavailable" : date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function createProjectCard(project, dialog) {
  const chips = [...new Set([...(project.focus || []), ...(project.technologies || []), ...(project.topics || [])])];
  const badges = [project.private ? "Private" : "", project.status || ""].filter(Boolean);
  const metadata = [];
  if (project.language) { const brand = technologyIcon(project.language); metadata.push(el("span", { class: "project-language" }, ...(brand ? [icon(brand)] : []), el("span", { text: project.language }))); }
  if (project.repoId) metadata.push(el("span", {}, icon("stars"), document.createTextNode(`${Number(project.stargazers_count)} stars`)), el("span", {}, icon("fork"), document.createTextNode(`${Number(project.forks_count)} forks`)), el("span", {}, icon("calendar"), document.createTextNode(`Updated ${formatUpdated(project.updated_at)}`)));
  else if (project.github && !project.private) metadata.push(el("span", { class: "project-metrics-unavailable", role: "status", text: "Repository metrics unavailable" }));
  const tags = el("ul", { class: "project-focus", "aria-label": `${project.title} technologies and topics` }, ...chips.slice(0, 8).map((tag) => {
    const item = el("li", {}); const brand = technologyIcon(tag); if (brand) item.append(icon(brand)); item.append(el("span", { text: tag })); return item;
  }));
  const caseStudyButton = project.caseStudy?.length || project.workflow
    ? el("button", { class: "case-study-trigger", type: "button" }, el("span", { text: "Read case study" }), icon("external")) : null;
  caseStudyButton?.addEventListener("click", () => openCaseStudy(dialog, project));
  const caseStudyLink = project.caseStudyUrl && /^https?:\/\//i.test(project.caseStudyUrl)
    ? actionLink(project.caseStudyUrl, "Case study", "case-study-trigger", "external") : null;
  return el("article", { class: "card project-card" }, projectMedia(project),
    el("div", { class: "project-card-body" },
      el("div", { class: "project-title-row" }, el("div", {},
        el("p", { class: "eyebrow", text: project.category || project.eyebrow || (project.private ? "Private project" : "Public repository") }),
        el("h3", { text: project.title })), ...badges.map((badge) => el("span", { class: "project-status-badge", text: badge }))),
      el("p", { class: "project-summary", text: project.description || "No description provided by this repository." }),
      tags, el("div", { class: "project-meta" }, ...metadata), projectActions(project), caseStudyButton, caseStudyLink));
}

function makeWorkflowShell(title, intro, content) {
  return el("section", { class: "project-workflow", "aria-labelledby": "workflow-title" },
    el("div", { class: "workflow-heading" },
      el("p", { class: "eyebrow", text: "Interactive concept preview" }),
      el("h3", { id: "workflow-title", text: title }),
      el("p", { text: intro })),
    content,
    el("p", { class: "workflow-disclaimer", text: "Local portfolio prototype. No account, server, AI provider, or external project data is used." }));
}

function localAssistantReply(prompt) {
  const normalized = prompt.toLowerCase();
  if (/privacy|security|safe/.test(normalized)) {
    return "A privacy-conscious assistant should request only the access it needs, explain what it will do, and keep sensitive actions under the user's control. This is a fixed sample response.";
  }
  if (/study|plan|learn/.test(normalized)) {
    return "Choose one goal, divide it into a few short steps, and leave time to review what you learned. This is a fixed sample response.";
  }
  return "This Lumex preview demonstrates a conversational interface. Its replies are preset examples; it does not connect to a language model or control a device.";
}

function createLumexWorkflow() {
  const transcript = el("div", {
    class: "chat-transcript", role: "log", "aria-live": "polite",
    "aria-relevant": "additions", "aria-label": "Sample conversation"
  });
  const appendMessage = (speaker, text) => transcript.append(
    el("article", { class: `chat-message ${speaker === "You" ? "is-user" : "is-assistant"}` },
      el("span", { class: "chat-speaker", text: speaker }), el("p", { text })));
  appendMessage("Lumex sample", "Hi. Try a preset prompt or ask a short question. This preview uses local sample replies.");

  const input = el("input", {
    type: "text", name: "sample-prompt", maxlength: "240",
    placeholder: "Try a question…", "aria-label": "Ask the Lumex sample assistant"
  });
  const form = el("form", { class: "chat-composer" }, input,
    el("button", { class: "btn primary", type: "submit", text: "Send" }));
  const sendPrompt = (value) => {
    const prompt = value.trim();
    if (!prompt) { input.focus(); return; }
    appendMessage("You", prompt);
    appendMessage("Lumex sample", localAssistantReply(prompt));
    input.value = "";
    transcript.scrollTop = transcript.scrollHeight;
    input.focus();
  };
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    sendPrompt(input.value);
  });
  const promptList = el("div", { class: "prompt-list", "aria-label": "Preset prompts" },
    ...["How do you approach privacy?", "Help me plan a study session", "What is this preview showing?"].map((prompt) => {
      const button = el("button", { class: "prompt-chip", type: "button", text: prompt });
      button.addEventListener("click", () => sendPrompt(prompt));
      return button;
    }));

  return makeWorkflowShell("Lumex conversation", "Explore a privacy-first interaction pattern with preset, local responses.",
    el("div", { class: "workflow-panel chat-panel" }, transcript, promptList, form));
}

const STREAM_CATALOG = [
  { title: "Orbit of Silence", category: "Sci-Fi", year: "2025", description: "A quiet journey across a changing solar system." },
  { title: "The Last Signal", category: "Sci-Fi", year: "2024", description: "A research crew follows a message from deep space." },
  { title: "Waterline Stories", category: "Documentary", year: "2025", description: "Communities adapt to life beside a shifting coastline." },
  { title: "Small Hours", category: "Drama", year: "2023", description: "Three neighbors find an unexpected common ground." },
  { title: "The Paper City", category: "Drama", year: "2024", description: "A designer returns home to rebuild a family archive." }
];

function createDriftWorkflow() {
  const search = el("input", { type: "search", placeholder: "Search sample titles", "aria-label": "Search the sample streaming catalog" });
  const category = el("select", { "aria-label": "Filter catalog by category" },
    ...["All categories", "Sci-Fi", "Documentary", "Drama"].map((label, index) =>
      el("option", { value: index === 0 ? "all" : label, text: label })));
  const count = el("p", { class: "catalog-status", role: "status", "aria-live": "polite" });
  const list = el("div", { class: "stream-grid" });
  const watchlist = new Set();

  const renderCatalog = () => {
    const query = search.value.trim().toLowerCase();
    const filtered = STREAM_CATALOG.filter((item) =>
      (category.value === "all" || item.category === category.value)
      && `${item.title} ${item.description} ${item.category}`.toLowerCase().includes(query));
    count.textContent = `${filtered.length} sample ${filtered.length === 1 ? "title" : "titles"} · ${watchlist.size} saved`;
    list.replaceChildren(...filtered.map((item) => {
      const saved = watchlist.has(item.title);
      const toggle = el("button", {
        class: `btn watchlist-toggle${saved ? " is-saved" : ""}`,
        type: "button", "aria-pressed": String(saved),
        text: saved ? "Remove from watchlist" : "Add to watchlist"
      });
      toggle.addEventListener("click", () => {
        if (watchlist.has(item.title)) watchlist.delete(item.title);
        else watchlist.add(item.title);
        renderCatalog();
      });
      return el("article", { class: "stream-item" },
        el("div", { class: "stream-art", "aria-hidden": "true" }, el("span", { text: item.category })),
        el("div", { class: "stream-item-copy" },
          el("p", { class: "eyebrow", text: `${item.category} · ${item.year}` }),
          el("h4", { text: item.title }), el("p", { text: item.description }), toggle));
    }));
  };
  search.addEventListener("input", renderCatalog);
  category.addEventListener("change", renderCatalog);
  renderCatalog();

  const controls = el("div", { class: "catalog-controls" }, search, category);
  return makeWorkflowShell("Drift Stream catalog", "Search a sample catalog, filter by category, and add titles to a temporary watchlist.",
    el("div", { class: "workflow-panel" }, controls, count, list));
}

const LIBRARY_CATALOG = [
  { id: "frankenstein", title: "Frankenstein", author: "Mary Shelley", year: "1818" },
  { id: "pride-and-prejudice", title: "Pride and Prejudice", author: "Jane Austen", year: "1813" },
  { id: "sherlock-holmes", title: "The Adventures of Sherlock Holmes", author: "Arthur Conan Doyle", year: "1892" },
  { id: "time-machine", title: "The Time Machine", author: "H. G. Wells", year: "1895" }
];

function createLibraryWorkflow() {
  const search = el("input", { type: "search", placeholder: "Search title or author", "aria-label": "Search the sample book catalog" });
  const status = el("p", { class: "catalog-status", role: "status", "aria-live": "polite" });
  const list = el("div", { class: "book-list" });
  const loans = new Set();

  const renderBooks = () => {
    const query = search.value.trim().toLowerCase();
    const filtered = LIBRARY_CATALOG.filter((book) => `${book.title} ${book.author}`.toLowerCase().includes(query));
    status.textContent = `${filtered.length} sample ${filtered.length === 1 ? "book" : "books"} shown · status updates stay in this preview`;
    list.replaceChildren(...filtered.map((book) => {
      const issued = loans.has(book.id);
      const action = el("button", {
        class: `btn book-action${issued ? " is-issued" : " primary"}`,
        type: "button", text: issued ? "Return book" : "Issue book"
      });
      action.addEventListener("click", () => {
        if (loans.has(book.id)) loans.delete(book.id);
        else loans.add(book.id);
        renderBooks();
      });
      return el("article", { class: "book-row" },
        el("div", { class: "book-cover", "aria-hidden": "true" }, el("span", { text: book.year })),
        el("div", { class: "book-copy" }, el("h4", { text: book.title }),
          el("p", { text: `${book.author} · ${book.year}` })),
        el("div", { class: "book-state" },
          el("span", { class: `status-dot${issued ? " is-issued" : ""}`, "aria-hidden": "true" }),
          el("span", { text: issued ? "On loan · demo" : "Available · demo" }), action));
    }));
  };
  search.addEventListener("input", renderBooks);
  renderBooks();

  return makeWorkflowShell("Library book catalog", "Search sample public-domain titles and try issuing or returning a book.",
    el("div", { class: "workflow-panel" }, search, status, list));
}

function renderWorkflow(project) {
  if (project.workflow === "lumex") return createLumexWorkflow();
  if (project.workflow === "drift-stream") return createDriftWorkflow();
  if (project.workflow === "library") return createLibraryWorkflow();
  return null;
}

function openCaseStudy(dialog, project) {
  $("project-dialog-title").textContent = project.title;
  $("project-dialog-summary").textContent = project.description;
  put("project-dialog-media", projectMedia(project, "case-study-media"));
  put("project-dialog-sections", ...(project.caseStudy || []).map((section) =>
    el("section", { class: "case-study-section" },
      el("h3", { text: section.title }), el("p", { text: section.body }))));
  put("project-workflow", renderWorkflow(project));
  const actions = projectActions(project, "project-dialog-actions");
  put("project-dialog-actions", ...actions.childNodes);
  dialog.showModal();
}

export function renderProjects() {
  const dialog = $("project-dialog");
  const body = $("projects-body");
  const status = el("p", { class: "projects-status", role: "status", "aria-live": "polite" });
  const search = el("input", { type: "search", class: "project-filter-input", placeholder: "Search by name, technology, or description", "aria-label": "Search projects by name, technology, or description" });
  const language = el("select", { class: "project-filter-select", "aria-label": "Filter projects by programming language" }, el("option", { value: "all", text: "All languages" }));
  const technology = el("select", { class: "project-filter-select", "aria-label": "Filter projects by topic or technology" }, el("option", { value: "all", text: "All topics" }));
  const filters = el("div", { class: "project-filters" }, search, language, technology);
  body.classList.add("projects-grid");
  body.before(filters, status);
  let projects = [];
  const renderFiltered = () => {
    const query = search.value.trim().toLowerCase();
    const selectedLanguage = language.value;
    const selectedTechnology = technology.value;
    const visible = projects.map((project, index) => {
      const searchScore = scoreProjectSearch(project, query);
      const matchesLanguage = selectedLanguage === "all" || project.language === selectedLanguage;
      const tags = [...(project.focus || []), ...(project.technologies || []), ...(project.topics || [])].map((tag) => tag.toLowerCase());
      return { project, index, searchScore, matchesLanguage,
        matchesQuery: !query || searchScore >= 0,
        matchesTechnology: selectedTechnology === "all" || tags.includes(selectedTechnology) };
    }).filter((item) => item.matchesQuery && item.matchesLanguage && item.matchesTechnology);
    visible.sort((a, b) => (b.searchScore ?? 0) - (a.searchScore ?? 0) || a.index - b.index);
    status.textContent = `${visible.length} of ${projects.length} selected projects${query ? " · ranked by relevance" : ""}`;
    const cards = visible.map(({ project }) => createProjectCard(project, dialog));
    put("projects-body", ...(cards.length ? cards : [el("p", { class: "projects-empty", text: projects.length ? "No projects match these filters." : "No selected projects are configured yet." })]));
  };
  const updateFilters = () => {
    const languageValue = language.value;
    const technologyValue = technology.value;
    const languages = [...new Set(projects.map((project) => project.language).filter(Boolean))].sort((a, b) => a.localeCompare(b));
    const technologies = [...new Set(projects.flatMap((project) => [...(project.focus || []), ...(project.technologies || []), ...(project.topics || [])]).filter(Boolean))].sort((a, b) => a.localeCompare(b));
    language.hidden = languages.length === 0;
    technology.hidden = technologies.length === 0;
    language.replaceChildren(el("option", { value: "all", text: "All languages" }), ...languages.map((value) => el("option", { value, text: value })));
    technology.replaceChildren(el("option", { value: "all", text: "All topics" }), ...technologies.map((value) => el("option", { value: value.toLowerCase(), text: value })));
    language.value = languages.includes(languageValue) ? languageValue : "all";
    technology.value = technologies.some((value) => value.toLowerCase() === technologyValue) ? technologyValue : "all";
    renderFiltered();
  };
  search.addEventListener("input", renderFiltered);
  language.addEventListener("change", renderFiltered);
  technology.addEventListener("change", renderFiltered);
  projects = getManualProjects();
  updateFilters();
  const refreshRepositoryMetrics = async () => {
    const repositories = await fetchPublicRepositories().then((record) => record.repos).catch(() => getCachedPublicRepositories()?.repos || []);
    if (!repositories.length) return;
    const byPath = new Map(repositories.flatMap((repo) => [[normalizeGitHubRepository(repo.html_url), repo], [normalizeGitHubRepository(repo.full_name), repo]]));
    let changed = false;
    projects = projects.map((project) => {
      const repository = byPath.get(normalizeGitHubRepository(project.github || project.repository));
      if (!repository) return project;
      changed = true;
      return { ...project, repoId: repository.id, language: project.language || repository.language, stargazers_count: repository.stargazers_count, forks_count: repository.forks_count, updated_at: repository.updated_at, topics: [...new Set([...(project.topics || []), ...(repository.topics || [])])] };
    });
    if (changed) updateFilters();
  };
  void refreshRepositoryMetrics();
  document.dispatchEvent(new CustomEvent("portfolio:projects-loaded", { detail: { total: projects.length, source: "manual" } }));
  if (!dialog.dataset.actionsBound) {
    dialog.dataset.actionsBound = "true";
    $("project-dialog-close").addEventListener("click", () => dialog.close());
    dialog.addEventListener("click", (event) => { if (event.target === dialog) dialog.close(); });
  }
}
