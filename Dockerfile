FROM node:22-alpine AS build

WORKDIR /app
RUN apk add --no-cache binutils
COPY package*.json .
RUN npm ci
COPY . .
RUN npm run bundle && bundle/generate-sea.sh /bin/degiromatic
RUN bundle/collect-deps.sh /bin/degiromatic

FROM scratch AS run

ENV NODE_NO_WARNINGS=1 NODE_ENV=production DATA_DIR=/data
COPY --from=build /deps/lib /lib
COPY --from=build /deps/usr/lib /usr/lib
COPY --from=build /bin/degiromatic /bin/degiromatic

ENTRYPOINT ["/bin/degiromatic"]
