http://modeling-languages.com/javascript-drawing-libraries-diagrams/


Testing components in Chrome or Chromium
========================================
Run `npm run serve-test` start up a small webserver and then open http://localhost:3000/guitest.html to view the test page to the components.


Tools to help debug the emulation
=================================

ttyrec - Terminal sessions recorder.
teseq - Output stream and control stream decoder.


Clean up TODO
=============
* Move to the Custom Elements v1 spec. No more registerElement(). (Need Electron 1.6 and an updated nodejs.)
* Eliminate the init() thing in the elements.


Memory Leaks: Lessons Learnt
============================

Known Bug: lit-html memory leak: https://github.com/Polymer/lit-html/issues/1416
Tip: `Detached ShadowRoots` are useful for finding our custom elements.
Tip: Mark interesting elements with a 'time' child node. It is easy to find in the memory debugger.
Tip: Closures can easily generate memory leaks. => Closure scope should be restricted and limited.
Tip: `WeakMap` can generate a memory leak if the `value` has a reference to the `key`.
Tip: If you print an object directly into `console.log()` then the console viewer will hold a reference to that object.
