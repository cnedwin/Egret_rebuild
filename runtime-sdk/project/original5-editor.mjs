// SPDX-License-Identifier: Apache-2.0
/** Egret 5's InputController owns focus and text filtering. This port owns one OS editing session. */
export function installOriginal5Editor(egret, services) {
  const previous = egret.StageText;
  let active, failure;
  class StageText extends egret.EventDispatcher {
    #text = '';
    #field;
    #session;
    #focused = false;

    $setTextField(field) { this.#field = field; }
    $setText(value) { this.#text = String(value ?? ''); }
    $getText() { return this.#text; }
    $addToStage() {}
    $removeFromStage() { this.$hide(); }
    $resetStageText() {}
    $setColor() {}
    $onBlur() {}

    $show() {
      if (this.#session || !this.#field?.stage || services.signal.aborted) return;
      active?.$hide();
      const field = this.#field;
      const euiPasswordPrompt = field.$isShowPrompt === true && field.$EditableText?.[2] === true;
      if (field.displayAsPassword || field.inputType === 'password' || euiPasswordPrompt) {
        throw new Error('Original 5 password input requires a secure native editor');
      }
      const session = new AbortController();
      this.#session = session;
      active = this;
      const change = value => {
        if (session !== this.#session || value === this.#text) return;
        this.#text = value;
        this.dispatchEventWith('updateText');
      };
      const finish = () => { if (this.#session === session) this.$hide(); };
      const options = {
        // EUI can paint a prompt into StageText while exposing an empty editable value.
        text: field.text ?? this.#text, multiline: !!field.multiline,
        inputMode: field.inputType === 'tel' ? 'tel' : 'text',
        onFocus: () => {
          if (session === this.#session && !this.#focused) {
            this.#focused = true;
            this.dispatchEventWith('focus');
          }
        }, onChange: change
      };
      if (field.maxChars > 0) options.maxLength = Math.min(8192, field.maxChars);
      try {
        services.editText(options, session.signal).then(result => {
          if (result.status === 'confirmed') change(result.text);
        }).catch(error => {
          if (!session.signal.aborted) failure ??= error;
        }).finally(finish);
      } catch (error) {
        finish();
        throw error;
      }
    }
    $hide() {
      const session = this.#session;
      if (!session) return;
      this.#session = undefined;
      if (active === this) active = undefined;
      session.abort();
      if (this.#focused) {
        this.#focused = false;
        this.dispatchEventWith('blur');
      }
    }
  }
  egret.StageText = StageText;
  return {
    flush() { if (failure) throw failure; },
    pause() { active?.$hide(); },
    close() {
      try { active?.$hide(); }
      finally { if (egret.StageText === StageText) egret.StageText = previous; }
    }
  };
}
