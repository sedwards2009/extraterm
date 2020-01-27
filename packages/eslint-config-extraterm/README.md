This is the [ESLint](https://eslint.org/) configuration for Extraterm. It is used for all linting of TypeScript code.

My philosophy for applying linting are:

* **Don't be annoying** - Linting on many projects is configured to be incredibly picky and built on the expection that developers have the brain power left over to memorised a bunch of obscure code formatting rules. Beyond a base level of checks, linting, especially code formatting, becomes a drag on development.
* **Concentrate on real coding errors and error prone constructs** - There are language constructs and idioms in the JavaScript/TypeScript world which are simply  error prone, or just poor choices which have better alternatives available.
* **Don't stop the development workflow** - Linting errors/warnings are never a good reason to prevent code from building during the development workflow. Often things are incomplete and not polished during active development. Now is not the time to fail a build. That said, CI is the right time to signal a red flag if linting errors are present.
* **Understandable rules only** - Although it is possible to configure all kinds of rules around whitespace and code layout, I find that going beyond the basics often just invites obscure and pedantic errors messages where it isn't even clear to the developer what the problem or solution is. For example, there are many different ways of wrapping long lines of code but every project is configured for something different and the error messages are never clear about what is expected. This is not a helpful kind of rule to have.

-- Simon Edwards
