(() => {
  'use strict';

  // Write-in fields only. Choice widgets (checkbox / radio / listbox) are never scanned.
  const INTERACTIVE = [
    'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]):not([type="image"]):not([type="file"]):not([type="password"]):not([type="checkbox"]):not([type="radio"]):not([type="search"]):not([type="range"]):not([type="color"])',
    'textarea',
    'select',
    '[contenteditable=""]',
    '[contenteditable="true"]',
    '[contenteditable="plaintext-only"]',
    '[role="textbox"]',
    '[role="combobox"]',
    '[role="spinbutton"]'
  ].join(',');

  const ROW = [
    'tr', 'li', 'dd',
    '[role="listitem"]',
    '.form-group', '.form_group', '.form-field', '.form-item', '.field', '.input-group', '.form-row',
    '[class*="form-group"]', '[class*="form-field"]', '[class*="form-item"]',
    '[class*="FormField"]', '[class*="formField"]', '[class*="Question"]',
    '[data-field]', '[data-qa]', '[data-params]'
  ].join(',');

  const HEADINGS = 'h1,h2,h3,h4,h5,h6,legend,caption,summary,[role="heading"]';
  const LABEL_LIKE = 'label,.control-label,.MuiFormLabel-root,.MuiInputLabel-root,[data-label],[class*="Label"],[class*="label"]';
  const ARIA_CHOICE = el => ['checkbox', 'radio', 'switch'].includes(attr(el, 'role'));
  const EDITABLE_STANDALONE = el => el.hasAttribute('contenteditable') || ['textbox', 'searchbox', 'combobox', 'spinbutton'].includes(attr(el, 'role'));
  const isChoiceControl = el => {
    const type = (el.type || attr(el, 'type') || '').toLowerCase();
    if (type === 'checkbox' || type === 'radio') return true;
    return ARIA_CHOICE(el);
  };

  const clean = value => String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
  const cap = (value, max) => (value || '').slice(0, max);
  const attr = (el, name) => {
    try { return (el.getAttribute && el.getAttribute(name) || '').trim(); } catch { return ''; }
  };
  const text = node => {
    try {
      if (!node) return '';
      const raw = node.innerText != null && node.innerText !== '' ? node.innerText : node.textContent;
      return clean(raw);
    } catch { return ''; }
  };
  const tag = el => ((el && el.tagName) || '').toUpperCase();
  const docOf = el => (el && el.ownerDocument) || document;
  const safeMatches = (el, selector) => {
    try { return !!(el && el.matches && el.matches(selector)); } catch { return false; }
  };

  function isFormControl(el) {
    const type = (el.type || '').toLowerCase();
    if (tag(el) === 'INPUT' || tag(el) === 'TEXTAREA' || tag(el) === 'SELECT') return true;
    if (EDITABLE_STANDALONE(el) || ARIA_CHOICE(el) || attr(el, 'role') === 'listbox') return true;
    if (type && type !== 'hidden') return true;
    return false;
  }

  function isDisabled(el) {
    try {
      if (el.disabled) return true;
      if (attr(el, 'aria-disabled') === 'true') return true;
      if (el.closest && el.closest('fieldset[disabled]')) return true;
      return false;
    } catch { return false; }
  }

  function isHidden(el) {
    try {
      const type = (el.type || attr(el, 'type')).toLowerCase();
      if (type === 'hidden') return true;
      if (el.hidden) return true;
      for (let node = el; node && node.nodeType === 1; node = node.parentElement) {
        if (node.hidden || node.hasAttribute('inert')) return true;
        if (node !== el && attr(node, 'aria-hidden') === 'true' && !isFormControl(el)) return true;
        const style = window.getComputedStyle(node);
        if (!style || style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse') return true;
        if (Number(style.opacity) === 0) return true;
      }

      const style = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      if (!rect || rect.width <= 1 || rect.height <= 1) return true;
      if (style.clip === 'rect(0px, 0px, 0px, 0px)' || /inset\(50%\)/.test(style.clipPath || '')) return true;
      return false;
    } catch {
      return false;
    }
  }

  function isRendered(el) {
    try {
      if ((el.type || '').toLowerCase() === 'hidden') return false;
      const rect = el.getBoundingClientRect ? el.getBoundingClientRect() : null;
      return !!rect && rect.width > 1 && rect.height > 1 && !isHidden(el);
    } catch { return true; }
  }

  function isRequired(el) {
    try {
      if (el.required || attr(el, 'aria-required') === 'true' || attr(el, 'data-required') === 'true') return true;
      return !!(el.closest && el.closest('label.required,.required,[data-required="true"]'));
    } catch { return false; }
  }

  function stripControls(node) {
    try {
      const clone = node.cloneNode(true);
      clone.querySelectorAll('input,select,textarea,button,[contenteditable],[role="textbox"],[role="combobox"],[role="checkbox"],[role="radio"],[role="switch"],[role="listbox"]').forEach(n => n.remove());
      return clone;
    } catch {
      return node;
    }
  }

  function looksLikeLabel(value) {
    const cleaned = clean(value)
      .replace(/\s*\([^)]*(required|optional|mandatory)[^)]*\)/gi, '')
      .replace(/[*•·]+/g, ' ')
      .replace(/\s*:\s*$/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!cleaned || cleaned.length > 180) return '';
    if (/^(submit|cancel|save|next|back|continue|apply|upload|browse|search|clear|reset|ok|close|your answer|type your answer|enter a response)$/i.test(cleaned)) return '';
    if (/^[0-9\s./-]+$/.test(cleaned)) return '';
    return cleaned;
  }

  function isWriteIn(el) {
    if (isChoiceControl(el)) return false;
    const type = (el.type || attr(el, 'type') || '').toLowerCase();
    if (['checkbox', 'radio', 'hidden', 'submit', 'button', 'reset', 'image', 'file', 'password', 'range', 'color', 'search'].includes(type)) return false;
    const role = attr(el, 'role');
    if (role === 'listbox' || role === 'option' || role === 'searchbox' || role === 'menuitem') return false;
    return true;
  }

  function isPageChrome(el) {
    try {
      if (attr(el, 'role') === 'searchbox' || (el.type || '').toLowerCase() === 'search') return true;
      const chrome = el.closest && el.closest('nav, header, footer, [role="banner"], [role="navigation"], [role="search"], [role="contentinfo"]');
      if (!chrome) return false;
      if (el.closest && el.closest('form, [role="listitem"], [data-params]')) return false;
      const hint = `${attr(el, 'placeholder')} ${attr(el, 'aria-label')} ${attr(el, 'name')} ${attr(el, 'id')}`.toLowerCase();
      return /search|subscribe|newsletter|cookie|promo|login|signin/.test(hint);
    } catch { return false; }
  }

  function containsNestedControl(el) {
    try {
      if (tag(el) === 'INPUT' || tag(el) === 'TEXTAREA' || tag(el) === 'SELECT') return false;
      return !!(el.querySelector && el.querySelector('input:not([type=hidden]),textarea,select,[contenteditable],[role="textbox"],[role="combobox"],[role="spinbutton"]'));
    } catch { return false; }
  }

  function resolveIds(doc, ids) {
    return String(ids || '').split(/\s+/).filter(Boolean).map(id => {
      try { return text(doc.getElementById(id)); } catch { return ''; }
    }).filter(Boolean);
  }

  function explicitLabel(el) {
    const doc = docOf(el);
    if (!el.id) return '';
    try {
      const explicit = doc.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (explicit) return looksLikeLabel(text(explicit));
    } catch { /* invalid id */ }
    return '';
  }

  function googleFormsQuestion(el) {
    // Google Forms wraps each question in role=listitem with a heading.
    const item = el.closest && el.closest('[role="listitem"],[data-params]');
    if (!item) return '';
    const heading = item.querySelector('[role="heading"],[class*="freebirdFormviewerComponentsQuestionBaseTitle"],[class*="QuestionBaseTitle"]');
    if (heading) {
      const value = looksLikeLabel(text(heading));
      if (value) return value;
    }
    const labelled = attr(item, 'aria-label');
    if (labelled) return looksLikeLabel(labelled);
    return '';
  }

  function siblingLabel(el) {
    const parent = el.parentElement;
    if (!parent) return '';
    try {
      const children = [...parent.children];
      const index = children.indexOf(el);
      for (let i = index - 1; i >= 0 && i >= index - 4; i -= 1) {
        const sibling = children[i];
        if (!sibling || sibling === el) continue;
        if (safeMatches(sibling, 'input,select,textarea,button')) continue;
        if (safeMatches(sibling, LABEL_LIKE) || safeMatches(sibling, HEADINGS) || tag(sibling) === 'SPAN' || tag(sibling) === 'DIV' || tag(sibling) === 'P') {
          const value = looksLikeLabel(text(stripControls(sibling)));
          if (value && value.length <= 120) return value;
        }
      }
      const cell = el.closest('td,th');
      if (cell) {
        const prev = cell.previousElementSibling;
        if (prev && (tag(prev) === 'TH' || tag(prev) === 'TD')) {
          const value = looksLikeLabel(text(stripControls(prev)));
          if (value) return value;
        }
      }
    } catch { /* ignore */ }
    return '';
  }

  function containerLabel(el) {
    const row = (el.closest && el.closest(ROW)) || el.parentElement;
    if (!row || row === el) return '';
    let best = '';
    try {
      const others = row.querySelectorAll('input,textarea,select,[contenteditable],[role="textbox"]');
      if (others.length > 1) return '';
      row.querySelectorAll(LABEL_LIKE).forEach(node => {
        if (node === el || (node.contains && node.contains(el))) return;
        const value = looksLikeLabel(text(stripControls(node)));
        if (!value || value.length > 100) return;
        if (!best || value.length < best.length) best = value;
      });
    } catch { /* ignore */ }
    return best;
  }

  function pickLabel(candidates) {
    const ranked = candidates.filter(item => item.value).map(item => {
      const value = item.value;
      let score = item.weight;
      if (value.length >= 2 && value.length <= 72) score += 2;
      if (value.length > 100) score -= 3;
      if (/\?$/.test(value)) score += 1;
      return { value, score };
    });
    ranked.sort((a, b) => b.score - a.score);
    return ranked.length ? cap(ranked[0].value, 160) : '';
  }

  function labelFor(el) {
    try {
      const doc = docOf(el);
      const wrapper = el.closest && el.closest('label');
      const dataLabel = attr(el, 'data-label') || attr(el, 'data-name') || attr(el, 'data-title') || attr(el, 'data-field');
      return pickLabel([
        { value: looksLikeLabel(resolveIds(doc, attr(el, 'aria-labelledby')).join(' ')), weight: 12 },
        { value: explicitLabel(el), weight: 11 },
        { value: googleFormsQuestion(el), weight: 10 },
        { value: looksLikeLabel(attr(el, 'aria-label')), weight: 9 },
        { value: wrapper ? looksLikeLabel(text(stripControls(wrapper))) : '', weight: 8 },
        { value: looksLikeLabel(String(dataLabel).replace(/[-_]+/g, ' ')), weight: 6 },
        { value: siblingLabel(el), weight: 5 },
        { value: containerLabel(el), weight: 4 },
        { value: precedingText(el), weight: 3 },
        { value: looksLikeLabel(attr(el, 'placeholder')), weight: 2 },
        { value: looksLikeLabel(attr(el, 'title')), weight: 1 }
      ]);
    } catch {
      return looksLikeLabel(attr(el, 'aria-label') || attr(el, 'placeholder') || attr(el, 'name')) || '';
    }
  }

  function precedingText(el) {
    let node = el;
    let best = '';
    for (let depth = 0; depth < 5 && node; depth += 1) {
      let sibling = node.previousElementSibling;
      for (let hops = 0; sibling && hops < 4; hops += 1) {
        if (!safeMatches(sibling, 'input,select,textarea,button,[contenteditable],[role="textbox"],[role="combobox"],[role="checkbox"],[role="radio"]')) {
          const value = looksLikeLabel(text(sibling));
          if (value && value.length <= 140) {
            if (!best || value.length < best.length) best = value;
            if (value.length <= 70) return value;
          }
        }
        sibling = sibling.previousElementSibling;
      }
      node = node.parentElement;
      if (node && safeMatches(node, 'form,body,html')) break;
    }
    return best;
  }

  function headingNear(node) {
    let cursor = node;
    for (let depth = 0; depth < 4 && cursor; depth += 1) {
      let sibling = cursor.previousElementSibling;
      for (let hops = 0; sibling && hops < 5; hops += 1) {
        let heading = null;
        try {
          heading = safeMatches(sibling, HEADINGS) ? sibling : sibling.querySelector && sibling.querySelector(HEADINGS);
        } catch { heading = null; }
        if (heading) {
          const value = looksLikeLabel(text(heading));
          if (value) return value;
        }
        sibling = sibling.previousElementSibling;
      }
      cursor = cursor.parentElement;
    }
    return '';
  }

  function sectionFor(el) {
    try {
      const group = el.closest && el.closest('fieldset,[data-section],.form-section,[class*="FormSection"],[class*="form-section"]');
      if (group) {
        const legend = group.querySelector && group.querySelector(':scope > legend, legend, caption, summary');
        if (legend) {
          const value = looksLikeLabel(text(legend));
          if (value) return cap(value, 120);
        }
        const named = attr(group, 'aria-label') || attr(group, 'data-section');
        if (named) return cap(clean(named), 120);
      }
      const item = el.closest && el.closest('[role="listitem"]');
      if (item) {
        const outside = [...document.querySelectorAll('h1,[role="heading"][aria-level="1"]')].find(node => !item.contains(node));
        const value = looksLikeLabel(outside && text(outside));
        if (value && value.length <= 80) return cap(value, 120);
      }
      const near = headingNear(el.closest && el.closest('fieldset,section') || el);
      return near ? cap(near, 120) : '';
    } catch {
      return '';
    }
  }

  function nearbyText(el) {
    try {
      const described = resolveIds(docOf(el), attr(el, 'aria-describedby')).join(' ');
      const row = (el.closest && el.closest(ROW)) || el.parentElement;
      if (!row || row === el || safeMatches(row, 'form,body,fieldset,section,article')) {
        return cap(described, 160);
      }
      const others = row.querySelectorAll ? row.querySelectorAll('input,textarea,select') : [];
      if (others.length > 1) return cap(described, 160);
      const base = looksLikeLabel(text(stripControls(row)));
      return cap(clean([described, base].filter(Boolean).join(' ')), 160);
    } catch {
      return '';
    }
  }

  const QUESTIONY = /\?|^\s*(why|how|describe|explain|tell|what|which|when|where|who|share|walk|give|outline|discuss|name)\b/i;
  const LOOKS_QUESTION = /why|how|describe|explain|tell us|tell me|what |which |when |where |cover letter|personal statement|share an example|walk us|give an example/i;

  function questionFor(el, label, nearby, section) {
    const pool = [];
    try {
      let node = el;
      for (let depth = 0; depth < 4 && node && pool.length < 4; depth += 1) {
        let sibling = node.previousElementSibling;
        for (let hops = 0; sibling && hops < 3; hops += 1) {
          if (!safeMatches(sibling, 'input,select,textarea,button,[contenteditable],[role="textbox"]')) {
            const value = text(sibling);
            if (value && value.length >= 12 && value.length <= 400) pool.push(value);
          }
          sibling = sibling.previousElementSibling;
        }
        node = node.parentElement;
      }
    } catch { /* ignore */ }
    pool.push(section, label, attr(el, 'placeholder'), nearby);
    const ranked = pool.filter(Boolean).map(value => ({
      value,
      score: (LOOKS_QUESTION.test(value) ? 3 : 0) + (QUESTIONY.test(value) ? 2 : 0) + (/[.?!]$/.test(value) ? 1 : 0) + (value.length >= 20 && value.length <= 300 ? 2 : 0) + (value.length > 400 ? -2 : 0)
    }));
    ranked.sort((a, b) => b.score - a.score);
    return cap(ranked.length ? ranked[0].value : '', 500);
  }

  function optionsFor(el) {
    try {
      const doc = docOf(el);
      if (tag(el) === 'SELECT') return [...el.options].map(option => ({ text: text(option), value: option.value }));
      if (attr(el, 'role') === 'listbox') {
        const found = [...el.querySelectorAll('[role="option"]')].map(node => ({
          text: text(node),
          value: attr(node, 'data-value') || attr(node, 'aria-label') || text(node)
        })).filter(option => option.text);
        if (found.length) return found;
      }
      const listId = attr(el, 'list');
      if (listId) {
        const list = doc.getElementById(listId);
        if (list) return [...list.querySelectorAll('option')].map(option => ({ text: text(option), value: option.value || text(option) }));
      }
      const controls = attr(el, 'aria-controls');
      if (controls) {
        const box = doc.getElementById(controls);
        if (box) {
          const found = [...box.querySelectorAll('[role="option"],option,li')].map(node => ({
            text: text(node),
            value: attr(node, 'data-value') || text(node)
          })).filter(option => option.text);
          if (found.length) return found;
        }
      }
      const host = el.closest && el.closest('[data-options]');
      if (host) {
        return attr(host, 'data-options').split('|').map(value => ({ text: clean(value), value: clean(value) })).filter(option => option.text);
      }
    } catch { /* ignore */ }
    return [];
  }

  function currentValue(el) {
    try {
      if (tag(el) === 'SELECT') return cap(text(el.selectedOptions && el.selectedOptions[0]), 200);
      if (el.type === 'checkbox' || el.type === 'radio') return el.checked ? 'true' : 'false';
      if (ARIA_CHOICE(el)) return attr(el, 'aria-checked') === 'true' ? 'true' : 'false';
      if (EDITABLE_STANDALONE(el) && tag(el) !== 'INPUT' && tag(el) !== 'TEXTAREA') return cap(text(el), 200);
      return cap(clean(el.value), 200);
    } catch {
      return '';
    }
  }

  function controlType(el) {
    if (el.type === 'checkbox' || attr(el, 'role') === 'checkbox' || attr(el, 'role') === 'switch') return 'checkbox';
    if (el.type === 'radio' || attr(el, 'role') === 'radio') return 'radio';
    if (attr(el, 'role') === 'listbox') return 'listbox';
    if (EDITABLE_STANDALONE(el) && tag(el) !== 'INPUT' && tag(el) !== 'TEXTAREA') return 'contenteditable';
    return el.type || (tag(el) === 'SELECT' ? 'select-one' : tag(el) === 'TEXTAREA' ? 'textarea' : 'text');
  }

  function collectInRoot(root, out, seen) {
    let nodes;
    try { nodes = root.querySelectorAll(INTERACTIVE); } catch { return; }
    nodes.forEach(el => {
      if (seen.has(el)) return;
      seen.add(el);
      try {
        if (!isWriteIn(el) || isChoiceControl(el)) return;
        if (isDisabled(el) || isHidden(el) || isPageChrome(el)) return;
        if (containsNestedControl(el)) return;
        out.push(el);
      } catch { /* skip bad node */ }
    });
  }

  function dedupeNested(elements) {
    const kept = [];
    elements.forEach(el => {
      if (kept.some(other => other === el || (other.contains && other.contains(el)))) return;
      if (elements.some(other => other !== el && el.contains && el.contains(other))) return;
      const rect = el.getBoundingClientRect();
      const label = normalise(labelFor(el));
      const type = controlType(el);
      const duplicate = kept.some(other => {
        if (docOf(other) !== docOf(el) || controlType(other) !== type) return false;
        if (!label || label !== normalise(labelFor(other))) return false;
        const otherRect = other.getBoundingClientRect();
        const width = Math.max(0, Math.min(rect.right, otherRect.right) - Math.max(rect.left, otherRect.left));
        const height = Math.max(0, Math.min(rect.bottom, otherRect.bottom) - Math.max(rect.top, otherRect.top));
        const smallerArea = Math.min(rect.width * rect.height, otherRect.width * otherRect.height);
        return smallerArea > 0 && (width * height) / smallerArea > 0.9;
      });
      if (!duplicate) kept.push(el);
    });
    return kept;
  }

  function byDocumentOrder(a, b) {
    try {
      if (a === b) return 0;
      const position = a.compareDocumentPosition(b);
      if (position & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
      if (position & Node.DOCUMENT_POSITION_PRECEDING) return 1;
    } catch { /* mixed documents */ }
    return 0;
  }

  function walkShadows(root, out, seen, depth) {
    if (depth > 6) return;
    let hosts;
    try {
      // Prefer known custom-element hosts; fall back to a capped walk.
      hosts = root.querySelectorAll('*');
    } catch { return; }
    const limit = Math.min(hosts.length, 4000);
    for (let i = 0; i < limit; i += 1) {
      const host = hosts[i];
      if (!host || !host.shadowRoot || seen.has(host)) continue;
      seen.add(host);
      out.push(host.shadowRoot);
      walkShadows(host.shadowRoot, out, seen, depth + 1);
    }
  }

  function collect(root, out, seen) {
    collectInRoot(root, out, seen);
    const shadows = [];
    walkShadows(root, shadows, new Set(), 0);
    shadows.forEach(shadow => collectInRoot(shadow, out, seen));
  }

  function candidates() {
    const elements = [];
    const seen = new Set();
    try { collect(document, elements, seen); } catch { /* continue */ }
    try {
      document.querySelectorAll('iframe,frame').forEach(frame => {
        try {
          const doc = frame.contentDocument;
          if (doc) collect(doc, elements, seen);
        } catch { /* cross-origin */ }
      });
    } catch { /* ignore */ }
    return dedupeNested(elements).sort(byDocumentOrder);
  }

  function fields() {
    const elements = candidates();
    window.__affElements = {};
    const results = [];
    elements.forEach((el, index) => {
      try {
        const id = `aff_${index}`;
        const own = labelFor(el);
        const section = sectionFor(el);
        const nearby = nearbyText(el);
        const options = optionsFor(el);
        window.__affElements[id] = el;
        results.push({
          id,
          tag: tag(el).toLowerCase() || 'div',
          type: controlType(el),
          name: attr(el, 'name'),
          id_attribute: attr(el, 'id'),
          label: cap(own, 160),
          question_hint: cap(own, 160),
          section,
          placeholder: attr(el, 'placeholder'),
          aria_label: attr(el, 'aria-label'),
          autocomplete: attr(el, 'autocomplete'),
          nearby_text: nearby,
          required: isRequired(el),
          visible: isRendered(el),
          current_value: currentValue(el),
          question: questionFor(el, own, nearby, section),
          options: options.map(option => option.text),
          option_values: options.map(option => option.value)
        });
      } catch {
        /* skip one bad field - never abort the whole scan */
      }
    });
    return results;
  }

  const PLACEHOLDER = /^(please\s+)?(select|choose|choose an option|select an option|pick|none|n\/a|na|not applicable|--|-|\.\.\.)/i;
  const normalise = value => String(value == null ? '' : value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const IGNORED_TOKENS = new Set(['please', 'select', 'choose', 'option', 'other', 'otherplease', 'the', 'a', 'an', 'one', 'n', 'not', 'applicable', 'na']);
  const tokens = value => normalise(value).split(' ').filter(word => word && !IGNORED_TOKENS.has(word));

  function similarity(target, option) {
    const left = normalise(target);
    const right = normalise(option);
    if (!left || !right) return 0;
    if (left === right) return 1;
    if (right.includes(left) || left.includes(right)) return 0.9;
    const leftTokens = tokens(target);
    const rightTokens = tokens(option);
    if (!leftTokens.length || !rightTokens.length) return 0;
    let hits = 0;
    leftTokens.forEach(word => {
      if (rightTokens.some(candidate => candidate === word || (word.length > 3 && candidate.startsWith(word)) || (candidate.length > 3 && word.startsWith(candidate)))) hits += 1;
    });
    return hits / Math.max(leftTokens.length, rightTokens.length);
  }

  function notify(el, types) { types.forEach(type => el.dispatchEvent(new Event(type, { bubbles: true }))); }

  function setNative(el, value) {
    const proto = tag(el) === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    if (setter) setter.call(el, value); else el.value = value;
    notify(el, ['input', 'change', 'blur']);
    return true;
  }

  const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };

  function toIsoDate(value) {
    const raw = String(value).toLowerCase().replace(/[.,]/g, ' ');
    const monthKey = Object.keys(MONTHS).find(key => new RegExp(`\\b${key}[a-z]*\\b`).test(raw));
    const numbers = (raw.match(/\d{1,4}/g) || []).map(Number);
    if (monthKey) {
      const year = numbers.find(number => number > 1900 && number < 2100);
      const day = numbers.find(number => number >= 1 && number <= 31 && number !== year);
      if (year) return `${year}-${String(MONTHS[monthKey]).padStart(2, '0')}-${String(day || 1).padStart(2, '0')}`;
    }
    if (numbers.length >= 3) {
      const [first, second, third] = numbers;
      const [year, month, day] = first > 31 ? [first, second, third] : third > 31 ? [third, second, first] : [third, first, second];
      if (year && month && day) return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
    if (numbers.length === 2) {
      const [first, second] = numbers;
      if (first > 31) return `${first}-${String(second).padStart(2, '0')}`;
      if (second > 31) return `${second}-${String(first).padStart(2, '0')}`;
    }
    return '';
  }

  function setDate(el, value) {
    const iso = toIsoDate(value);
    if (iso && setNative(el, iso)) return true;
    return setNative(el, String(value).trim());
  }

  function setContentEditable(el, value) {
    el.focus();
    el.textContent = value;
    el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: value }));
    notify(el, ['change', 'blur']);
    return true;
  }

  function chooseOption(el, value) {
    const options = [...el.options].filter(option => !PLACEHOLDER.test(option.text) || option.value);
    if (!options.length) return false;
    let best = null;
    let bestScore = 0;
    options.forEach(option => {
      const score = Math.max(similarity(value, option.value), similarity(value, option.text));
      if (score > bestScore) { bestScore = score; best = option; }
    });
    if (!best || bestScore < 0.34) return false;
    el.value = best.value;
    notify(el, ['input', 'change', 'blur']);
    return true;
  }

  function isTruthy(value) { return value === true || /^(true|yes|y|1|on|checked)$/i.test(String(value).trim()); }
  function isFalsy(value) { return value === false || /^(false|no|n|0|off|unchecked)$/i.test(String(value).trim()); }

  function fillRadioGroup(radios, value) {
    const target = String(value).trim();
    let best = null;
    let bestScore = 0;
    radios.forEach(radio => {
      const label = labelFor(radio) || text(radio.closest && radio.closest('label') || radio.parentElement);
      const score = Math.max(
        similarity(target, radio.value || ''),
        similarity(target, attr(radio, 'aria-label')),
        similarity(target, label),
        (radio.checked || attr(radio, 'aria-checked') === 'true') ? 0.15 : 0
      );
      if (score > bestScore) { bestScore = score; best = radio; }
    });
    if (!best) return false;
    radios.forEach(radio => {
      const on = radio === best;
      if (radio.type === 'radio') {
        if (radio.checked !== on) {
          radio.checked = on;
          notify(radio, on ? ['input', 'change'] : ['change']);
        }
      } else {
        const next = on ? 'true' : 'false';
        if (attr(radio, 'aria-checked') !== next) {
          radio.setAttribute('aria-checked', next);
          radio.click();
          notify(radio, ['input', 'change', 'click']);
        }
      }
    });
    return true;
  }

  function setAriaChoice(el, value) {
    const next = isFalsy(value) ? false : isTruthy(value);
    const current = attr(el, 'aria-checked') === 'true';
    if (current === next) return true;
    el.focus();
    el.click();
    // If click did not toggle, force the state.
    if ((attr(el, 'aria-checked') === 'true') !== next) {
      el.setAttribute('aria-checked', next ? 'true' : 'false');
      notify(el, ['input', 'change', 'click']);
    }
    return true;
  }

  function applyValue(el, item) {
    const value = item.value;
    if (Array.isArray(el)) return fillRadioGroup(el, value);
    if (tag(el) === 'SELECT') return chooseOption(el, item.option_value || value);
    if (el.type === 'checkbox') {
      const next = isFalsy(value) ? false : isTruthy(value);
      if (el.checked !== next) { el.checked = next; notify(el, ['input', 'change']); }
      return true;
    }
    if (ARIA_CHOICE(el) && attr(el, 'role') !== 'radio') return setAriaChoice(el, value);
    if (el.type === 'radio' || attr(el, 'role') === 'radio') {
      if (isTruthy(value) || similarity(String(value), attr(el, 'value') || labelFor(el)) >= 0.34) {
        if (el.type === 'radio') {
          el.checked = true;
          notify(el, ['input', 'change']);
        } else {
          setAriaChoice(el, true);
        }
      }
      return true;
    }
    if (el.type === 'date' || el.type === 'month' || el.type === 'datetime-local') return setDate(el, value);
    if (el.isContentEditable || (EDITABLE_STANDALONE(el) && tag(el) !== 'INPUT' && tag(el) !== 'TEXTAREA')) {
      return setContentEditable(el, String(value).trim());
    }
    if (el.type === 'number' || el.type === 'range') {
      const numeric = String(value).replace(/[^\d.\-]/g, '');
      if (!numeric) return false;
      if (el.min && Number(numeric) < Number(el.min)) return false;
      if (el.max && Number(numeric) > Number(el.max)) return false;
      return setNative(el, numeric);
    }
    if (el.maxLength > 0 && String(value).length > el.maxLength) return setNative(el, String(value).slice(0, el.maxLength));
    return setNative(el, String(value).trim());
  }

  chrome.runtime.onMessage.addListener((message, _sender, reply) => {
    if (message.type === 'scan') {
      try {
        const list = fields();
        reply({ fields: list, count: list.length });
      } catch (error) {
        reply({ fields: [], error: String(error && error.message || error) });
      }
      return true;
    }
    if (message.type === 'fill') {
      let filled = 0;
      const failed = [];
      (message.items || []).forEach(item => {
        const target = window.__affElements ? window.__affElements[item.id] : null;
        if (!target || !item.approved || !item.value) return;
        const primary = Array.isArray(target) ? target[0] : target;
        if (!primary || primary.isConnected === false) return;
        if (isDisabled(primary)) return;
        try {
          if (applyValue(target, item)) filled += 1; else failed.push(item.id);
        } catch {
          failed.push(item.id);
        }
      });
      reply({ filled, failed });
      return true;
    }
    if (message.type === 'ping') {
      reply({ ok: true });
      return true;
    }
    return false;
  });
})();
