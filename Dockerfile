FROM node:16

RUN apt-get -y update
RUN apt-get -y upgrade
RUN apt-get install -y ffmpeg

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
# where available (npm@5+)
COPY package*.json ./

# If you are building your code for production
RUN npm ci --only=production

# Bundle app source
COPY . .

ENV PORT 80

EXPOSE 80
CMD [ "node", "index.js", "80" ]