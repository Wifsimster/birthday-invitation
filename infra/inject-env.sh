#!/bin/sh
# Script to inject environment variables into built static files at runtime

# Create a temporary env.js file with environment variables
cat > /app/dist/env.js << EOF
window.ENV = {
  VITE_BIRTHDAY_PERSON: "${BIRTHDAY_PERSON}",
  VITE_BIRTHDAY_AGE: "${BIRTHDAY_AGE}",
  VITE_EVENT_DATE: "${EVENT_DATE}",
  VITE_EVENT_TIME: "${EVENT_TIME}",
  VITE_EVENT_TOWN: "${EVENT_TOWN}",
  VITE_EVENT_LOCATION: "${EVENT_LOCATION}",
  VITE_DRESSCODE: "${DRESS_CODE}",
  VITE_API_BASE_URL: "${API_BASE_URL}"
};
EOF

echo "Environment variables injected into /app/dist/env.js"
