import { renderContent } from "./features/content.js";
import { initNavigation } from "./features/navigation.js";
import { initGitHub } from "./features/github.js";
import { initContact } from "./features/contact.js";
import { initActivityTrends } from "./features/activity-trends.js";
import { icon } from "./lib/icons.js?v=20261119-2";

document.querySelectorAll("[data-icon]").forEach((slot) => slot.replaceChildren(icon(slot.dataset.icon)));
renderContent();
initNavigation();
initContact();
initGitHub();
initActivityTrends();
