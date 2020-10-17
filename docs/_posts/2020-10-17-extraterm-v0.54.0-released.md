---
title: Extraterm v0.54.0 released
date: 2020-10-17 13:55:00 +0200
categories: release
---

This release brings the option to configure the default format for the terminal title in the session settings.

![Extra session settings](/extra_session_settings.png)

Behind the scenes the extension API was expanded to make it easy to add extra settings for evey session type.

The "Insert Emoji" command has also been added. This makes it easy to search for and insert emojis directly into your terminal without leaving Extraterm.

![Insert Emoji](/insert_emoji.png)

The GitHub emoji names are used.


**Features**

* Added "Insert Emoji" command
* Terminal titles can be set in the session settings

**Changes**

* Extra fields are available to use in terminal title formats. Data from the shell integration can be used here.

**Bug fixes**

* Fix oh-my-zsh prompt becoming corrupt. #294 (thanks aral!)
* Fix odd rendering of some box drawing characters. #296


Download it from [Github](https://github.com/sedwards2009/extraterm/releases/tag/v0.54.0)
