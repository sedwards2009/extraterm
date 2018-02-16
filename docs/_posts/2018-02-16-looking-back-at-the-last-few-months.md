---
title: Looking back at the last few months of Extraterm development
date: 2018-02-16 13:40:00 +0100
categories: blog
---

I want talk a bit about what has been going on for the last few months and where I'm thinking of taking it next. This will mostly be a mix of musings about the future and what the americans call "inside baseball".


Moving files around
===================

Version 0.30.0 represents the end of a long period "under water" working on internal infrastructure. For this project I normally like to keep a faster release cadence of about every 2 to 3 weeks, but making Extraterm happily shuffle around large files was a big job with few user visible results until the almost the end. The result was worth it though and Extraterm has a solid base for handling and moving files from the comfort of your terminal session. Large files like ISOs and movies can be downloaded using `show` and they will be temporarily spooled out to disk and not kept in memory. These temporary files are stored in encrypted form to prevent any of the data you are working on from "leaking" out to permanent storage where it could be later recovered by the unscrupulous. The encryption keys are creating on-demand and kept inside the Extraterm process (RAM) only.

All of this works via the terminal TTY interface and is transparent to SSH sessions. It can get to wherever your shell is. Because of how this works it is not the fastest way to transfer files, but it is the most convenient way most of the time. If you really need to move absolutely huge files where transfer speeds become important then you can go back to traditional tools like scp.

![Using `show` and `from` at the same time](../../../../download_upload.png)

One not so obvious feature is that it is possible to start downloading a file using `show` and in another tab immediately start reading from it using `from`. The downloaded file stays in the terminal in its frame and from there you can grab it using `from` and copy it elsewhere, or to multiple (remote) terminal sessions at the same time.

Another feature that I'm quite proud of is that you can now drag a frame containing a downloaded file directly into your computer's file manager, for Windows that is the Windows Explorer, Finder on macOS and Dolphin on KDE desktops, and others.


Internal Code Work
==================
Extraterm is a bit like a snake which after a period of steady growth needs to burst out and shed its skin for a bigger size.

An example of this has been simply organising and reorganising the source code in this project. At the start of the project it wasn't a problem to just dump the few source files in one directory, but the number of files grew of course and I've now split them up and organised them into meaningful directories related around which process they need to run in and which subsystem they implement. There is still work to do in this area, except on a higher level. Extraterm already has the beginnings of an extension/plugin system with a couple of built in extensions. The code and build system especially, need an overhaul to support working on and building many separate extensions inside the same git repository.

Another aspect of the code base which saw revision and modernisation was how the many components which make up the user interface are constructed.


Web Components
--------------
Extraterm's user interface makes use of a collection of young browser APIs called Web Components. Web Components make it possible to create new HTML tags which are also self contained and isolated from the rest of the DOM. Extraterm uses these features to break up the CSS code and keep it separated from other unrelated CSS code elsewhere. On other words, fewer CSS debugging games like "where the heck is this element getting that CSS rule from?!". This makes it possible to grow an application and still understand what its CSS code does and applies to. It also makes reusable components possible without forcing the use of one specific JS framework like React or Vue. This aspect is very useful when working with plugins/extensions because it allows extension developers to decide for themselves which framework they want to use, and it reduces the chances of different extensions conflicting with each other.

Until recently all of this Web Component code was written by hand directly on top of the browser API. Mind you, when I started work on Extraterm the Web Component specification wasn't even at version 1.0 yet and there were certainly no libraries around to make the job easier. There was no other option than to just roll up your sleeves and get your hands dirty. So I did. But eventually it comes time to strip out the boilerplate code and add some abstracts to make it smaller and manageable.

I had my sights on a library called [Stencil](https://stenciljs.com/) for a while. It was young and promising right up until I saw that it was really targeting browser environments and didn't fit well with the component based approach used in Extraterm. I liked its ideas though and but I just wanted a small micro style library to help remove most of the boilerplate code I had. Playing nice with TypeScript was also a requirement. So I had to pass on Stencil. [Polymer](https://www.polymer-project.org/) also has a focus on working with Web Components. They had a library designed to make components easier, but it was just a little bit too heavy and had slightly too many requirements for my liking. Once again it was a good source of ideas. With all these ideas gathered I made a small set of TypeScript decorators to do the job. The result can be [found here](https://github.com/sedwards2009/extraterm/tree/master/extraterm-web-component-decorators). It is TypeScript friendly, light weight and places very few demands on the code you apply it to. It also happily strips out a ton of duplication from the Extraterm code base.

Next blog post I'll talk about the possible road map and future plans.
