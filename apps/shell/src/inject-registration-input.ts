import type { WebContents } from "electron";

/** Injected into registration pages to track focused inputs and handle virtual-keyboard typing. */
export const REGISTRATION_INPUT_SCRIPT = `
(function () {
  if (window.__kioskInputReady) return;
  window.__kioskInputReady = true;

  var INPUT_SEL =
    'input:not([type=checkbox]):not([type=radio]):not([type=submit]):not([type=button]):not([type=hidden]):not([type=file]):not([type=image]), textarea';

  window.__kioskActiveInput = null;

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

  function isInputTarget(el) {
    if (!el || !el.closest) return false;
    if (el.closest(INPUT_SEL)) return true;
    var label = el.closest("label");
    if (label && label.control && label.control.matches(INPUT_SEL)) return true;
    return false;
  }

  function isSupportedInput(el) {
    return el && el.matches && el.matches(INPUT_SEL);
  }

  function setActiveInput(el) {
    window.__kioskActiveInput = el;
    window.__kioskInput && window.__kioskInput.notifyFocus();
  }

  function blurActiveInput() {
    var el = window.__kioskActiveInput;
    if (el && document.activeElement === el) {
      el.blur();
    }
    window.__kioskActiveInput = null;
  }

  function dismissKeyboard() {
    blurActiveInput();
    window.__kioskInput && window.__kioskInput.notifyDismiss();
  }

  window.__kioskDismissTyping = blurActiveInput;

  function syncFocusedInput() {
    var active = document.activeElement;
    if (isSupportedInput(active)) {
      setActiveInput(active);
    }
  }

  document.addEventListener(
    "focusin",
    function (e) {
      var target = e.target;
      if (isSupportedInput(target)) {
        setActiveInput(target);
      }
    },
    true,
  );

  document.addEventListener(
    "focusout",
    function () {
      requestAnimationFrame(function () {
        if (isSupportedInput(document.activeElement)) return;
        window.__kioskActiveInput = null;
        window.__kioskInput && window.__kioskInput.notifyDismiss();
      });
    },
    true,
  );

  document.addEventListener(
    "pointerdown",
    function (e) {
      if (isInputTarget(e.target)) return;
      dismissKeyboard();
    },
    true,
  );

  syncFocusedInput();
})();
`;

export function injectRegistrationInputScript(webContents: WebContents) {
  return webContents.executeJavaScript(REGISTRATION_INPUT_SCRIPT, true);
}
