/* Feedback: report a bug or suggest a feature. Builds a clear GitHub issue
   (with the app, version and browser filled in) and opens it for you to
   submit. Vote on the roadmap with 👍 reactions on GitHub. */

import { h } from '../util.js';
import { header, picker, textbox, button, appbar, pageRouter, screenOf } from '../controls.js';
import { sortedApps } from '../registry.js';
import { latestRelease } from '../content.js';
import { REPO_URL, issueUrl } from '../config.js';

export default function mount(ctx) {
  const { el, go } = ctx;

  function form(kind = 'bug') {
    const d = { kind, app: 'hub', title: '', what: '', steps: '', expected: '' };
    const kindText = { bug: 'Something’s wrong', idea: 'An idea', question: 'A question' };
    const fields = h('div');
    const paintFields = () => fields.replaceChildren(
      textbox({ label: 'Short title', placeholder: d.kind === 'bug' ? 'e.g. Bloom closes when I scroll' : 'e.g. Let me group tiles into folders', onInput: (v) => { d.title = v; } }),
      textbox({ label: d.kind === 'bug' ? 'What happened?' : 'Tell us more', multiline: true, onInput: (v) => { d.what = v; } }),
      d.kind === 'bug' ? textbox({ label: 'Steps to see it (optional)', multiline: true, placeholder: '1. Hold the Music tile\n2. …', onInput: (v) => { d.steps = v; } }) : null,
      d.kind === 'bug' ? textbox({ label: 'What did you expect?', onInput: (v) => { d.expected = v; } }) : null);
    paintFields();
    const submit = () => {
      if (!d.title.trim()) return ctx.toast('Add a short title first.');
      const app = sortedApps().find((a) => a.id === d.app);
      const rel = latestRelease();
      const body = [
        d.what && `### ${d.kind === 'bug' ? 'What happened' : 'Details'}\n${d.what}`,
        d.steps && `### Steps\n${d.steps}`,
        d.expected && `### Expected\n${d.expected}`,
        '---',
        `App: ${app?.name || 'Metro OS'} · Metro OS ${rel?.version || ''}`,
        `Browser: ${navigator.userAgent}`
      ].filter(Boolean).join('\n\n');
      const url = `${issueUrl(`${app?.name || 'Metro OS'}: ${d.title.trim()}`, d.kind === 'bug' ? 'bug' : d.kind === 'idea' ? 'enhancement' : 'question')}&body=${encodeURIComponent(body)}`;
      window.open(url, '_blank', 'noopener');
      ctx.toast('Opened on GitHub. Check it over and submit it there.');
    };
    const page = h('div', { class: 'page has-appbar' },
      header('Feedback', kindText[d.kind].toLowerCase()),
      picker({ label: 'Kind', value: d.kind, options: Object.entries(kindText).map(([value, label]) => ({ value, label })), onChange: (v) => { d.kind = v; paintFields(); } }),
      picker({ label: 'App', value: d.app, options: sortedApps().map((a) => ({ value: a.id, label: a.name })), full: true, host: el, onChange: (v) => { d.app = v; } }),
      fields,
      h('p', { class: 'hint' }, 'This opens a new issue on GitHub with everything filled in. You’ll need a GitHub account to submit it. Nothing is sent until you do.'),
      h('div', { class: 'btn-row' }, button('open on GitHub', submit, { accent: true, icon: 'fa-brands fa-github' })));
    return screenOf(page, appbar({
      buttons: [
        { icon: 'fa-solid fa-square-poll-vertical', label: 'vote', onClick: () => go('#/app/feedback/vote') },
        { icon: 'fa-solid fa-road', label: 'roadmap', onClick: () => go('#/app/hub/roadmap') }
      ],
      menu: [{ label: 'about Feedback', onClick: () => go('#/info/feedback') }]
    }));
  }

  function vote() {
    return screenOf(h('div', { class: 'page' },
      header('Feedback', 'vote'),
      h('p', { class: 'lede' }, 'Ideas are ranked by 👍 reactions on GitHub. Add yours to the ones you want most.'),
      h('div', { class: 'btn-row' },
        button('most wanted ideas', () => window.open(`${REPO_URL}/issues?q=is%3Aissue+is%3Aopen+label%3Aenhancement+sort%3Areactions-%2B1-desc`, '_blank', 'noopener'), { accent: true, icon: 'fa-solid fa-thumbs-up' }),
        button('all open issues', () => window.open(`${REPO_URL}/issues`, '_blank', 'noopener'))),
      h('p', { class: 'hint' }, 'The roadmap in the Metro OS app is updated from what gets the most votes.')));
  }

  const route = pageRouter(el, (sub) => (sub[0] === 'vote' ? vote() : form(sub[0] === 'idea' ? 'idea' : sub[0] === 'question' ? 'question' : 'bug')));
  return { route(sub, opts) { route(sub.length ? sub : ['bug'], opts); } };
}
