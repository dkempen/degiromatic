FROM node:26-alpine AS build

WORKDIR /app
RUN npm i -g pnpm@12
COPY pnpm-*.yaml .
RUN pnpm fetch
COPY package.json .
RUN pnpm i --frozen-lockfile --offline
COPY . .
RUN pnpm run bundle && pnpm pack-app --entry dist/bundle/main.cjs --target "linux-$(node -p "process.arch")-musl"
RUN BIN="$(find /app/dist-app -type f -name degiromatic -print -quit)" && \
    install -D "$BIN" /degiromatic/bin/degiromatic && \
    ldd "$BIN" | awk '{print $3}' | grep '^/' | while read -r lib; do \
        install -D "$lib" "/degiromatic$lib"; \
    done

FROM scratch AS run

COPY --from=build /degiromatic /

ENTRYPOINT ["/bin/degiromatic"]
