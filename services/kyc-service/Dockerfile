FROM node:20-alpine
WORKDIR /app
COPY services/kyc-service/package*.json ./
RUN npm install --production
COPY services/kyc-service/src ./src
EXPOSE 3000
CMD ["node", "src/app.js"]
