FROM node:24-slim AS build

WORKDIR /app
COPY package*.json .
RUN npm ci
COPY . .
RUN npm run build

FROM node:24-slim AS production

WORKDIR /app
ENV NODE_ENV=production DATA_DIR=/data
COPY package*.json .
RUN npm ci
COPY --from=build /app/dist .

CMD ["node", "main.js"]
