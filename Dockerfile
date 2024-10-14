FROM node:18-alpine
WORKDIR /app
COPY . .
RUN npm install
RUN npm install pm2@latest -g
EXPOSE 3000
CMD ["pm2-runtime", "server.js"]