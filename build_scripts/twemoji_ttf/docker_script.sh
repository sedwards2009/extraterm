#!/bin/bash

dnf install -y --nogpgcheck twitter-twemoji-fonts
cp /usr/share/fonts/twemoji/Twemoji.ttf /output
chown $USER_ID:$GROUP_ID /output/*
echo ""
echo "---------------------------------------------------------------------------"
echo "Twemoji version:"
echo ""
dnf list twitter-twemoji-fonts
echo ""
