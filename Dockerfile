FROM node:18-alpine

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm i

COPY . .

CMD ["node", "scripts/balancing/sims.js"]