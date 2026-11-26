let tabId;
let original = [];
let suggestions = [];
let activeFilter = 'all';

const $ = selector => document.querySelector(selector);

function send(message) {
  return new Promise(resolve => {
    chrome.tabs.sendMessage(tabId, message, response => {
      if (chrome.runtime.lastError) resolve({ error: chrome.runtime.lastError.message });
      else resolve(response);
    });
  });
}

function ask(message) {
  return new Promise(resolve => chrome.runtime.sendMessage(message, resolve));
}

async function ensureContentScript() {
  const ping = await send({ type: 'ping' });
  if (ping?.ok) return true;
  try {
    await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
    const again = await send({ type: 'ping' });
    return !!again?.ok;
  } catch (error) {
    status(`Cannot access this page: ${error.message || error}. Try a normal http(s) form tab.`);
    return false;
  }
}

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

function status(message) {
  $('#message').textContent = message;
  $('#message').hidden = !message;
}

function fieldBucket(item) {
  if (item.kind === 'open_ended') return 'open';
  if (item.mapped_field && item.value) return 'matched';
  if (item.mapped_field) return 'matched';
  return 'none';
}

function passesFilter(item) {
  if (activeFilter === 'all') return true;
  return fieldBucket(item) === activeFilter;
}

async function init() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  tabId = tab.id;
  $('#status').textContent = 'Connecting… (the free server can take up to a minute to wake up)';
  $('#status').hidden = false;
  const health = await ask({ type: 'health' });
  if (health?.status !== 'ok') {
    $('#status').textContent = 'Cannot reach the AutoForm server. Check your connection and try again.';
    $('#scan').hidden = false;
    return;
  }
  $('#status').hidden = true;
  await scanForm(false);
}

async function scanForm(showProgress = true) {
  if (showProgress) status('Scanning page...');
  try {
    const ready = await ensureContentScript();
    if (!ready) { $('#scan').hidden = false; return; }
    const scan = await send({ type: 'scan' });
    if (scan?.error && !scan.fields) { status(`Scan error: ${scan.error}`); $('#scan').hidden = false; return; }
    const fields = scan?.fields || [];
    if (scan?.error) status(`Scan warning: ${scan.error}`);
    if (!fields.length) {
      status('No fillable fields found. Open the actual form page (not chrome://), then scan again.');
      $('#scan').hidden = false;
      return;
    }
    const data = await ask({ type: 'classify', fields });
    if (data.error) { status(data.error); $('#scan').hidden = false; return; }
    original = fields;
    suggestions = data.fields.map(item => ({ ...item, approved: !!item.value, answer_length: 'standard' }));
    const matched = suggestions.filter(item => item.mapped_field).length;
    const filled = suggestions.filter(item => item.value).length;
    const open = suggestions.filter(item => item.kind === 'open_ended').length;
    const unmatched = suggestions.filter(item => !item.mapped_field && item.kind !== 'open_ended').length;
    $('#summary').textContent = `${fields.length} write-in fields · ${matched} mapped · ${filled} with values · ${open} written answers · ${unmatched} unmatched`;
    $('#summary').hidden = false;
    activeFilter = 'all';
    document.querySelectorAll('.filter').forEach(node => node.classList.toggle('active', node.dataset.filter === 'all'));
    render();
    if (!scan?.error) status('Review each match, then approve before filling.');
  } catch (error) {
    status(`Could not read this page. Reload the tab and try again. (${error.message || error})`);
    $('#scan').hidden = false;
  }
}

$('#scan').onclick = () => scanForm(true);
$('#dashboard').onclick = async () => {
  const result = await ask({ type: 'open-dashboard' });
  if (result?.error) status(`Could not open the profile: ${result.error}`);
  else window.close();
};

document.querySelectorAll('.filter').forEach(button => {
  button.onclick = () => {
    activeFilter = button.dataset.filter;
    document.querySelectorAll('.filter').forEach(node => node.classList.toggle('active', node === button));
    render();
  };
});

function render() {
  $('#review').hidden = false;
  const visible = suggestions
    .map((item, index) => ({ item, index, field: original[index] || {} }))
    .filter(entry => passesFilter(entry.item));

  if (!visible.length) {
    $('#items').innerHTML = '<p class="empty-filter">No fields in this filter.</p>';
    return;
  }

  let lastSection = null;
  $('#items').innerHTML = visible.map(({ item, index, field }) => {
    const label = item.detected_label || field.label || field.name || field.id_attribute || 'Unlabelled field';
    const openEnded = item.kind === 'open_ended';
    const confidence = Math.round((item.confidence || 0) * 100);
    const section = field.section || 'Other fields';
    const type = field.type || field.tag || 'text';
    const identity = [field.name, field.id_attribute].filter(Boolean).join(' · ');
    const state = openEnded
      ? (item.value ? 'Draft ready - review it' : 'No draft yet')
      : item.value ? 'Suggested value' : (item.mapped_field ? 'Mapped - enter value' : 'Fill in manually');

    const badge = openEnded
      ? '<small class="tag open">Written answer</small>'
      : item.mapped_field
        ? `<small class="tag ok">${esc(item.mapped_field)}</small><small class="muted">${confidence}% ${esc(item.source || '')}</small>`
        : '<small class="tag warn">No match</small>';

    const editor = openEnded
      ? `<textarea data-value="${index}" rows="5" placeholder="Generate a draft, or write your own answer">${esc(item.value)}</textarea>`
      : `<input data-value="${index}" value="${esc(item.value)}" placeholder="Enter value manually">`;

    const lengthControl = openEnded ? `
      <label class="answer-length-label">Answer length
        <select data-length="${index}">
          <option value="concise" ${item.answer_length === 'concise' ? 'selected' : ''}>Concise</option>
          <option value="standard" ${item.answer_length !== 'concise' && item.answer_length !== 'detailed' ? 'selected' : ''}>Standard</option>
          <option value="detailed" ${item.answer_length === 'detailed' ? 'selected' : ''}>Detailed</option>
        </select>
      </label>` : '';

    const generate = openEnded
      ? `${lengthControl}<button type="button" class="generate" data-generate="${index}">Generate answer</button>`
      : '';

    const question = openEnded && item.question
      ? `<small class="question">${esc(item.question)}</small>` : '';

    const sources = item.sources?.length ? `<small class="sources">Evidence used: ${esc(item.sources.join(', '))}</small>` : '';
    const checks = openEnded && item.validation_message
      ? `<small class="${item.valid ? 'validation-ok' : 'validation-warn'}">${esc(item.validation_message)}</small>` : '';

    const sectionHeader = section !== lastSection
      ? `<div class="section-group">${esc(section)}</div>`
      : '';
    lastSection = section;

    return `${sectionHeader}<article data-bucket="${fieldBucket(item)}">
      <label class="head"><input type="checkbox" data-on="${index}" ${item.approved ? 'checked' : ''}> <strong>${esc(label)}</strong></label>
      <div class="meta">
        <small class="signal">${esc(type)} · ${esc(state)}</small>
        ${badge}
      </div>
      ${identity ? `<small class="muted">${esc(identity)}</small>` : ''}
      ${question}
      ${generate}
      ${editor}
      ${sources}
      ${checks}
    </article>`;
  }).join('');

  $('#items').querySelectorAll('[data-on]').forEach(node => {
    node.onchange = async () => {
      suggestions[node.dataset.on].approved = node.checked;
      const item = suggestions[node.dataset.on];
      if (node.checked && item.kind === 'open_ended' && item.value) {
        const saved = await ask({ type: 'save-answer', question: item.question, answer: item.value });
        if (saved?.saved) status('Approved answer saved and will be reused for similar questions.');
      }
    };
  });
  $('#items').querySelectorAll('[data-length]').forEach(node => {
    node.onchange = () => { suggestions[node.dataset.length].answer_length = node.value; };
  });
  $('#items').querySelectorAll('[data-value]').forEach(node => {
    node.oninput = () => {
      const item = suggestions[node.dataset.value];
      item.value = node.value;
      delete item.valid;
      delete item.validation_message;
    };
  });
  $('#items').querySelectorAll('[data-generate]').forEach(button => {
    button.onclick = () => generateAnswer(Number(button.dataset.generate), button);
  });
}

async function generateAnswer(index, button) {
  const item = suggestions[index];
  const question = item.question || (original[index] || {}).label;
  if (!question) { status('This field has no question to answer.'); return; }
  const label = button.textContent;
  button.disabled = true;
  button.textContent = 'Generating…';
  status('Drafting a first-person answer from your profile, experience and CV…');
  const data = await ask({ type: 'generate', question, length: item.answer_length || 'standard' });
  if (data?.error) {
    button.disabled = false;
    button.textContent = 'Try again';
    status(data.error);
    return;
  }
  item.value = data.answer || '';
  item.sources = data.sources || [];
  item.valid = data.valid;
  item.validation_message = data.validation_message;
  item.relevance = data.relevance;
  item.first_person = data.first_person;
  render();
  status(data.first_person === false
    ? 'Draft generated. It was not in the first person - rewrite it before approving.'
    : 'Draft ready. Review it, then approve it before filling.');
  void label;
}

$('#generate-all').onclick = async () => {
  const pending = suggestions.map((item, index) => ({ item, index })).filter(entry => entry.item.kind === 'open_ended' && !entry.item.value);
  if (!pending.length) { status('All open-ended fields already have a draft.'); return; }
  for (const { index } of pending) {
    const button = $(`[data-generate="${index}"]`);
    if (button) await generateAnswer(index, button);
  }
};

$('#fill').onclick = async () => {
  const items = suggestions.filter(item => item.approved && item.value);
  const result = await send({ type: 'fill', items });
  const failed = result?.failed?.length ? ` ${result.failed.length} could not be matched to an option.` : '';
  status(`Filled ${result?.filled || 0} approved field(s).${failed} You must submit the form yourself.`);
};

init();
