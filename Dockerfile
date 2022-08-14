FROM node:alpine AS runner
RUN apk add ffmpeg
RUN mkdir -p /opt/app

WORKDIR /opt/app

ENV NODE_ENV production
ENV PORT 80

RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001

COPY ./package.json /opt/app/package.json
COPY ./index.js /opt/app/index.js
COPY ./start.sh /opt/app/start.sh
RUN chmod +x /opt/app/start.sh

USER nextjs

ENTRYPOINT ["/opt/app/start.sh"]