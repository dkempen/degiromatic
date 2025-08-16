FROM node:24-alpine AS build

WORKDIR /app
RUN npm i -g clean-modules
COPY package*.json .
RUN npm ci
COPY . .
RUN npm run build
RUN npm prune --omit=dev
RUN clean-modules clean -y "**/*.d.ts"
RUN find node_modules -type d -empty -delete

FROM gcr.io/distroless/nodejs24-debian12 AS production

WORKDIR /app
ENV NODE_ENV=production DATA_DIR=/data
COPY --from=build /app/node_modules node_modules
COPY --from=build /app/dist .

CMD ["src/main.js"]
