FROM node:22-alpine

ENV NODE_ENV=production
WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev --no-audit

COPY . .
EXPOSE 3000
CMD ["npm", "start"]
