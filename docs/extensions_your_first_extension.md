---
title: Your First Extension
---

# Your First Extension

This guide runs through the work flow for a creating a very simple extension which adds a command to the command palette for typing in the current date and time.

Some familiarity with "node", "npm"/"yarn", and the command line is assumed.


## Prerequisites

* [Node JS](https://nodejs.org/en/) version 12.8.1 or later is installed.
* A recent version of Extraterm of course!

## What is an extension exactly?

An Extraterm extension is not much more than a Node module with a special `package.json` file. In fact, some useful Extraterm extensions are nothing more than a `package.json` with extra Extraterm specific fields and data added. Many aspects about what an extension does and how it integrates into Extension are defined and declared inside `package.json`.


## Step 1: Set up an empty Node project

Create a folder `first_extension` somewhere, `cd` into it and run `npm init`, answer the questions making sure to call the project `first_extension`. You will then have an empty node project.


## Step 2: Configure the extension in package.json

Open up `package.json` in you text editor and add the following key and value.

```json
  "contributes": {
    "commands": [
      {
        "command": "first_extension:now",
        "title": "Type Now",
        "category": "terminal",
        "when": "terminalFocus"
      }
    ]
  }
```

The configuration data in `package.json` defines how and where the extension "hooks" into Extraterm.

The blob of JSON code we added says that our extension adds a command which is internally identified by the name `first_extension:now`. It also has a more friendly name which the user will see, "Type Now".

Extraterm's extension API leans towards configuration inside `package.json` over doing the same using code. Some extensions such as key bindings for example, don't have any executable JavaScript code. They purely consist of configuration data inside `package.json`.


## Step 3: Add some code

Our first extension does have some JavaScript code which we need to connect to the command defined in `package.json`.

When Extraterm starts up an extension it will try to find the extension's main script by looking at the `main` field inside `package.json`. It will then load the script and run the `activate` function inside.

Every extension is passed an [`ExtensionContext`](extension_api/interfaces/extensioncontext.html) instance. This is the gateway extensions use to access the extension API and actually perform useful work inside Extraterm.

Create a file called `index.js` and copy the following code into it.

```javascript

function activate(context) {
  context.commands.registerCommand("first_extension:now", () => {
    context.window.activeTerminal.type(""+(new Date()));
  });
}

exports.activate = activate;
```

This is basically a node module which exports an `activate` function. This function receives its own context object and immediately uses it to register an (arrow) function for the `first_extension:now` command which we specified inside `package.json`.


## Step 4: Install it

When Extraterm starts up it scans a couple of folders looking for available extensions. It has its own internal folder with extensions and it also looks for user installed extensions. We need to get our new extension into this folder. For Linux and macOS this folder will be in your home folder at `~/.config/extraterm/extensions/`. On Windows it is `%APPDATA%\Roaming\extraterm\extensions`. If it doesn't exist then you can just create it.

Either copy our `first_extension` folder directly into the user extensions folder, or create a symbolic link inside this folder which leads back to our extension in a more convenient place. Extraterm will follow symbolic links in the extensions folder.


## Step 5: Fire it up

Extraterm only scans for extensions during start up, so we need to start up a new Extraterm instance.

You probably already have Extraterm running in which case you can start a new instance from the shell with the command `extraterm` or similar. The exact command needed will depend on how Extraterm is installed though. It is also possible to start Extraterm via your desktop menu or via some other graphical way, but the advantage of starting from a shell is that you can easily see the logging produced by Extraterm as it starts up. In this logging you can see which extensions Extraterm has detected and where they are located. It will find a bunch of extensions which are part of the core Extraterm application, and if our "first_extension" is installed correct, then it should also produce a line saying that it has detected it too.

After the Extraterm window appears go to the Setting page via the menu in the top right corner. The Settings page has an "Extensions" tab on the left side. This tab lists all of the available extensions. You can enable and disable as you wish. Some where in the list we should see our "first_extension".


## Step 6: What time is it?

Our extension adds a new command to the command palette. Open the command palette (`Ctrl+Shift+P` on Linux/Windows system or `Cmd-Shift-P` on macOS) and type `now`. This will filter the list of available options down to those containing the string `now`, and should see a new command "Type Now". Select that command and our extension will do its work and type the full date and time directly into your shell as though you had done it our self. Congratulations! That is your first extension done.

If selecting the "Type Now" command didn't do anything then move on to the next guide where we discuss [logging and debugging](extensions_logging_and_debugging.md).

Next: [Logging and Debugging Extensions](extensions_logging_and_debugging.md)
