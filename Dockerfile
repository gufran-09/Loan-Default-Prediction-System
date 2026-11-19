# Multi-stage production Dockerfile for Aegis Risk
# Optimized for AWS App Runner, ECS Fargate, or Kubernetes

FROM node:20-alpine AS base

# Stage 1: Install dependencies
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

# Stage 2: Build the Next.js application
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Set environment variables for build time
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV BUILD_STANDALONE=true
ENV NEXT_PUBLIC_AWS_COGNITO_USER_POOL_ID=ap-southeast-2_80G23Am1X
ENV NEXT_PUBLIC_AWS_COGNITO_CLIENT_ID=74120ugqosjjpmup4utltl1oqf
ENV AWS_REGION=ap-southeast-2

RUN npm run build

# Stage 3: Production minimal runtime runner
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Run as non-privileged security user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public

# Automatically leverage standalone output traces
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# Copy production ML models & feature schemas
COPY --from=builder --chown=nextjs:nodejs /app/ml ./ml

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
