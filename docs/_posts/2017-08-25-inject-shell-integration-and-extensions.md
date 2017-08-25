---
title: Inject Shell Integration and Extensions
date: 2017-08-25 22:40:00 +0100
categories:
---
The lastest release 0.27 adds a group of commands named "Inject Bash/Fish/Zsh Shell Integration". These commands are somewhat experimental and are intended for the situations where you log into a machine which doesn't have the Extraterm shell integration set up. Now you can use one of these commands to immediately set up the shell integration for that shell. It is not permanent and doesn't change or create any files. It only applies for that shell session. It also sets up any needed magic Extraterm cookies and of course works across SSH. I spend quite a bit of time digging through embedded Linux systems for my real work, and I'm starting to love having my shell and terminal work together where ever I go.

During the work for 0.27 a lot of effort went into building up a proper foundation for supporting an extension/plugin system. This is an on-going sub-project but I'm very happy with the progress so far but it will need more work before it become fully visible for the all Extraterm users.

Current development is focused on another round of bug fixes but the waiting time to 0.28 won't be as long as 0.27. After that I want to give upload and download related features attention.

-Simon
