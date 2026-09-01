/* eslint-env node, es2017 */
/**
 * Alexa skill handler for the Coventry bus app.
 *
 * Amazon verifies the request signature before this runs, so all this does is
 * turn a resolved slot into a query string, call the busapp API, and read the
 * `speech` field it returns. All timetable logic stays in the Next.js app.
 *
 * Configuration lives in config.js — Alexa-hosted skills cannot set custom
 * environment variables in the console. process.env still takes precedence, so
 * a self-managed Lambda can use real environment variables instead.
 */

const http = require("http");
const https = require("https");
const { URL } = require("url");

const config = require("./config.js");

const BASE_URL = (process.env.BUSAPP_BASE_URL || config.BUSAPP_BASE_URL || "")
  .trim()
  .replace(/\/$/, "");
const PROXY_KEY = (process.env.ALEXA_PROXY_KEY || config.ALEXA_PROXY_KEY || "").trim();

/** Alexa hard-stops at 8s; leave room to phrase a graceful failure */
const FETCH_TIMEOUT_MS = 6500;

const SKILL_NAME = "Coventry Buses";

const HELP =
  "You can ask me when the next 11 is at St Johns Church, what's leaving " +
  "Rail Station Bridge, whether the 12 X is running late, or the fastest way " +
  "to campus. Which would you like?";

/**
 * A slot resolved against a custom type carries the canonical id we want
 * ("12X", "stjohns"). Fall back to the raw spoken text — the API normalizes
 * loose input too, so an unresolved slot still usually works.
 */
function slotValue(request, name) {
  const slots = request.intent && request.intent.slots;
  const slot = slots && slots[name];
  if (!slot) return null;

  const resolutions =
    (slot.resolutions && slot.resolutions.resolutionsPerAuthority) || [];
  for (const authority of resolutions) {
    const matched =
      authority.status && authority.status.code === "ER_SUCCESS_MATCH";
    if (!matched) continue;

    const values = authority.values || [];
    const first = values[0] && values[0].value;
    if (first) return first.id || first.name;
  }
  return slot.value || null;
}

function speak(text, { endSession = true, reprompt, cardTitle } = {}) {
  const response = {
    outputSpeech: { type: "PlainText", text },
    shouldEndSession: endSession,
  };
  if (reprompt) {
    response.reprompt = { outputSpeech: { type: "PlainText", text: reprompt } };
  }
  if (cardTitle) {
    response.card = { type: "Simple", title: cardTitle, content: text };
  }
  return { version: "1.0", response };
}

/** Ask Alexa to collect one missing slot rather than guessing */
function elicitSlot(slotName, prompt, intent) {
  return {
    version: "1.0",
    response: {
      outputSpeech: { type: "PlainText", text: prompt },
      reprompt: { outputSpeech: { type: "PlainText", text: prompt } },
      directives: [{ type: "Dialog.ElicitSlot", slotToElicit: slotName, updatedIntent: intent }],
      shouldEndSession: false,
    },
  };
}

/**
 * Uses node's built-in https module rather than the modern global helpers:
 * those only exist on Node 18+, and the hosted runtime version is not ours to
 * assume. This also keeps the console's linter quiet.
 */
function callBusApp(path, params) {
  return new Promise(function (resolve, reject) {
    if (!BASE_URL) {
      reject(new Error("BUSAPP_BASE_URL is not set — fill it in config.js"));
      return;
    }

    let url;
    try {
      url = new URL(BASE_URL + path);
    } catch (err) {
      reject(new Error("BUSAPP_BASE_URL is not a valid URL: " + BASE_URL));
      return;
    }

    Object.keys(params).forEach(function (key) {
      const value = params[key];
      if (value !== null && value !== undefined && value !== "") {
        url.searchParams.set(key, String(value));
      }
    });

    const client = url.protocol === "http:" ? http : https;
    const options = {
      headers: PROXY_KEY ? { "x-alexa-proxy-key": PROXY_KEY } : {},
    };

    const req = client.get(url, options, function (res) {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", function (chunk) {
        body += chunk;
      });
      res.on("end", function () {
        if (res.statusCode !== 200) {
          /** 403 almost always means config.js and Vercel disagree on the key */
          console.error(
            "busapp returned " +
              res.statusCode +
              " for " +
              url.pathname +
              (res.statusCode === 403 ? " — ALEXA_PROXY_KEY mismatch?" : "")
          );
        }
        try {
          resolve(JSON.parse(body));
        } catch (err) {
          reject(new Error("Bad response from busapp (" + res.statusCode + ")"));
        }
      });
    });

    req.setTimeout(FETCH_TIMEOUT_MS, function () {
      const timeout = new Error("busapp timed out");
      timeout.name = "TimeoutError";
      req.destroy(timeout);
    });

    req.on("error", reject);
  });
}

/** Every intent resolves to one API call and reads back its `speech` field */
async function answer(path, params, cardFallback) {
  try {
    const data = await callBusApp(path, params);
    const text = data.speech || "I didn't get an answer from the timetable.";
    return speak(text, { cardTitle: data.cardTitle || cardFallback });
  } catch (err) {
    console.error("busapp call failed:", err);
    const timedOut = err.name === "TimeoutError";
    return speak(
      timedOut
        ? "The timetable is taking too long to answer. Try again in a moment."
        : "I couldn't reach the bus timetable just now. Try again shortly."
    );
  }
}

async function handleIntent(request) {
  const name = request.intent && request.intent.name;

  switch (name) {
    case "NextRouteAtStopIntent": {
      const route = slotValue(request, "route");
      const place = slotValue(request, "place");

      if (!route) {
        return elicitSlot("route", "Which bus? For example, the 11 or the 12 X.", request.intent);
      }
      if (!place) {
        return elicitSlot(
          "place",
          `Which stop? Try St Johns Church, New Union Street, or Rail Station Bridge.`,
          request.intent
        );
      }
      const direction = slotValue(request, "direction");
      return answer("/api/alexa/next", { route, place, direction }, SKILL_NAME);
    }

    case "NextBusAtStopIntent": {
      const place = slotValue(request, "place");
      if (!place) {
        return elicitSlot(
          "place",
          "Which stop do you want departures for?",
          request.intent
        );
      }
      const direction = slotValue(request, "direction");
      return answer("/api/alexa/next", { place, direction }, SKILL_NAME);
    }

    case "RouteStatusIntent": {
      const route = slotValue(request, "route");
      if (!route) {
        return elicitSlot("route", "Which route do you want the status of?", request.intent);
      }
      return answer("/api/alexa/delay", { route }, SKILL_NAME);
    }

    case "FastestJourneyIntent": {
      const direction = slotValue(request, "direction") || "towarwick";
      return answer("/api/alexa/fastest", { direction }, SKILL_NAME);
    }

    case "AMAZON.HelpIntent":
      return speak(HELP, { endSession: false, reprompt: HELP });

    case "AMAZON.StopIntent":
    case "AMAZON.CancelIntent":
      return speak("Safe trip.");

    case "AMAZON.NavigateHomeIntent":
      return speak("Safe trip.");

    case "AMAZON.FallbackIntent":
    default:
      return speak(`Sorry, I didn't catch that. ${HELP}`, {
        endSession: false,
        reprompt: HELP,
      });
  }
}

const handler = async (event) => {
  const request = event && event.request;

  try {
    switch (request && request.type) {
      case "LaunchRequest":
        return speak(
          "Coventry buses. Ask me for the next bus at a stop, or the fastest way to campus.",
          { endSession: false, reprompt: HELP }
        );

      case "IntentRequest":
        return await handleIntent(request);

      case "SessionEndedRequest":
        return { version: "1.0", response: { shouldEndSession: true } };

      default:
        return speak(HELP, { endSession: false, reprompt: HELP });
    }
  } catch (err) {
    console.error("handler error:", err);
    return speak("Something went wrong on my end. Please try again.");
  }
};

module.exports = { handler };
