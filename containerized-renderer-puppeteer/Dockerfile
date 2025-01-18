FROM node:18

RUN apt-get update \
    && apt-get install -y chromium \
    fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-kacst fonts-freefont-ttf libxss1 \
    --no-install-recommends

USER node

WORKDIR /app

COPY --chown=node package.json .
COPY --chown=node package-lock.json .

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome


RUN npm install

COPY --chown=node . /app

RUN npm run build

EXPOSE 8080

CMD ["npm", "start"]
