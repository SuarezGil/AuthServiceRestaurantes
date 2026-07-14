FROM node:22-alpine
WORKDIR /app

COPY package*.json ./
RUN npm install --legacy-peer-deps

COPY . .
RUN mkdir -p uploads

EXPOSE 3005

CMD ["node", "index.js"]
