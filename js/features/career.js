import { SITE } from "../data/site.js";
import { $, el, put, externalLink } from "../lib/dom.js";
import { icon } from "../lib/icons.js?v=20261119-2";

function makeJourneyEntry({ id, type, title, subtitle, metadata, highlights = [], note }) {
  const meta = el("dl", { class: "journey-meta" }, ...metadata.flatMap(([term, value]) => [
    el("div", { class: "journey-meta-item" }, el("dt", { text: term }), el("dd", { text: value }))
  ]));
  const entry = el("article", { class: `journey-entry journey-entry--${type}`, id },
    el("div", { class: "journey-marker", "aria-hidden": "true" }, icon(type === "education" ? "academic" : "briefcase")),
    el("div", { class: "journey-entry-main" },
      el("p", { class: "eyebrow", text: type === "education" ? "Education" : "Experience" }),
      el("h3", { text: title }),
      el("p", { class: "journey-subtitle", text: subtitle }),
      meta,
      ...highlights.map(([label, value]) => el("p", { class: "journey-highlight" },
        el("span", { text: label }), el("strong", { text: value }))),
      note ? el("details", { class: "journey-note" },
        el("summary", { text: "Internship completion note" }), el("p", { text: note })) : null));
  return entry;
}

function renderJourney() {
  const education = SITE.education;
  const experience = SITE.experience;
  put("journey-body",
    makeJourneyEntry({
      id: "journey-education",
      type: "education",
      title: education.institution,
      subtitle: education.degree,
      metadata: [
        ["Current semester", education.semester],
        ["Expected graduation", education.graduation],
        ["CGPA", education.cgpa]
      ],
      highlights: [
        ["Academic interests", education.interests.join(" · ")],
        ["Career goal", education.goal]
      ]
    }),
    makeJourneyEntry({
      id: "journey-experience",
      type: "experience",
      title: experience.org,
      subtitle: experience.position,
      metadata: [
        ["Field", experience.field],
        ["Duration", experience.duration],
        ["Certificate issued", experience.issued],
        ["Performance", experience.performance],
        ["Attendance", experience.attendance]
      ],
      highlights: [["Completion", experience.completion]],
      note: experience.certificateText
    })
  );
}

function certificateDetails(certificate) {
  return [
    ["Organization", certificate.org],
    certificate.recipient && ["Recipient", certificate.recipient],
    ["Issued", certificate.issued],
    certificate.workshopDate && ["Workshop date", certificate.workshopDate],
    certificate.id && ["Certificate ID", certificate.id],
    certificate.founder && ["Founder and CEO", certificate.founder],
    certificate.verification && ["Verification", certificate.verification]
  ].filter(Boolean);
}

function openCertificate(certificate, dialog) {
  $("cert-title").textContent = certificate.name;
  $("cert-preview-issuer").textContent = certificate.org;
  $("cert-preview-copy").textContent = certificate.link
    ? `Issued ${certificate.issued}. Open the original certificate using the secure link below.`
    : `Issued ${certificate.issued}. A certificate link or preview was not provided.`;
  put("cert-meta", ...certificateDetails(certificate).flatMap(([term, value]) => [
    el("dt", { text: term }), el("dd", { text: value })
  ]));
  const actions = certificate.link
    ? [externalLink(certificate.link, "", "btn primary")]
    : [];
  if (actions.length) actions[0].append(el("span", { text: "View certificate" }), icon("external"));
  put("cert-dialog-actions", ...actions);
  dialog.showModal();
}

function renderCertificates() {
  const dialog = $("cert-dialog");
  const cards = SITE.certificates.map((certificate) => {
    const actions = [];
    if (certificate.link) {
      const link = externalLink(certificate.link, "", "credential-view-link");
      link.append(el("span", { text: "View certificate" }), icon("external"));
      actions.push(link);
    }
    const details = el("button", { class: "text-button credential-details-button", type: "button" },
      el("span", { text: "Credential details" }), icon("arrow-right"));
    details.addEventListener("click", () => openCertificate(certificate, dialog));
    actions.push(details);

    return el("article", { class: "credential-card" },
      el("div", { class: "credential-card-top" },
        el("span", { class: "credential-mark", "aria-hidden": "true" }, icon("award")),
        el("p", { class: "eyebrow", text: certificate.org })),
      el("h3", { text: certificate.name }),
      el("p", { class: "credential-date", text: `Issued ${certificate.issued}` }),
      certificate.id ? el("p", { class: "credential-id" }, el("span", { text: "Certificate ID" }), el("strong", { text: certificate.id })) : null,
      el("div", { class: "credential-actions" }, ...actions));
  });
  put("cert-body", ...cards);
  $("cert-close").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
}

export function renderCareer() {
  renderJourney();
  renderCertificates();
}
