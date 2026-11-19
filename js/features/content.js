import { renderIdentity } from "./identity.js";
import { renderProjects } from "./projects.js";
import { renderCareer } from "./career.js";
import { renderProfileDetails } from "./profile-details.js";

export function renderContent() {
  renderIdentity();
  renderProjects();
  renderCareer();
  renderProfileDetails();
}
