#!/bin/sh
cd /app
npm install --omit=dev
npx prisma migrate deploy
