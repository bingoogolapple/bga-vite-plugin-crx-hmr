#!/usr/bin/env bash

pnpm release
rm ./dist/*.map
rm ./dist/*/*.map

cp -r ./dist ./mv3-vue-ts-vite
zip -qr mv3-vue-ts-vite.zip ./mv3-vue-ts-vite
rm -rf ./mv3-vue-ts-vite