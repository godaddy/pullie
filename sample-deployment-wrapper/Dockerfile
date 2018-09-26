FROM jcrugzz/alpine-node-kubernetes:8.12.0-native-intl

RUN apk add --no-cache make git gcc g++ python python-dev linux-headers py-pip && pip install python-novaclient

RUN ulimit -n 65536 && \
    addgroup -g 999 app && \
    adduser -D  -G app -s /bin/false -u 999 app

RUN mkdir -p /opt/pullie
WORKDIR /opt/pullie
COPY package.json /opt/pullie/
RUN npm install /opt/pullie
COPY . /opt/pullie

RUN chown -R app:app /opt/pullie

COPY run.sh /etc/services.d/pullie/run
RUN chmod 755 /etc/services.d/pullie/run

EXPOSE 3000
