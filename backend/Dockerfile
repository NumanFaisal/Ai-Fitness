FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci

# Copy application source
COPY tsconfig.json ./
COPY src ./src/
COPY db.js ./

# Build TypeScript and generate Prisma Client
RUN npm run build

# Expose server port
EXPOSE 3000

ENV PORT=3000
ENV NODE_ENV=production

# Start production server
CMD ["node", "dist/server.js"]
