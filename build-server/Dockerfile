FROM node:22-bookworm-slim

RUN apt-get update \
    && apt-get install -y git bash \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /home/app

COPY main.sh script.js package*.json ./

RUN sed -i 's/\r$//' main.sh \
    && npm install \
    && chmod +x main.sh

ENTRYPOINT ["/bin/bash", "/home/app/main.sh"]
