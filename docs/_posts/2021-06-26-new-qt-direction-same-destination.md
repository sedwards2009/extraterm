---
title: New Qt Direction, Same Destination
date: 2021-05-01 21:30:00 +0100
categories: news
---

With Extraterm I've always aimed to create a featureful, cross-platform terminal emulator which also dares to experiment with new ideas. Extraterm's design philosophy could best be described as "maximalist". It has quite a few features which you just will not find elsewhere, and my list of interesting ideas is by no means empty. But most of all Extraterm is intended to be practical and enjoyable to use. It is not just some experiment. It aims to be your daily driver.

With that said, I can state that Extraterm isn't reaching the levels of performance and responsiveness that I would like. It is sometimes said of software that "performance is a feature", and Extraterm is all about features. But first, let's have a look at how we got here.

Extraterm is built on top of Electron. It's is a great toolkit for rapidly building applications by leveraging web technology and a powerful browser engine. It is cross-platform, rich in its abilities, and has first class support for one of the most popular programming languages out there. Also not forgetting, it has access to the biggest software ecosystem on the planet. There are few platforms or toolkits which can tick all of those boxes. It is unclear whether Extraterm would exist at all if Electron wasn't available when the project was started.

But the term 'toolkit' understates the size and cost of Electron. Electron isn't so much a toolkit as it is a whole hardware store with everything from cement mixers to screws to picnic  tables. Like a big popular hardware store, Electron and the browser engine it is built on tries to be convenient and helpful to everyone, but this is a trade off, and what you are trading away is fine control over how thing are done and how computing resources are used. What the end user experiences is an application which takes longer to start up, isn't as responsive, and requires more resources like RAM compared to other more native alternatives.

To get Extraterm to the next level I can now announce that I will be moving Extraterm off Electron as its user interface toolkit and over to a [Qt](https://www.qt.io/) based interface. Qt is a mature cross-platform library for creating desktop applications. You've most likely used a few Qt applications already without even knowing it. See [List of applications which use Qt](https://en.wikipedia.org/wiki/Category:Software_that_uses_Qt)

This will not be a trival or quick transition. It will take quite some time and there will be some large holes in the feature list as previous code is updated and re-integrated into the new Qt based version. The primary goal is to get Extraterm onto Qt and back to a similar level as the existing Electron version. It may look a little different, especially with regards to the UI style, but it will still be Extraterm. I'm not planning to radically re-organise the application.

Moving to Qt is also a big opportunity to simplify the internals of Extraterm and to open the way to adding some much desired but previously hard to add features like moving tabs in and out of windows, for example.

I've created a [GitHub issue](https://github.com/sedwards2009/extraterm/issues/348) where I'll explain more of the details about how the transition will work and which features will need to be changed, dropped, or postponed. We can have a [discussion there](https://github.com/sedwards2009/extraterm/issues/348).


-- Simon Edwards, creator of Extraterm
