FROM node:22-alpine
WORKDIR /app

# Install root dependencies
COPY package*.json ./
RUN npm install

# Install frontend dependencies
COPY src/frontend/package*.json ./src/frontend/
RUN cd src/frontend && npm install

# Copy all source files
COPY . .

# Build frontend (produces src/frontend/dist/)
RUN cd src/frontend && npm run build

EXPOSE 3000

CMD ["npm", "run", "start"]
