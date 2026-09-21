/* Site-wide links. Change these in one place. */
export const REPO = 'Cyanexani/jaibalayya';
export const REPO_URL = `https://github.com/${REPO}`;
export const issueUrl = (title = '', label = 'feedback') =>
  `${REPO_URL}/issues/new?title=${encodeURIComponent(title)}&labels=${encodeURIComponent(label)}`;
