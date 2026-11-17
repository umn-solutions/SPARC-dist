import {
  Container,
  Text,
  Button,
  FormField,
  TextInput,
} from '../../../libs/nofbiz/nofbiz.base.js';

// ---------------------------------------------------------------------------
// TagInput
//
// Custom chip/badge free-entry input backed by FormField<string[]>.
// Extends Container so SPARC's parent lifecycle (remove, _removeChildren)
// correctly calls this component's remove() and triggers cleanup.
//
// Usage:
//   const tagField = new FormField({ value: [] });
//   const tagInput = new TagInput(tagField, { placeholder: 'Add tags...' });
//
// The external FormField is NOT disposed by TagInput.remove() -- the caller
// owns the FormField and is responsible for dispose(). TagInput only
// unsubscribes its own subscriber.
// ---------------------------------------------------------------------------

export class TagInput extends Container {
  constructor(field, props = {}) {
    const placeholder = props.placeholder || 'Type and press Enter or comma...';

    // Create the text entry field and chip row BEFORE super() so they can be
    // passed as children (using `this` before super is not allowed).
    const inputField = new FormField({ value: '' });
    const textInput = new TextInput(inputField, { placeholder });
    const chipRow = new Container([], { class: 'tag-input-chips initiative-tags' });

    super([textInput, chipRow], { class: 'tag-input-wrapper' });

    this._tagField = field;
    this._inputField = inputField;
    this._chipRow = chipRow;
    this._textInput = textInput;

    // Render initial chips from any pre-filled values.
    this._renderChips();

    // Keep chips in sync with the external field.
    this._unsub = field.subscribe(() => {
      if (!this.isAlive) return;
      this._renderChips();
    });

    // Commit on Enter or comma key. Using setEventHandler so the binding is
    // applied when TextInput renders inside this container.
    textInput.setEventHandler('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        // Read the current DOM input value via the jQuery event target.
        const raw = ($(e.target).val() || '').trim();
        $(e.target).val('');
        // Keep the field in sync with the cleared DOM input.
        this._inputField.value = '';
        const cleaned = raw.replace(/,$/, '').trim();
        if (cleaned) this._commitTag(cleaned);
      }
    });
  }

  _renderChips() {
    const tags = Array.isArray(this._tagField.value) ? this._tagField.value : [];
    const chips = tags.map((tag) =>
      new Container(
        [
          new Text(String(tag), { type: 'span', class: 'tag-chip-label' }),
          new Button('x', {
            variant: 'secondary',
            class: 'tag-chip-remove',
            onClickHandler: () => this._removeTag(tag),
          }),
        ],
        { class: 'tag-chip' },
      ),
    );
    this._chipRow.children = chips;
  }

  _commitTag(tag) {
    const current = Array.isArray(this._tagField.value) ? this._tagField.value : [];
    // Dedupe: only add if not already present (case-insensitive).
    const lowerTag = tag.toLowerCase();
    const isDuplicate = current.some((t) => t.toLowerCase() === lowerTag);
    if (!isDuplicate) {
      this._tagField.value = [...current, tag];
    }
  }

  _removeTag(tagToRemove) {
    const current = Array.isArray(this._tagField.value) ? this._tagField.value : [];
    this._tagField.value = current.filter((t) => t !== tagToRemove);
  }

  remove() {
    this._unsub?.();
    super.remove();
  }
}
