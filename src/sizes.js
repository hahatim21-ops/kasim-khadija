// Shared by the page (stage.js) and the build (vite.config.js, for the curtain preload).
export const DESKTOP_MIN = 601; // wider than this: framed, phone-sized stage
export const FRAME_MAX_W = 460;
// The stage is about 56.25vh wide on phones (9:16 of the screen height), FRAME_MAX_W on desktop.
export const SIZES = `(min-width: ${DESKTOP_MIN}px) ${FRAME_MAX_W}px, 56.25vh`;
