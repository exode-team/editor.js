# exode-team/editor.js

Fork of [codex-team/editor.js](https://github.com/codex-team/editor.js) from tag v2.31.7 (Apache-2.0, see LICENSE).
Modified files carry `fork: exode-team/editor.js` on the changed members.

- `blocks.deleteById`, `blocks.moveById`: by id, the current Block and the caret stay.
- `blocks.runRemoteEdit`: a synchronous edit marked as remote, it does not reach `onChange`.
- `blocks.setInputContent`, `blocks.setData`: apply a change to a Block without losing the caret.
- `caret.getPosition`, `caret.setPosition`: caret by block id, input index and character offsets.
- Inline toolbar: `link` after `bold` and `italic`, as before 2.30.
