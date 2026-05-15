FROM node:20-slim

WORKDIR /app

COPY package*.json ./
COPY app/logestoque/package.json ./app/logestoque/package.json
RUN npm ci

COPY . .

EXPOSE 4004

CMD ["npm", "start"]
