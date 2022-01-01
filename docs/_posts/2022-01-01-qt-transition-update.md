---
title: Update on Move to Qt
date: 2022-01-01 16:00:00 +0100
categories: news
---

It has been just over 6 months since I [announced the plan](http://extraterm.org/news/2021/06/26/new-qt-direction-same-destination.html) to move Extraterm away from being an Electron application to one based on [Qt](https://www.qt.io/) and [NodeJS](https://nodejs.org/en/) with the help of [NodeGui](https://github.com/nodegui/nodegui). The goal being to improve resource usage, stability, and performance.

Technical work has been ongoing and I can say it is progressing well. I have limited time to spend on this project, but it is a fairly constant amount per day. The project is roughly where I expected it to be when I started 6 months ago.

So, where is the Qt version now exactly? What is present and working?

* Terminal emulation works fine, also rendering, ligatures, hyperlinks, and styles.
* The dark flat modern visual style. It looks very close to the classic Electron based application. (There is no native visual style at the moment and it isn't a high priority.)
* Tabs (but they just say "Terminal" for now)
* Frames work, but many of the associated actions around them don't.
* Command Palette is there and works.
* Context menus work too.
* General Settings is present but some of the settings don't do anything yet.
* Appearance Settings is half complete. The preview is missing and so are the Interface related controls.
* Session Types Settings is there, but the "Tab Title" configuration stuff isn't.
* Keybindings Settings does't exist yet.
* Frames Settings is complete.
* Extensions Settings is complete.
* Half of the extensions work.

The Qt version feels much snappier than the previous Electron based one. This is most noticeable when you resize the window. It updates and redraws immediately with no "jank" in between. Resource usage is also much lower than before and closer to what you would expect from a smallish Qt application, even one which requires a non-trivial JS engine like V8 in order to run. Don't expect it to compete on resource usage though with these super-minimal terminals which only render a grid of cells and have only a JSON file as their UI. That is not the game Extraterm is playing.

While talking about performance, the rendering system right now is not directly hardware accelerated in the OpenGL sense of the word. I just have a straight forward approach implemented right now for drawing and it feels fine to use for now although I haven't done any benchmark or optimisation work yet. Later on once things are more feature complete I start looking closer at raw rendering speed.

There are still quite a lot of things missing:

* Borderless windows
* Tray icon and menu
* Multiple window support
* Drag and drop
* Find-in-terminal
* Tab title customisation
* Filling in the extension support
* Image viewer
* Remaining frame actions
* A mega-ton of testing and tweaking
* Anything else I forgot

My short term goal is to get regular packages and releases happening so that people can start playing around with the new Qt version. Then development can move towards a tighter develop ➡️ release ➡️ feedback cycle instead of going into submarine mode for months at a time.

I also picked up an extra, but related, side-project in 2021, [NodeGui](https://github.com/nodegui/nodegui) itself. Much of my development effort is split between Extraterm and [NodeGui](https://github.com/nodegui/nodegui), improving both. Extraterm is very useful real world test case for NodeGui and exposes the areas where NodeGui needs more work. If you are JavaScript developer using NodeGui or looking for a desktop GUI toolkit, then you can already benefit from the work of the last 6 months.

It will take patience, but 2022 looks to be a great year for Extraterm.
