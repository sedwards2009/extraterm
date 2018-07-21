/*
 * Copyright 2018 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */

export interface ThemeSyntaxPreviewContents {
  name: string;
  text: string;
  mimeType: string;
}

export const ThemeSyntaxPreviewContents: ThemeSyntaxPreviewContents[] = [
  { name: "Plain Text", mimeType: "text/plain", text: `Lorem ipsum dolor sit amet, consetetur sadipscing elitr, sed diam nonumy eirmod tempor invidunt ut labore et dolore magna aliquyam erat, sed diam voluptua. At vero eos et accusam et justo duo dolores et ea rebum. Stet clita kasd gubergren, no sea takimata sanctus est Lorem ipsum dolor sit amet. Lorem ipsum dolor sit amet, consetetur sadipscing elitr, sed diam nonumy eirmod tempor invidunt ut labore et dolore magna aliquyam erat, sed diam voluptua. At vero eos et accusam et justo duo dolores et ea rebum. Stet clita kasd gubergren, no sea takimata sanctus est Lorem ipsum dolor sit amet. Lorem ipsum dolor sit amet, consetetur sadipscing elitr, sed diam nonumy eirmod tempor invidunt ut labore et dolore magna aliquyam erat, sed diam voluptua. At vero eos et accusam et justo duo dolores et ea rebum. Stet clita kasd gubergren, no sea takimata sanctus est Lorem ipsum dolor sit amet.

Duis autem vel eum iriure dolor in hendrerit in vulputate velit esse molestie consequat, vel illum dolore eu feugiat nulla facilisis at vero eros et accumsan et iusto odio dignissim qui blandit praesent luptatum zzril delenit augue duis dolore te feugait nulla facilisi. Lorem ipsum dolor sit amet, consectetuer adipiscing elit, sed diam nonummy nibh euismod tincidunt ut laoreet dolore magna aliquam erat volutpat.
  ` },
  
  { name: "Batch file", mimeType: "application/bat", text: `:: batch file highlighting in Ace!
@echo off

CALL set var1=%cd%
echo unhide everything in %var1%!

:: FOR loop in bat is super strange!
FOR /f "tokens=*" %%G IN ('dir /A:D /b') DO (
echo %var1%%%G
attrib -r -a -h -s "%var1%%%G" /D /S
)

pause

REM that's all
`},

{ name: "CSS", mimeType: "text/css", text: `.text-layer {
    font: 12px Monaco, "Courier New", monospace;
    font-size: 3vmin;
    cursor: text;
}

.blinker {
    animation: blink 1s linear infinite alternate;
}

@keyframes blink {
    0%, 40% {
        opacity: 0; /*
        */
        opacity: 1
    }

    40.5%, 100% {
        opacity: 1
    }
}

@document url(http://c9.io/), url-prefix(http://ace.c9.io/build/),
   domain(c9.io), regexp("https:.*") /**/
{
    /**/
    img[title]:before 
    {
        content: attr(title) "\AImage \
            retrieved from"
            attr(src); /*
            */
        white-space: pre;
        display: block;
        background: url(asdasd); "err
    }
}

@viewport {
    min-zoom: 1;
    max-zoom: 200%;
    user-zoom: fixed;
}
`},

{ name: "Diff", mimeType: "text/x-diff", text: `diff --git a/lib/ace/edit_session.js b/lib/ace/edit_session.js
index 23fc3fc..ed3b273 100644
--- a/lib/ace/edit_session.js
+++ b/lib/ace/edit_session.js
@@ -51,6 +51,7 @@ var TextMode = require("./mode/text").Mode;
 var Range = require("./range").Range;
 var Document = require("./document").Document;
 var BackgroundTokenizer = require("./background_tokenizer").BackgroundTokenizer;
+var SearchHighlight = require("./search_highlight").SearchHighlight;
 
 /**
  * class EditSession
@@ -307,6 +308,13 @@ var EditSession = function(text, mode) {
         return token;
     };
 
+    this.highlight = function(re) {
+        if (!this.$searchHighlight) {
+            var highlight = new SearchHighlight(null, "ace_selected-word", "text");
+            this.$searchHighlight = this.addDynamicMarker(highlight);
+        }
+        this.$searchHighlight.setRegexp(re);
+    }
     /**
     * EditSession.setUndoManager(undoManager)
     * - undoManager (UndoManager): The new undo manager
@@ -556,7 +564,8 @@ var EditSession = function(text, mode) {
             type : type || "line",
             renderer: typeof type == "function" ? type : null,
             clazz : clazz,
-            inFront: !!inFront
+            inFront: !!inFront,
+            id: id
         }
 
         if (inFront) {
diff --git a/lib/ace/editor.js b/lib/ace/editor.js
index 834e603..b27ec73 100644
--- a/lib/ace/editor.js
+++ b/lib/ace/editor.js
@@ -494,7 +494,7 @@ var Editor = function(renderer, session) {
      * Emitted when a selection has changed.
      **/
     this.onSelectionChange = function(e) {
-        var session = this.getSession();
+        var session = this.session;
 
         if (session.$selectionMarker) {
             session.removeMarker(session.$selectionMarker);
@@ -509,12 +509,40 @@ var Editor = function(renderer, session) {
             this.$updateHighlightActiveLine();
         }
 
-        var self = this;
-        if (this.$highlightSelectedWord && !this.$wordHighlightTimer)
-            this.$wordHighlightTimer = setTimeout(function() {
-                self.session.$mode.highlightSelection(self);
-                self.$wordHighlightTimer = null;
-            }, 30, this);
+        var re = this.$highlightSelectedWord && this.$getSelectionHighLightRegexp()
     };
diff --git a/lib/ace/search_highlight.js b/lib/ace/search_highlight.js
new file mode 100644
index 0000000..b2df779
--- /dev/null
+++ b/lib/ace/search_highlight.js
@@ -0,0 +1,3 @@
+new
+empty file`},

{ name: "Dockerfile", mimeType: "text/x-dockerfile", text: `#
# example Dockerfile for http://docs.docker.io/en/latest/examples/postgresql_service/
#

FROM ubuntu
MAINTAINER SvenDowideit@docker.com

# Add the PostgreSQL PGP key to verify their Debian packages.
# It should be the same key as https://www.postgresql.org/media/keys/ACCC4CF8.asc 
RUN apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys B97B0AFCAA1A47F044F244A07FCC7D46ACCC4CF8

# Add PostgreSQL's repository. It contains the most recent stable release
#     of PostgreSQL, \`\`9.3\`\`.
RUN echo "deb http://apt.postgresql.org/pub/repos/apt/ precise-pgdg main" > /etc/apt/sources.list.d/pgdg.list

# Update the Ubuntu and PostgreSQL repository indexes
RUN apt-get update

# Install \`\`python-software-properties\`\`, \`\`software-properties-common\`\` and PostgreSQL 9.3
#  There are some warnings (in red) that show up during the build. You can hide
#  them by prefixing each apt-get statement with DEBIAN_FRONTEND=noninteractive
RUN apt-get -y -q install python-software-properties software-properties-common
RUN apt-get -y -q install postgresql-9.3 postgresql-client-9.3 postgresql-contrib-9.3

# Note: The official Debian and Ubuntu images automatically \`\`apt-get clean\`\`
# after each \`\`apt-get\`\` 

# Run the rest of the commands as the \`\`postgres\`\` user created by the \`\`postgres-9.3\`\` package when it was \`\`apt-get installed\`\`
USER postgres

# Create a PostgreSQL role named \`\`docker\`\` with \`\`docker\`\` as the password and
# then create a database \`docker\` owned by the \`\`docker\`\` role.
# Note: here we use \`\`&&\\\`\` to run commands one after the other - the \`\`\\\`\`
#       allows the RUN command to span multiple lines.
RUN    /etc/init.d/postgresql start &&\\
    psql --command "CREATE USER docker WITH SUPERUSER PASSWORD 'docker';" &&\\
    createdb -O docker docker

# Adjust PostgreSQL configuration so that remote connections to the
# database are possible. 
RUN echo "host all  all    0.0.0.0/0  md5" >> /etc/postgresql/9.3/main/pg_hba.conf

# And add \`\`listen_addresses\`\` to \`\`/etc/postgresql/9.3/main/postgresql.conf\`\`
RUN echo "listen_addresses='*'" >> /etc/postgresql/9.3/main/postgresql.conf

# Expose the PostgreSQL port
EXPOSE 5432

# Add VOLUMEs to allow backup of config, logs and databases
VOLUME	["/etc/postgresql", "/var/log/postgresql", "/var/lib/postgresql"]

# Set the default command to run when starting the container
CMD ["/usr/lib/postgresql/9.3/bin/postgres", "-D", "/var/lib/postgresql/9.3/main", "-c", "config_file=/etc/postgresql/9.3/main/postgresql.conf"]`},

{ name: "HTML", mimeType: "text/html", text: `<!DOCTYPE html>
<html>
    <head>

    <style type="text/css">
        .text-layer {
            font-family: Monaco, "Courier New", monospace;
            font-size: 12px;
            cursor: text;
        }
    </style>

    </head>
    <body>
        <h1 style="color:red">Juhu Kinners</h1>
    </body>
</html>`},

{ name: "PowerShell", mimeType: "application/x-powershell", text: `# This is a simple comment
function Hello($name) {
  Write-host "Hello $name"
}

function add($left, $right=4) {
    if ($right -ne 4) {
        return $left
    } elseif ($left -eq $null -and $right -eq 2) {
        return 3
    } else {
        return 2
    }
}

$number = 1 + 2;
$number += 3

Write-Host Hello -name "World"

$an_array = @(1, 2, 3)
$a_hash = @{"something" = "something else"}

& notepad .\readme.md
`},


  { name: "SH", mimeType: "application/x-sh", text: `#!/bin/sh

# Script to open a browser to current branch
# Repo formats:
# ssh   git@github.com:richo/gh_pr.git
# http  https://richoH@github.com/richo/gh_pr.git
# git   git://github.com/richo/gh_pr.git

username=\`git config --get github.user\`

get_repo() {
    git remote -v | grep \${@:-$username} | while read remote; do
      if repo=\`echo $remote | grep -E -o "git@github.com:[^ ]*"\`; then
          echo $repo | sed -e "s/^git@github\\.com://" -e "s/\\.git$//"
          exit 1
      fi
      if repo=\`echo $remote | grep -E -o "https?://([^@]*@)?github.com/[^ ]*\\.git"\`; then
          echo $repo | sed -e "s|^https?://||" -e "s/^.*github\.com\\///" -e "s/\\.git$//"
          exit 1
      fi
      if repo=\`echo $remote | grep -E -o "git://github.com/[^ ]*\\.git"\`; then
          echo $repo | sed -e "s|^git://github.com/||" -e "s/\\.git$//"
          exit 1
      fi
    done

    if [ $? -eq 0 ]; then
        echo "Couldn't find a valid remote" >&2
        exit 1
    fi
}

echo \${#x[@]}

if repo=\`get_repo $@\`; then
    branch=\`git symbolic-ref HEAD 2>/dev/null\`
    echo "http://github.com/$repo/pull/new/\${branch##refs/heads/}"
else
    exit 1
fi
`},

{ name: "XML", mimeType: "text/xml", text:
`<?xml version="1.0" encoding="UTF-8"?>
<query xmlns:yahoo="http://www.yahooapis.com/v1/base.rng"
    yahoo:count="7" yahoo:created="2011-10-11T08:40:23Z" yahoo:lang="en-US">
    <diagnostics>
        <publiclyCallable>true</publiclyCallable>
        <url execution-start-time="0" execution-stop-time="25" execution-time="25"><![CDATA[http://where.yahooapis.com/v1/continents;start=0;count=10]]></url>
        <user-time>26</user-time>
        <service-time>25</service-time>
        <build-version>21978</build-version>
    </diagnostics> 
    <results>
        <place xmlns="http://where.yahooapis.com/v1/schema.rng"
            xml:lang="en-US" yahoo:uri="http://where.yahooapis.com/v1/place/24865670">
            <woeid>24865670</woeid>
            <placeTypeName code="29">Continent</placeTypeName>
            <name>Africa</name>
        </place>
        <place xmlns="http://where.yahooapis.com/v1/schema.rng"
            xml:lang="en-US" yahoo:uri="http://where.yahooapis.com/v1/place/24865675">
            <woeid>24865675</woeid>
            <placeTypeName code="29">Continent</placeTypeName>
            <name>Europe</name>
        </place>
        <place xmlns="http://where.yahooapis.com/v1/schema.rng"
            xml:lang="en-US" yahoo:uri="http://where.yahooapis.com/v1/place/24865673">
            <woeid>24865673</woeid>
            <placeTypeName code="29">Continent</placeTypeName>
            <name>South America</name>
        </place>
        <place xmlns="http://where.yahooapis.com/v1/schema.rng"
            xml:lang="en-US" yahoo:uri="http://where.yahooapis.com/v1/place/28289421">
            <woeid>28289421</woeid>
            <placeTypeName code="29">Continent</placeTypeName>
            <name>Antarctic</name>
        </place>
        <place xmlns="http://where.yahooapis.com/v1/schema.rng"
            xml:lang="en-US" yahoo:uri="http://where.yahooapis.com/v1/place/24865671">
            <woeid>24865671</woeid>
            <placeTypeName code="29">Continent</placeTypeName>
            <name>Asia</name>
        </place>
        <place xmlns="http://where.yahooapis.com/v1/schema.rng"
            xml:lang="en-US" yahoo:uri="http://where.yahooapis.com/v1/place/24865672">
            <woeid>24865672</woeid>
            <placeTypeName code="29">Continent</placeTypeName>
            <name>North America</name>
        </place>
        <place xmlns="http://where.yahooapis.com/v1/schema.rng"
            xml:lang="en-US" yahoo:uri="http://where.yahooapis.com/v1/place/55949070">
            <woeid>55949070</woeid>
            <placeTypeName code="29">Continent</placeTypeName>
            <name>Australia</name>
        </place>
    </results>
</query>
`},

{ name: "YAML", mimeType: "text/yaml", text: `# This sample document was taken from wikipedia:
# http://en.wikipedia.org/wiki/YAML#Sample_document
---
receipt:     Oz-Ware Purchase Invoice
date:        2007-08-06
customer:
    given:   Dorothy
    family:  Gale

items:
    - part_no:   'A4786'
      descrip:   Water Bucket (Filled)
      price:     1.47
      quantity:  4

    - part_no:   'E1628'
      descrip:   High Heeled "Ruby" Slippers
      size:      8
      price:     100.27
      quantity:  1

bill-to:  &id001
    street: |
            123 Tornado Alley
            Suite 16
    city:   East Centerville
    state:  KS

ship-to:  *id001

specialDelivery:  >
    Follow the Yellow Brick
    Road to the Emerald City.
    Pay no attention to the
    man behind the curtain.
`},

];
