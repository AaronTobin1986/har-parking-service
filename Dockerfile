# דימוי Playwright הרשמי — כולל Chromium וכל התלויות (גרסה תואמת ל-package.json).
FROM mcr.microsoft.com/playwright:v1.47.2-jammy

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY server.js parking.js ./

ENV NODE_ENV=production
# Cloud Run מזריק PORT (8080 כברירת מחדל); server.js מאזין עליו.
CMD ["node", "server.js"]
