FROM node:18-slim

WORKDIR /app

# Install production dependencies only
COPY package*.json ./
RUN npm ci --only=production

# Copy application code
COPY . .

# Add health check
HEALTHCHECK --interval=30s --timeout=3s \
  CMD curl -f http://localhost:8080/health || exit 1

# Use non-root user for security
USER node

# Set environment variables
ENV NODE_ENV=production \
    PORT=8080

EXPOSE 8080

# Use dumb-init to handle signals properly
CMD ["npm", "start"]
