FROM ubuntu:focal

RUN apt-get update \
    && apt-get install -y curl git bash \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /home/app

COPY main.sh script.js package*.json ./

# Fix Windows CRLF line endings (causes "no such file or directory" in Linux)
RUN sed -i 's/\r$//' main.sh \
    && npm install \
    && chmod +x main.sh

ENTRYPOINT ["/bin/bash", "/home/app/main.sh"]
