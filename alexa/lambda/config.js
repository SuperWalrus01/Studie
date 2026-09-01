/**
 * Alexa-hosted skills cannot set custom environment variables in the console,
 * so configuration lives here instead. Fill these in **in the Alexa developer
 * console** (Code tab), not in this repo — the proxy key is a secret and this
 * file is committed.
 *
 * process.env still wins if it is set, so a self-managed Lambda can use real
 * environment variables without changing any code.
 */
module.exports = {
  /** Your deployed app, no trailing slash. e.g. "https://busapp.vercel.app" */
  BUSAPP_BASE_URL: "",

  /** Must match ALEXA_PROXY_KEY in your Vercel environment variables */
  ALEXA_PROXY_KEY: "",
};
