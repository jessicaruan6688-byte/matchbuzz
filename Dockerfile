FROM node:20-alpine

WORKDIR /app

ENV APP_HOST=0.0.0.0

COPY package.json ./
COPY server.js ./
COPY public ./public

EXPOSE 3000

CMD ["npm", "start"]
