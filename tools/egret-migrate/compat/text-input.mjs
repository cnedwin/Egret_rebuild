// SPDX-License-Identifier: Apache-2.0
export const TextFieldInputType = Object.freeze({ TEXT: 'text', TEL: 'tel', PASSWORD: 'password' });
export const TextFieldType = Object.freeze({ DYNAMIC: 'dynamic', INPUT: 'input' });

function unsupported(message) {
  return Object.assign(new Error(message), { code: 'LEGACY_TEXT_INPUT_UNSUPPORTED' });
}

function filterFor(restrict) {
  if (!restrict) return value => value;
  // Only accept the numeric restriction used by the verified control.
  if (restrict !== '0-9') throw unsupported('This editor accepts the 0-9 restriction or unrestricted text.');
  return value => value.replace(/[^0-9]/g, '');
}

export function createClassicEditor(signal, open, dispatch, report) {
  let active;
  function end(session, notify) {
    if (active !== session) return;
    active = undefined;
    try {
      session.port?.close();
    } finally {
      if (session.focused) {
        session.field.setLegacyEditing?.(false);
        if (notify && !signal.aborted && !session.field.isDisposed) dispatch(session.field, 'focusOut');
      }
    }
  }
  signal.addEventListener(
    'abort',
    () => {
      if (active) end(active, false);
    },
    { once: true }
  );
  return {
    detach(field) {
      if (active?.field === field) end(active, true);
    },
    focus(field) {
      if (signal.aborted || !field.stage || field.type !== 'input' || field.isDisposed || active?.field === field)
        return;
      if (!open) throw unsupported('This host has no text editing port.');
      const inputMode = field.inputType ?? 'text';
      if (!['text', 'tel'].includes(inputMode) || field.displayAsPassword)
        throw unsupported('This converted control accepts text and telephone input.');
      const filter = filterFor(field.restrict);
      if (active) end(active, true);
      // A focusOut listener may have installed another field or removed this one.
      if (active || signal.aborted || !field.stage || field.isDisposed) return;
      const session = { field, focused: false, port: undefined };
      const events = {
        focus() {
          if (active !== session || session.focused || signal.aborted) return;
          session.focused = true;
          field.setLegacyEditing?.(true);
          dispatch(field, 'focusIn');
        },
        change(raw, final = false) {
          if (active !== session || signal.aborted) return;
          const value = filter(raw).slice(0, field.maxChars > 0 ? field.maxChars : undefined);
          if (value !== raw) session.port?.write?.(value);
          if (final && value === field.text) return;
          field.text = value;
          dispatch(field, 'change');
        },
        finish() {
          end(session, true);
        },
        fail(error) {
          if (active === session) {
            end(session, true);
            report(error);
          }
        }
      };
      active = session;
      try {
        const top = field.localToGlobal(0, 0),
          endPoint = field.localToGlobal(field.width || 100, field.height || 30);
        const port = open(
          {
            value: field.text,
            x: Math.min(top.x, endPoint.x),
            y: Math.min(top.y, endPoint.y),
            width: Math.max(1, Math.abs(endPoint.x - top.x)),
            height: Math.max(1, Math.abs(endPoint.y - top.y)),
            inputMode,
            ...(field.maxChars > 0 && { maxLength: field.maxChars }),
            digitsOnly: field.restrict === '0-9',
            multiline: field.multiline === true,
            placeholder: field.prompt || '',
            color: field.textColor,
            fontFamily: field.fontFamily,
            fontSize: field.size,
            fontWeight: field.bold ? 700 : 400,
            textAlign: field.textAlign
          },
          events
        );
        if (active === session) session.port = port;
        else port.close();
      } catch (error) {
        end(session, true);
        throw error;
      }
    }
  };
}

export function browserClassicEditor(sdk, canvas, game) {
  return (request, events) => {
    if (typeof sdk.createBrowserTextInput !== 'function')
      throw unsupported('Rebuild the browser bundle with the text input port.');
    const view = sdk.createBrowserTextInput({
      canvas,
      logicalWidth: game.screen.width,
      logicalHeight: game.screen.height
    });
    try {
      view.open({
        ...request,
        blur: 'commit',
        select: 'end',
        onChange: e => {
          if (!e.composing) events.change(e.value);
        },
        onCommit(value) {
          events.change(value, true);
          events.finish();
        },
        onCancel: events.finish
      });
      const field = canvas.ownerDocument.activeElement;
      if (field?.hasAttribute('data-egret-text-input')) events.focus();
      else events.finish();
      return { close: () => view.dispose(), write: value => view.setValue(value) };
    } catch (error) {
      view.dispose();
      throw error;
    }
  };
}

export function androidClassicEditor(services) {
  return (request, events) => {
    const cancel = new AbortController();
    const pending = services.editText(
      {
        text: request.value,
        multiline: request.multiline,
        inputMode: request.inputMode,
        maxLength: request.maxLength,
        digitsOnly: request.digitsOnly,
        onFocus: events.focus,
        onChange: events.change
      },
      cancel.signal
    );
    void pending.then(
      result => {
        if (cancel.signal.aborted) return;
        if (result.status === 'confirmed') events.change(result.text, true);
        events.finish();
      },
      error => {
        if (!cancel.signal.aborted) events.fail(error);
      }
    );
    return { close: () => cancel.abort() };
  };
}
