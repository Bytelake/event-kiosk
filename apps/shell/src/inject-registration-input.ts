import type { WebContents } from "electron";

/** Keeps autocomplete / select dropdowns usable above the virtual keyboard. */
export const REGISTRATION_KEYBOARD_CSS = `
  html.kiosk-keyboard-open {
    scroll-padding-bottom: 380px;
  }

  html.kiosk-keyboard-open [role="listbox"],
  html.kiosk-keyboard-open [role="menu"],
  html.kiosk-keyboard-open .dropdown-menu,
  html.kiosk-keyboard-open .autocomplete-suggestions,
  html.kiosk-keyboard-open .select2-dropdown,
  html.kiosk-keyboard-open .choices__list--dropdown,
  html.kiosk-keyboard-open .pac-container {
    max-height: min(40vh, 300px) !important;
    overflow-y: auto !important;
  }
`;

/** Injected into registration pages to track focused inputs and handle virtual-keyboard typing. */
export const REGISTRATION_INPUT_SCRIPT = `
(function () {
  if (window.__kioskInputReady) return;
  window.__kioskInputReady = true;

  var INPUT_SEL =
    'input:not([type=checkbox]):not([type=radio]):not([type=submit]):not([type=button]):not([type=hidden]):not([type=file]):not([type=image]), textarea';

  var FLOATING_UI_ROLES = {
    listbox: true,
    option: true,
    menu: true,
    menuitem: true,
  };

  window.__kioskActiveInput = null;

  var activeInput = null;
  var keyboardWanted = false;
  var inputObservers = [];
  var panelObservers = [];

  function dispatchInput(el) {
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }

  window.__kioskTyping = {
    insertText: function (char) {
      var el = window.__kioskActiveInput;
      if (!el || el.disabled || el.readOnly) return;
      el.focus();
      var start = el.selectionStart != null ? el.selectionStart : el.value.length;
      var end = el.selectionEnd != null ? el.selectionEnd : el.value.length;
      var value = el.value || "";
      el.value = value.slice(0, start) + char + value.slice(end);
      var pos = start + char.length;
      el.selectionStart = pos;
      el.selectionEnd = pos;
      dispatchInput(el);
    },
    backspace: function () {
      var el = window.__kioskActiveInput;
      if (!el || el.disabled || el.readOnly) return;
      el.focus();
      var start = el.selectionStart != null ? el.selectionStart : el.value.length;
      var end = el.selectionEnd != null ? el.selectionEnd : el.value.length;
      var value = el.value || "";
      if (start !== end) {
        el.value = value.slice(0, start) + value.slice(end);
        el.selectionStart = start;
        el.selectionEnd = start;
      } else if (start > 0) {
        el.value = value.slice(0, start - 1) + value.slice(start);
        el.selectionStart = start - 1;
        el.selectionEnd = start - 1;
      }
      dispatchInput(el);
    },
    enter: function () {
      var el = window.__kioskActiveInput;
      if (!el) return;
      el.focus();
      var opts = { key: "Enter", code: "Enter", bubbles: true, cancelable: true };
      el.dispatchEvent(new KeyboardEvent("keydown", opts));
      el.dispatchEvent(new KeyboardEvent("keypress", opts));
      el.dispatchEvent(new KeyboardEvent("keyup", opts));
    },
  };

  function isTextInput(el) {
    return el && el.matches && el.matches(INPUT_SEL);
  }

  function findTextInput(el) {
    if (!el || !el.closest) return null;
    if (isTextInput(el)) return el;
    return el.closest(INPUT_SEL);
  }

  function isNativeSelect(el) {
    return el && el.tagName === "SELECT";
  }

  function findNativeSelect(el) {
    if (!el || !el.closest) return null;
    if (isNativeSelect(el)) return el;
    return el.closest("select");
  }

  function getFieldWidget(input) {
    if (!input) return null;
    return (
      input.closest(
        '[role="combobox"], [data-combobox], fieldset, .form-group, .field, .form-field',
      ) || input.parentElement
    );
  }

  function collectAriaIds(el, into) {
    if (!el || !el.getAttribute) return;
    ["aria-controls", "aria-owns"].forEach(function (attr) {
      var val = el.getAttribute(attr);
      if (!val) return;
      val.split(/\\s+/).forEach(function (id) {
        if (id) into.push(id);
      });
    });
  }

  function getLinkedPanels(input) {
    if (!input) return [];
    var ids = [];
    collectAriaIds(input, ids);

    var widget = getFieldWidget(input);
    if (widget) {
      widget.querySelectorAll("[aria-controls],[aria-owns]").forEach(function (el) {
        collectAriaIds(el, ids);
      });
    }

    var listId = input.getAttribute("list");
    if (listId) ids.push(listId);

    var panels = [];
    var seen = {};
    ids.forEach(function (id) {
      if (seen[id]) return;
      seen[id] = true;
      var el = document.getElementById(id);
      if (el) panels.push(el);
    });
    return panels;
  }

  function isPanelVisible(panel) {
    var style = window.getComputedStyle(panel);
    return (
      style.display !== "none" &&
      style.visibility !== "hidden" &&
      panel.getClientRects().length > 0
    );
  }

  function hasOpenDropdown() {
    if (!activeInput) return false;

    var candidates = [activeInput];
    var combobox = activeInput.closest('[role="combobox"]');
    if (combobox) candidates.push(combobox);

    for (var i = 0; i < candidates.length; i++) {
      if (candidates[i].getAttribute("aria-expanded") === "true") return true;
    }

    var panels = getLinkedPanels(activeInput);
    for (var j = 0; j < panels.length; j++) {
      if (isPanelVisible(panels[j])) return true;
    }

    return false;
  }

  function eventPath(event) {
    if (event.composedPath) return event.composedPath();
    var path = [event.target];
    var node = event.target;
    while (node && node.parentNode) {
      node = node.parentNode;
      path.push(node);
    }
    return path;
  }

  function isDropdownInteractionInPath(path) {
    if (!hasOpenDropdown()) return false;
    for (var i = 0; i < path.length; i++) {
      var el = path[i];
      if (!el || !el.getAttribute) continue;
      var role = el.getAttribute("role");
      if (role && FLOATING_UI_ROLES[role]) return true;
    }
    return false;
  }

  function isWithinEditingContext(event) {
    if (!activeInput) return false;

    var path = eventPath(event);
    var widget = getFieldWidget(activeInput);
    var panels = getLinkedPanels(activeInput);

    for (var i = 0; i < path.length; i++) {
      var el = path[i];
      if (!el || el === document || el === window) continue;
      if (el === activeInput) return true;
      if (widget && widget.contains && widget.contains(el)) return true;
      for (var j = 0; j < panels.length; j++) {
        if (panels[j].contains(el)) return true;
      }
    }

    return isDropdownInteractionInPath(path);
  }

  function setKeyboardVisible(want) {
    if (want === keyboardWanted) return;
    keyboardWanted = want;
    if (want) {
      window.__kioskInput && window.__kioskInput.notifyFocus();
    } else {
      window.__kioskInput && window.__kioskInput.notifyDismiss();
    }
  }

  function teardownObservers() {
    inputObservers.forEach(function (obs) {
      obs.disconnect();
    });
    panelObservers.forEach(function (obs) {
      obs.disconnect();
    });
    inputObservers = [];
    panelObservers = [];
  }

  function observePanels() {
    if (!activeInput) return;

    getLinkedPanels(activeInput).forEach(function (panel) {
      var obs = new MutationObserver(function () {
        if (activeInput && hasOpenDropdown()) {
          setKeyboardVisible(true);
        }
      });
      obs.observe(panel, {
        attributes: true,
        attributeFilter: ["style", "class", "hidden"],
        childList: true,
        subtree: true,
      });
      panelObservers.push(obs);
    });
  }

  function refreshPanelObservers() {
    panelObservers.forEach(function (obs) {
      obs.disconnect();
    });
    panelObservers = [];
    observePanels();
  }

  function observeField(input) {
    teardownObservers();

    var watchEls = [input];
    var combobox = input.closest('[role="combobox"]');
    if (combobox) watchEls.push(combobox);

    watchEls.forEach(function (el) {
      var obs = new MutationObserver(function () {
        if (activeInput && hasOpenDropdown()) {
          setKeyboardVisible(true);
          refreshPanelObservers();
        }
      });
      obs.observe(el, {
        attributes: true,
        attributeFilter: ["aria-expanded", "aria-controls", "aria-owns"],
      });
      inputObservers.push(obs);
    });

    observePanels();
  }

  function clearEditingState() {
    activeInput = null;
    window.__kioskActiveInput = null;
    teardownObservers();
  }

  function blurActiveField() {
    var el = activeInput;
    if (el && document.activeElement === el) {
      el.blur();
    }
  }

  function startEditing(el) {
    activeInput = el;
    window.__kioskActiveInput = el;
    observeField(el);
    setKeyboardVisible(true);
    el.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  function endEditing() {
    if (!activeInput) return;
    blurActiveField();
    clearEditingState();
    setKeyboardVisible(false);
  }

  /** Called by the shell when the keyboard is hidden (e.g. Done). Syncs state without IPC. */
  window.__kioskEndEditing = function () {
    blurActiveField();
    clearEditingState();
    keyboardWanted = false;
  };

  window.__kioskDismissTyping = window.__kioskEndEditing;

  function onPointerDown(e) {
    if (findTextInput(e.target)) return;

    if (findNativeSelect(e.target)) {
      if (activeInput) endEditing();
      return;
    }

    if (!activeInput) return;

    if (isWithinEditingContext(e)) return;

    endEditing();
  }

  document.addEventListener(
    "focusin",
    function (e) {
      var target = e.target;
      if (isTextInput(target)) {
        startEditing(target);
        return;
      }
      if (isNativeSelect(target) && activeInput) {
        endEditing();
      }
    },
    true,
  );

  document.addEventListener("pointerdown", onPointerDown, true);

  function notifyActivity() {
    window.__kioskInput && window.__kioskInput.notifyActivity();
  }

  ["touchstart", "mousedown", "keydown", "scroll", "pointerdown"].forEach(function (event) {
    document.addEventListener(event, notifyActivity, { passive: true, capture: true });
  });

  var active = document.activeElement;
  if (isTextInput(active)) {
    startEditing(active);
  }
})();
`;

export function injectRegistrationInputScript(webContents: WebContents) {
  return webContents.executeJavaScript(REGISTRATION_INPUT_SCRIPT, true);
}
