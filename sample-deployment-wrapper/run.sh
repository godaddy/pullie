#!/usr/bin/with-contenv sh
set -e

cd /opt/pullie
exec s6-applyuidgid -u 999 -g 999 node /opt/pullie/node_modules/.bin/pullie --configPath=/opt/pullie/config/$NODE_ENV.json