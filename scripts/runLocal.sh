#!/usr/bin/env bash
source ~/.evoenv

export NUXT_ENV_RUN="local"

echo
echo "ENV VARS"
echo
printenv | grep NUXT
echo

vue-cli-service build --mode development --watc