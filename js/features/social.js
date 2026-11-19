import { SITE } from "../data/site.js";
import { put, externalLink } from "../lib/dom.js";
import { icon } from "../lib/icons.js?v=20261119-2";

export function renderSocialLinks(containerId, includeAll = false) {
  put(containerId, ...SITE.social
    .filter(([name]) => containerId === "f-social"
      ? ["Facebook", "X", "Instagram", "Reddit"].includes(name)
      : includeAll || ["GitHub", "LinkedIn"].includes(name))
    .map(([name, url, glyph]) => {
      const link = externalLink(url, "", "icon-link");
      link.setAttribute("aria-label", name);
      link.append(icon(glyph));
      return link;
    }));
}
