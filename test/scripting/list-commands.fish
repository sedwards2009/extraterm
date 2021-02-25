#!env fish

set BASE_URL (cat ~/.config/extraterm/ipc.run)
echo $BASE_URL
curl -d '{"command": "extraterm:window.listAll"}' -H 'Content-Type: application/json' $BASE_URL/command
