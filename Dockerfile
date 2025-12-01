FROM node:24-alpine AS build

WORKDIR /app
RUN corepack enable pnpm && apk add --no-cache binutils
COPY pnpm-*.yaml .
RUN pnpm fetch --frozen-lockfile
COPY package.json .
RUN pnpm i --frozen-lockfile
COPY . .
RUN chmod +x bundle/*.sh && \
    pnpm run bundle && \
    bundle/generate-sea.sh /bin/degiromatic
RUN bundle/collect-deps.sh /bin/degiromatic

FROM scratch AS run

ENV DATA_DIR=/data NODE_ENV=production NODE_NO_WARNINGS=1
COPY --from=build /deps/lib /lib
COPY --from=build /deps/usr/lib /usr/lib
COPY --from=build /bin/degiromatic /bin/degiromatic

ENTRYPOINT ["/bin/degiromatic"]
