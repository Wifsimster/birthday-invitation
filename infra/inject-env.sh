#!/bin/sh
# Inject runtime configuration into the built SPA as dist/env.js.
#
# Values are JSON-encoded with Node so any quote, backslash, newline or
# "</script>" in operator-supplied text (e.g. EVENT_LOCATION, DRESS_CODE) stays
# valid JS instead of producing a broken — or injectable — env.js.
set -e

node -e '
const e = process.env;
const fs = require("fs");
const env = {
  VITE_BIRTHDAY_PERSON: e.BIRTHDAY_PERSON || "",
  VITE_BIRTHDAY_AGE: e.BIRTHDAY_AGE || "",
  VITE_EVENT_DATE: e.EVENT_DATE || "",
  VITE_EVENT_TIME: e.EVENT_TIME || "",
  VITE_EVENT_TOWN: e.EVENT_TOWN || "",
  VITE_EVENT_LOCATION: e.EVENT_LOCATION || "",
  VITE_DRESSCODE: e.DRESS_CODE || "",
  VITE_EVENT_RSVP_DEADLINE: e.EVENT_RSVP_DEADLINE || "",
  VITE_API_BASE_URL: e.API_BASE_URL || ""
};
fs.writeFileSync("/app/dist/env.js", "window.ENV = " + JSON.stringify(env, null, 2) + ";\n");
'

echo "Environment variables injected into /app/dist/env.js"
