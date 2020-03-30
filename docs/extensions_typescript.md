---
title: Using TypeScript in Extensions
---

# Using TypeScript in Extensions

This guide explains how to write Extraterm extensions using [TypeScript](https://www.typescriptlang.org/). Extraterm itself and the core extensions which ship as part of Extratern, are written using TypeScript. As such the Extraterm extension API has complete type definitions.


## Adding the Extraterm extension type definitions

Extraterm's type definitions for the extension API are available on [npmjs.com](https://www.npmjs.com/package/@extraterm/extraterm-extension-api). They can be added to your project using either `npm` or `yarn`:

```
npm install @extraterm/extraterm-extension-api --save-dev
```

or

```
yarn add @extraterm/extraterm-extension-api
```

## Correct types for the activate() function

The example below shows the correct typing for an extension's `activate()` function. Note that we can also use an ES6 style export to expose the `activate()` function.

```typescript
import { ExtensionContext, Logger } from '@extraterm/extraterm-extension-api';

let log: Logger = null;

export function activate(context: ExtensionContext): any {
  log = context.logger;
  //...
}
```

Getting the type of the `context` parameter makes it much easier to get the correct types for everything else.


## Suggested Project Structure

Extraterm has few requirements for how extensions are built or how their source code is organized. This is just a suggested layout for an Extraterm extension which uses TypeScript.

Folder layout:

```
my_extension/ -+- dist/
               +- src/
               +- LICENSE.txt
               +- package.json
               +- README.md
               +- tsconfig.json
```

The project source code lives under the `src/` folder.

The `dist/` folder contains the output from the TypeScript compiler. It doesn't need to be created or added to git, but you will need to make sure that `main` setting in `package.json` points to the correct output file in `dist/`.

`LICENSE.txt` contains the license information for you extension.

`README.md` simply is some written information about your extension, what it does, who made it etc.


## TypeScript compiler configuration in `tsconfig.json`

`tsconfig.json` is the configuration for the TypeScript compiler to use. A suggested `tsconfig.json` is shown here below. Compiles all TypeScript code from `src/` into `dist/`.


```json
{
    "compilerOptions": {
        "baseUrl": ".",
        "declaration": true,
        "emitDecoratorMetadata": true,
        "experimentalDecorators": true,
        "module": "commonjs",
        "noImplicitAny": false,
        "noImplicitReturns": true,
        "noImplicitThis": true,
        "noLib": false,
        "outDir": "dist",
        "removeComments": false,
        "rootDir": "src",
        "sourceMap": true,
        "target": "es6",
    },
    "include": [
        "./src/**/*.ts"
    ]
}
```

## Scripts in `package.json`

We don't need many npm scripts in this simple set up. Just one to run the TypeScript compiler and possibly another `clean` command to clean out the contents of `dist/`.

```json
  "scripts": {
    "build": "tsc",
    "clean": "rimraf dist"
  }
```

## Extras

This is merely a simple starting point for the tooling around an ExtraTerm extension. It is of course possible to add linting, style checking, unit test support, bundling, and other things, but that is beyond the scope of this documentation.
