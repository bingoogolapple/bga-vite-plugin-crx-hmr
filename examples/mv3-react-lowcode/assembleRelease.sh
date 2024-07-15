#!/usr/bin/env bash

pnpm release
rm ./dist/*.map
rm ./dist/*/*.map

cp -r ./dist ./mv3-react-lowcode
zip -qr mv3-react-lowcode.zip ./mv3-react-lowcode
rm -rf ./mv3-react-lowcode