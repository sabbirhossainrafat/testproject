import { SITE } from "../data/site.js";
import { $ } from "../lib/dom.js";

const rules = {
  name: (value) => value.trim().length >= 2 || "Enter at least 2 characters.",
  email: (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) || "Enter a valid email address.",
  subject: (value) => value.trim().length >= 3 || "Enter at least 3 characters.",
  message: (value) => value.trim().length >= 10 || "Write at least 10 characters."
};

export function initContact() {
  const form = $("contact-form");
  const status = $("form-status");
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    status.textContent = "";
    let valid = true;
    for (const [name, validate] of Object.entries(rules)) {
      const input = form.elements.namedItem(name);
      const message = validate(input.value);
      const error = form.querySelector(`[data-for="${name}"]`);
      error.textContent = message === true ? "" : message;
      input.setAttribute("aria-invalid", String(message !== true));
      if (message !== true) valid = false;
    }
    if (!valid) { form.querySelector('[aria-invalid="true"]')?.focus(); return; }
    if (form.elements.botcheck.value) return;
    if (!SITE.web3formsKey) { status.textContent = `The contact form is not configured yet. Email ${SITE.email} directly.`; return; }
    const button = form.querySelector('[type="submit"]');
    button.disabled = true;
    status.textContent = "Sending your message…";
    try {
      const response = await fetch("https://api.web3forms.com/submit", {
        method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ access_key: SITE.web3formsKey, name: form.elements.name.value.trim(), email: form.elements.email.value.trim(), subject: form.elements.subject.value.trim(), message: form.elements.message.value.trim(), botcheck: "" })
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error("Send failed");
      status.textContent = "Message sent. I will reply by email.";
      form.reset();
      form.querySelectorAll('[aria-invalid="true"]').forEach((input) => input.removeAttribute("aria-invalid"));
    } catch {
      status.textContent = `Message could not be sent. Please try again or email ${SITE.email}.`;
    } finally { button.disabled = false; }
  });
}
