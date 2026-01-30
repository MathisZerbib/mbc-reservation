FROM node:20

WORKDIR /app

COPY package*.json ./

RUN npm install

# Install CA certificates (Debian/Ubuntu base)
RUN apt-get update && apt-get install -y ca-certificates

COPY . .

RUN npx prisma generate

RUN npm run seed

CMD ["npm", "run", "dev"]
