# --- Build stage: compile the React app with Vite ---
FROM node:22-alpine AS build

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# --- Serve stage: static files behind nginx ---
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
# The nginx image renders templates/*.template into conf.d/ at startup.
COPY nginx.conf.template /etc/nginx/templates/default.conf.template

# Defaults match Cloud Run; docker-compose overrides them for local runs.
ENV PORT=8080
ENV BACKEND_URL=https://millionaire-backend-251573632162.me-west1.run.app
EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
