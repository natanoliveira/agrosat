FROM node:20-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1
ARG NEXT_PUBLIC_BASEMAP_URL
ARG NEXT_PUBLIC_E2E
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL NEXT_PUBLIC_BASEMAP_URL=$NEXT_PUBLIC_BASEMAP_URL NEXT_PUBLIC_E2E=$NEXT_PUBLIC_E2E
# arg vazio não pode sobrescrever o default do código (?? não cobre "")
RUN [ -n "$NEXT_PUBLIC_BASEMAP_URL" ] || unset NEXT_PUBLIC_BASEMAP_URL; npm run build

FROM node:20-slim
WORKDIR /app
ENV NODE_ENV=production PORT=3005 HOSTNAME=0.0.0.0
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
EXPOSE 3005
CMD ["node", "server.js"]
