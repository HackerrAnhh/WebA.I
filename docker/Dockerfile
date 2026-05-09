FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache git

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=10000
ENV FRONTEND_DIR=/app/frontend
ENV DATA_DIR=/app/data
ENV SEED_DATA_DIR=/app/seed-data

COPY backend/package*.json ./backend/
RUN cd backend && npm ci --omit=dev

COPY backend ./backend
COPY frontend ./frontend
COPY data ./seed-data
COPY docker/entrypoint.sh /usr/local/bin/webbanai-entrypoint.sh

RUN chmod +x /usr/local/bin/webbanai-entrypoint.sh \
    && mkdir -p /app/data

WORKDIR /app/backend

EXPOSE 10000

ENTRYPOINT ["webbanai-entrypoint.sh"]
CMD ["node", "server.js"]
