// Returns the self-contained overlay script that gets injected into the same-origin iframe.
// It communicates with the parent via postMessage with argus:* message types.
export const OVERLAY_SCRIPT = `
(function () {
  if (window.__argusInjected) return;
  window.__argusInjected = true;

  var state = { tasks: [], currentTask: 0, commentMode: false, pendingEl: null, pendingRect: null, pendingSelector: null };

  // ─── Styles ────────────────────────────────────────────────────────────────
  var style = document.createElement('style');
  style.textContent = '#__argus_taskbar *{box-sizing:border-box;font-family:system-ui,sans-serif;} #__argus_dialog textarea{font-family:system-ui,sans-serif;}';
  document.head.appendChild(style);

  // ─── Highlight ring ────────────────────────────────────────────────────────
  var hl = document.createElement('div');
  hl.style.cssText = 'position:fixed;pointer-events:none;border:2px solid #818cf8;background:rgba(129,140,248,.12);border-radius:3px;display:none;z-index:2147483645;transition:top .08s,left .08s,width .08s,height .08s;';
  document.body.appendChild(hl);

  // ─── Comment dialog ────────────────────────────────────────────────────────
  var dlg = document.createElement('div');
  dlg.id = '__argus_dialog';
  dlg.style.cssText = 'position:fixed;background:#1e1b4b;border:1px solid #4f46e5;border-radius:8px;padding:12px;min-width:240px;max-width:280px;display:none;z-index:2147483646;box-shadow:0 10px 30px rgba(0,0,0,.6);pointer-events:all;';
  dlg.innerHTML = '<div style="color:#e0e7ff;font-size:12px;font-weight:600;margin-bottom:7px;">Pin a comment</div><textarea id="__at" style="width:100%;box-sizing:border-box;background:#0f172a;border:1px solid #4338ca;border-radius:4px;color:#e0e7ff;font-size:12px;padding:6px;resize:none;outline:none;" rows="3" placeholder="What did you notice?"></textarea><div style="display:flex;gap:6px;margin-top:8px;"><button id="__as" style="flex:1;background:#4f46e5;color:#fff;border:none;border-radius:4px;padding:6px 0;font-size:12px;cursor:pointer;">Pin</button><button id="__ac" style="background:#334155;color:#94a3b8;border:none;border-radius:4px;padding:6px 10px;font-size:12px;cursor:pointer;">✕</button></div>';
  document.body.appendChild(dlg);

  // ─── Task bar ──────────────────────────────────────────────────────────────
  var bar = document.createElement('div');
  bar.id = '__argus_taskbar';
  bar.style.cssText = 'position:fixed;bottom:0;left:0;right:0;background:rgba(2,6,23,.93);backdrop-filter:blur(6px);border-top:1px solid #1e293b;padding:8px 14px;display:flex;align-items:center;gap:10px;z-index:2147483644;pointer-events:all;';
  document.body.appendChild(bar);

  // ─── Toast ─────────────────────────────────────────────────────────────────
  function toast(msg) {
    var t = document.createElement('div');
    t.style.cssText = 'position:fixed;top:14px;right:14px;background:#059669;color:#fff;padding:8px 14px;border-radius:6px;font-size:12px;z-index:2147483647;font-family:system-ui,sans-serif;box-shadow:0 4px 12px rgba(0,0,0,.4);';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 2200);
  }

  // ─── Selector path ─────────────────────────────────────────────────────────
  function getSelector(el) {
    var parts = [];
    var cur = el;
    for (var i = 0; i < 6 && cur && cur !== document.body; i++) {
      var seg = cur.tagName.toLowerCase();
      if (cur.id) { seg = '#' + cur.id; parts.unshift(seg); break; }
      var par = cur.parentElement;
      if (par) {
        var sibs = Array.from(par.children).filter(function (c) { return c.tagName === cur.tagName; });
        if (sibs.length > 1) seg += ':nth-of-type(' + (sibs.indexOf(cur) + 1) + ')';
      }
      if (cur.className && typeof cur.className === 'string') {
        var cls = cur.className.trim().split(/\s+/).slice(0, 2).join('.');
        if (cls) seg += '.' + cls;
      }
      parts.unshift(seg);
      cur = cur.parentElement;
    }
    return parts.join(' > ').slice(0, 180);
  }

  // ─── Render task bar ───────────────────────────────────────────────────────
  function render() {
    var task = state.tasks[state.currentTask];
    var desc = task ? task.description : 'Free exploration — look around and share thoughts.';
    var cm = state.commentMode;
    bar.innerHTML =
      '<span style="background:#4f46e5;color:#fff;border-radius:4px;padding:2px 7px;font-size:11px;font-weight:700;flex-shrink:0;">' +
        (state.tasks.length ? ('Task ' + (state.currentTask + 1) + '/' + state.tasks.length) : 'Argus') +
      '</span>' +
      '<span style="color:#cbd5e1;flex:1;font-size:12px;line-height:1.4;">' + desc + '</span>' +
      '<button id="__apb" style="background:' + (cm ? '#4f46e5' : '#1e293b') + ';color:' + (cm ? '#fff' : '#94a3b8') + ';border:1px solid ' + (cm ? '#4f46e5' : '#334155') + ';border-radius:4px;padding:5px 10px;font-size:11px;cursor:pointer;white-space:nowrap;">' +
        (cm ? '📌 Click element…' : '📌 Pin') +
      '</button>' +
      '<button id="__adb" style="background:#059669;color:#fff;border:none;border-radius:4px;padding:5px 12px;font-size:11px;cursor:pointer;white-space:nowrap;">✓ Done</button>';

    document.getElementById('__apb').onclick = function () {
      state.commentMode = !state.commentMode;
      if (!state.commentMode) { hl.style.display = 'none'; }
      render();
    };
    document.getElementById('__adb').onclick = function () {
      parent.postMessage({ type: 'argus:task_complete', taskIndex: state.currentTask }, '*');
      toast('Task marked complete!');
      if (state.tasks.length && state.currentTask < state.tasks.length - 1) {
        state.currentTask++;
        parent.postMessage({ type: 'argus:task_start', taskIndex: state.currentTask }, '*');
        render();
      }
    };
  }

  // ─── Navigation tracking ───────────────────────────────────────────────────
  var lastUrl = location.href;
  parent.postMessage({ type: 'argus:path', event: { type: 'navigation', url: location.href, timestamp: new Date().toISOString() } }, '*');

  new MutationObserver(function () {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      parent.postMessage({ type: 'argus:path', event: { type: 'navigation', url: location.href, timestamp: new Date().toISOString() } }, '*');
    }
  }).observe(document.body, { childList: true, subtree: true });

  // ─── Click tracking ────────────────────────────────────────────────────────
  document.addEventListener('click', function (e) {
    var tgt = e.target;
    if (bar.contains(tgt) || dlg.contains(tgt)) return;

    if (state.commentMode) {
      e.preventDefault(); e.stopPropagation();
      var r = tgt.getBoundingClientRect();
      state.pendingEl = tgt;
      state.pendingRect = { x: Math.round(r.left), y: Math.round(r.top), width: Math.round(r.width), height: Math.round(r.height) };
      state.pendingSelector = getSelector(tgt);
      var dx = Math.min(r.left, window.innerWidth - 290);
      var dy = (r.bottom + 8 + 130 < window.innerHeight) ? r.bottom + 8 : Math.max(8, r.top - 130);
      dlg.style.left = Math.max(8, dx) + 'px';
      dlg.style.top = dy + 'px';
      dlg.style.display = 'block';
      document.getElementById('__at').value = '';
      setTimeout(function () { document.getElementById('__at').focus(); }, 50);
    } else {
      parent.postMessage({ type: 'argus:path', event: { type: 'click', selector: getSelector(tgt), url: location.href, timestamp: new Date().toISOString() } }, '*');
    }
  }, true);

  // ─── Hover highlight ───────────────────────────────────────────────────────
  document.addEventListener('mousemove', function (e) {
    if (!state.commentMode) return;
    var tgt = e.target;
    if (bar.contains(tgt) || dlg.contains(tgt) || tgt === hl) return;
    var r = tgt.getBoundingClientRect();
    hl.style.cssText = hl.style.cssText;
    hl.style.display = 'block';
    hl.style.top = r.top + 'px'; hl.style.left = r.left + 'px';
    hl.style.width = r.width + 'px'; hl.style.height = r.height + 'px';
  }, true);

  // ─── Dialog actions ────────────────────────────────────────────────────────
  document.getElementById('__as').onclick = function () {
    var text = document.getElementById('__at').value.trim();
    if (!text) { document.getElementById('__at').focus(); return; }
    parent.postMessage({ type: 'argus:comment', selector: state.pendingSelector, text: text, rect: state.pendingRect, pageUrl: location.href }, '*');
    dlg.style.display = 'none'; hl.style.display = 'none';
    state.commentMode = false; state.pendingEl = null;
    render(); toast('📌 Comment pinned!');
  };
  document.getElementById('__ac').onclick = function () {
    dlg.style.display = 'none'; hl.style.display = 'none';
    state.commentMode = false; render();
  };

  // ─── Init from parent ──────────────────────────────────────────────────────
  window.addEventListener('message', function (e) {
    if (!e.data || e.data.type !== 'argus:init') return;
    state.tasks = e.data.tasks || [];
    state.currentTask = 0;
    render();
    if (state.tasks.length) {
      parent.postMessage({ type: 'argus:task_start', taskIndex: 0 }, '*');
    }
  });

  parent.postMessage({ type: 'argus:ready' }, '*');
  render();
})();
`
