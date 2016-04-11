Theming
=======

:warning: The details of how themes work are not frozen and could change at any time in the future.

There are 3 kinds of themes in Extraterm:

* **Terminal themes** - Colors for the text in terminal output.
* **Text & Syntax themes** - Text color and styles for syntax highlighting inside frames produced by the `show` command.
* **User Interface themes** - Appearance of user interface elements such as in the Setting pane, the tab-bar and other places.

Extraterm searches for available themes in its own `theme` directory which is part of the zip package, and also in the user's home directory in `~/.config/extraterm/themes` on Linux and OSX, on Windows the directory is `%APPDATA%/extraterm/themes`.

A theme on the file system is a directory with a name which uniquely identifies the theme with respect to the other themes. Inside the theme's directory must be a `theme.json` file which describes the meta-data for the theme such as its name, a comment and also what kind of theme it is. Also inside the directory are the files needed to define the theme.

Extraterm is built on top of web technology and uses CSS internally for styling. Themes are not raw CSS though, instead themes are written using the [SASS](http://sass-lang.com) language and pre-processor, and then processed into CSS when the theme is actually used.

Examples of themes can be viewed [here in Extraterm's github repository](https://github.com/sedwards2009/extraterm/tree/master/src/themes). No strict naming system is enforced, but it is a good idea to use the `-terminal`, `-syntax` and `-ui` suffixes in the directory name to make it clear what kind of theme it is.

`default` is a special built in theme which serves as the default theme for all of Extraterm. It is alway present and every other theme is effectively replacing and overriding some of the files which are part of the default theme. For example, terminal themes replace the file in default which defines the colors for the terminal.

Themes are automatically reloaded if their files are changed.


theme.json
----------
This file must be present inside every theme directory. It contains meta-data for the theme. The format used in [JSON](http://json.org/). The available fields are:

* `name` - The name of the theme as a string. This should be suitable to show to the user and appears in the pulldown widget on the Settings tab.
* `type` - The type of the theme. This value is actually an array and may contain one of the following values: `terminal`, `syntax` or `gui` depending on the type of the theme.
* `comment` - A string giving some extra information about the theme. This is displayed in the Settings tab too.


Terminal Themes
---------------
Terminal themes consist are purely colors used for the foreground and background colors, and the colors used to render all of the different character styles.

A terminal theme replaces the `_terminal-colors.scss` file. This file contains SASS variables for controlling the colors. The following are available to set:

* `$terminal-foreground-color`
* `$terminal-background-color`
* `$terminal-color-0`
* `$terminal-color-1`
* `$terminal-color-2`
* ...
* `$terminal-color-254`
* `$terminal-color-255`
* `$terminal-cursor-foreground-color`
* `$terminal-cursor-background-color`
* `$terminal-selection-background-color`
* `$terminal-selection-unfocused-background-color`

If a variable isn't defined then the value from the default theme is used. Many terminal theme just set the first 16 colors which are most commonly used.

It is also possible to specify the color used for the dim variations. The variables are called:

* `$terminal-dim-color-0`
* `$terminal-dim-color-1`
* `$terminal-dim-color-2`
* ...
* `$terminal-dim-color-254`
* `$terminal-dim-color-255`

If a dim version of a color isn't set, then a dim version is made from its full strength counterpart by setting the transparency.

The `$terminal-dim-opacity` can be set to control how much transparency is used. This can be a value between 0.0 and 1.0. Completely transparent is 0.0 and completely opaque is 1.0.


Text & Syntax Themes
--------------------
Text and syntax highlighting themes use a `_text-colors.scss` file. This file works slightly differently than for terminal theme. This time its contents are SASS mixins which define the styling used for each type in the syntax which can be highlighted.

For example:

```
@mixin text-general {
 background: #fdf6e3;
 color: #657b83;
}
```

Inside a mixins you can specify foreground and background colors, font weight and sytles and also text decoration styles. It it is recommended that the size of each character in the text remain the same.

It is recommended to copy and rename an existing theme and modify it.


User Interface Themes
---------------------
The Extraterm user interface uses Bootstraps's CSS class system for styling. The default theme uses the plain default Bootstrap theme for UI styling. User interface themes can override Bootstrap's `bootstrap/_variables.scss` file. Some themes also override `_extraterm_bootstrap.scss` to inject some extra CSS classes.

Resources found in the theme's directory can be referenced via the special variable `$--source-dir-themename` where `themename` is the name of your theme as used in its directory name.
