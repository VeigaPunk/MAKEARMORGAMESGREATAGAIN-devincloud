# The Impossible Game

Three authored courses built around the reference's fixed-speed, fixed-jump precision loop: First Light, Cold Front and Last Ember. Normal clears unlock the next course. Practice provides checkpoint flags and separate records; a practice clear never unlocks a normal-course medal or record.

- Space, Up, Z, click or touch-down: jump. R: retry. Escape: pause.
- Toolbar controls remain usable on phones. Losing focus pauses the run.
- Death restarts in 160 ms. Jump presses shorter than a rendered frame are latched.
- Physics runs at 120 Hz; drawing and the original synth score follow the run without changing collision.
- Courses and saves are tested through complete legal jump sequences. Shared input and malformed numeric save recovery are covered by the release gate.

From the repository root: `npm run build && npm start`. For live development, from the monorepo: `npm run dev:impossible`.

The art, soundtrack and later course layouts are authored for this remake; they are not copied original assets or an assertion of exact original-level geometry.
