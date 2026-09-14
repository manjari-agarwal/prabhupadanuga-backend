FROM node:20-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

COPY src ./src
COPY package.json ./

EXPOSE 5000
USER node
CMD ["node", "src/server.js"]
