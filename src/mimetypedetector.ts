/*
 * Copyright 2016 Simon Edwards <simon@simonzone.com>
 *
 * This source code is licensed under the MIT license which is detailed in the LICENSE.txt file.
 */
import jschardet = require('jschardet');

export interface DetectionResult {
  readonly mimeType: string;
  readonly charset: string;
}

const SAMPLE_SIZE = 1024;

/**
 * Detect the mimetype of a file based on its filename and the first part of its contents.
 * 
 * @param filename the filename to check
 * @param buffer string of bytes containing the first part of the file
 * @return the results of the detection or null if the type could not be detected.
 */
export function detect(filename: string=null, buffer: Buffer=null): DetectionResult | null {
  if (filename !== null) {
    const mimeType = filenameToTextMimetype(filename);
    if (mimeType !== null) {
      return {mimeType, charset: null };
    }

    const imageMimeType = filenameToImageMimetype(filename);
    if (imageMimeType !== null) {
      return { mimeType: imageMimeType, charset: null };
    }
  }

  // Check the data directly.
  if (buffer !== null) {
    const mimeType = magicToMimeType(buffer);
    if (mimeType !== null) {
      return {mimeType, charset: null };
    }

    if ( ! isNotText(buffer)) {
      const result = jschardet.detect(buffer.slice(0, SAMPLE_SIZE).toString());
      if (result.encoding !== null && result.confidence > 0.8) {
        return { mimeType: "text/plain", charset: result.encoding };
      }
    }
  }

  return { mimeType: "application/octet-stream", charset: null };
}

interface ModeInfo {
  name: string;
  mode: string;
  mime?: string;
  mimes?: string[];
  ext?: string[];
  file?: string;
  alias?: string[];
}

// This little database is from CodeMirros' meta.js file which summerizes the supported syntax highlighting modes.
const modeInfo: ModeInfo[] = [
  {name: "APL", mime: "text/apl", mode: "apl", ext: ["dyalog", "apl"]},
  {name: "PGP", mimes: ["application/pgp", "application/pgp-keys", "application/pgp-signature"], mode: "asciiarmor", ext: ["pgp"]},
  {name: "ASN.1", mime: "text/x-ttcn-asn", mode: "asn.1", ext: ["asn", "asn1"]},
  {name: "Asterisk", mime: "text/x-asterisk", mode: "asterisk", file: "^extensions\.conf$"},
  {name: "Brainfuck", mime: "text/x-brainfuck", mode: "brainfuck", ext: ["b", "bf"]},
  {name: "C", mime: "text/x-csrc", mode: "clike", ext: ["c", "h"]},
  {name: "C++", mime: "text/x-c++src", mode: "clike", ext: ["cpp", "c++", "cc", "cxx", "hpp", "h++", "hh", "hxx"], alias: ["cpp"]},
  {name: "Cobol", mime: "text/x-cobol", mode: "cobol", ext: ["cob", "cpy"]},
  {name: "C#", mime: "text/x-csharp", mode: "clike", ext: ["cs"], alias: ["csharp"]},
  {name: "Clojure", mime: "text/x-clojure", mode: "clojure", ext: ["clj"]},
  {name: "Closure Stylesheets (GSS)", mime: "text/x-gss", mode: "css", ext: ["gss"]},
  {name: "CMake", mime: "text/x-cmake", mode: "cmake", ext: ["cmake", "cmake.in"], file: "^CMakeLists.txt$"},
  {name: "CoffeeScript", mime: "text/x-coffeescript", mode: "coffeescript", ext: ["coffee"], alias: ["coffee", "coffee-script"]},
  {name: "Common Lisp", mime: "text/x-common-lisp", mode: "commonlisp", ext: ["cl", "lisp", "el"], alias: ["lisp"]},
  {name: "Cypher", mime: "application/x-cypher-query", mode: "cypher", ext: ["cyp", "cypher"]},
  {name: "Cython", mime: "text/x-cython", mode: "python", ext: ["pyx", "pxd", "pxi"]},
  {name: "Crystal", mime: "text/x-crystal", mode: "crystal", ext: ["cr"]},
  {name: "CSS", mime: "text/css", mode: "css", ext: ["css"]},
  {name: "CQL", mime: "text/x-cassandra", mode: "sql", ext: ["cql"]},
  {name: "D", mime: "text/x-d", mode: "d", ext: ["d"]},
  {name: "Dart", mimes: ["application/dart", "text/x-dart"], mode: "dart", ext: ["dart"]},
  {name: "diff", mime: "text/x-diff", mode: "diff", ext: ["diff", "patch"]},
  {name: "Django", mime: "text/x-django", mode: "django"},
  {name: "Dockerfile", mime: "text/x-dockerfile", mode: "dockerfile", file: "^Dockerfile$"},
  {name: "DTD", mime: "application/xml-dtd", mode: "dtd", ext: ["dtd"]},
  {name: "Dylan", mime: "text/x-dylan", mode: "dylan", ext: ["dylan", "dyl", "intr"]},
  {name: "EBNF", mime: "text/x-ebnf", mode: "ebnf"},
  {name: "ECL", mime: "text/x-ecl", mode: "ecl", ext: ["ecl"]},
  {name: "Eiffel", mime: "text/x-eiffel", mode: "eiffel", ext: ["e"]},
  {name: "Elm", mime: "text/x-elm", mode: "elm", ext: ["elm"]},
  {name: "Embedded Javascript", mime: "application/x-ejs", mode: "htmlembedded", ext: ["ejs"]},
  {name: "Embedded Ruby", mime: "application/x-erb", mode: "htmlembedded", ext: ["erb"]},
  {name: "Erlang", mime: "text/x-erlang", mode: "erlang", ext: ["erl"]},
  {name: "Factor", mime: "text/x-factor", mode: "factor", ext: ["factor"]},
  {name: "Forth", mime: "text/x-forth", mode: "forth", ext: ["forth", "fth", "4th"]},
  {name: "Fortran", mime: "text/x-fortran", mode: "fortran", ext: ["f", "for", "f77", "f90"]},
  {name: "F#", mime: "text/x-fsharp", mode: "mllike", ext: ["fs"], alias: ["fsharp"]},
  {name: "Gas", mime: "text/x-gas", mode: "gas", ext: ["s"]},
  {name: "Gherkin", mime: "text/x-feature", mode: "gherkin", ext: ["feature"]},
  {name: "GitHub Flavored Markdown", mime: "text/x-gfm", mode: "gfm", file: "^(readme|contributing|history).md$"},
  {name: "Go", mime: "text/x-go", mode: "go", ext: ["go"]},
  {name: "Groovy", mime: "text/x-groovy", mode: "groovy", ext: ["groovy"]},
  {name: "HAML", mime: "text/x-haml", mode: "haml", ext: ["haml"]},
  {name: "Haskell", mime: "text/x-haskell", mode: "haskell", ext: ["hs"]},
  {name: "Haskell (Literate)", mime: "text/x-literate-haskell", mode: "haskell-literate", ext: ["lhs"]},
  {name: "Haxe", mime: "text/x-haxe", mode: "haxe", ext: ["hx"]},
  {name: "HXML", mime: "text/x-hxml", mode: "haxe", ext: ["hxml"]},
  {name: "ASP.NET", mime: "application/x-aspx", mode: "htmlembedded", ext: ["aspx"], alias: ["asp", "aspx"]},
  {name: "HTML", mime: "text/html", mode: "htmlmixed", ext: ["html", "htm"], alias: ["xhtml"]},
  {name: "HTTP", mime: "message/http", mode: "http"},
  {name: "IDL", mime: "text/x-idl", mode: "idl", ext: ["pro"]},
  {name: "Jade", mime: "text/x-jade", mode: "jade", ext: ["jade"]},
  {name: "Java", mime: "text/x-java", mode: "clike", ext: ["java"]},
  {name: "Java Server Pages", mime: "application/x-jsp", mode: "htmlembedded", ext: ["jsp"], alias: ["jsp"]},
  {name: "JavaScript", mimes: ["text/javascript", "text/ecmascript", "application/javascript", "application/x-javascript", "application/ecmascript"],
      mode: "javascript", ext: ["js"], alias: ["ecmascript", "js", "node"]},
  {name: "JSON", mimes: ["application/json", "application/x-json"], mode: "javascript", ext: ["json", "map"], alias: ["json5"]},
  {name: "JSON-LD", mime: "application/ld+json", mode: "javascript", ext: ["jsonld"], alias: ["jsonld"]},
  {name: "JSX", mime: "text/jsx", mode: "jsx", ext: ["jsx"]},
  {name: "Jinja2", mime: "null", mode: "jinja2"},
  {name: "Julia", mime: "text/x-julia", mode: "julia", ext: ["jl"]},
  {name: "Kotlin", mime: "text/x-kotlin", mode: "clike", ext: ["kt"]},
  {name: "LESS", mime: "text/x-less", mode: "css", ext: ["less"]},
  {name: "LiveScript", mime: "text/x-livescript", mode: "livescript", ext: ["ls"], alias: ["ls"]},
  {name: "Lua", mime: "text/x-lua", mode: "lua", ext: ["lua"]},
  {name: "Markdown", mime: "text/x-markdown", mode: "markdown", ext: ["markdown", "md", "mkd"]},
  {name: "mIRC", mime: "text/mirc", mode: "mirc"},
  {name: "MariaDB SQL", mime: "text/x-mariadb", mode: "sql"},
  {name: "Mathematica", mime: "text/x-mathematica", mode: "mathematica", ext: ["m", "nb"]},
  {name: "Modelica", mime: "text/x-modelica", mode: "modelica", ext: ["mo"]},
  {name: "MUMPS", mime: "text/x-mumps", mode: "mumps"},
  {name: "MS SQL", mime: "text/x-mssql", mode: "sql"},
  {name: "MySQL", mime: "text/x-mysql", mode: "sql"},
  {name: "Nginx", mime: "text/x-nginx-conf", mode: "nginx", file: "nginx.*\.conf$"},
  {name: "NSIS", mime: "text/x-nsis", mode: "nsis", ext: ["nsh", "nsi"]},
  {name: "NTriples", mime: "text/n-triples", mode: "ntriples", ext: ["nt"]},
  {name: "Objective C", mime: "text/x-objectivec", mode: "clike", ext: ["m", "mm"]},
  {name: "OCaml", mime: "text/x-ocaml", mode: "mllike", ext: ["ml", "mli", "mll", "mly"]},
  {name: "Octave", mime: "text/x-octave", mode: "octave", ext: ["m"]},
  {name: "Oz", mime: "text/x-oz", mode: "oz", ext: ["oz"]},
  {name: "Pascal", mime: "text/x-pascal", mode: "pascal", ext: ["p", "pas"]},
  {name: "PEG.js", mime: "null", mode: "pegjs", ext: ["jsonld"]},
  {name: "Perl", mime: "text/x-perl", mode: "perl", ext: ["pl", "pm"]},
  {name: "PHP", mime: "application/x-httpd-php", mode: "php", ext: ["php", "php3", "php4", "php5", "phtml"]},
  {name: "Pig", mime: "text/x-pig", mode: "pig", ext: ["pig"]},
  {name: "Plain Text", mime: "text/plain", mode: "null", ext: ["txt", "text", "conf", "def", "list", "log"]},
  {name: "PLSQL", mime: "text/x-plsql", mode: "sql", ext: ["pls"]},
  {name: "Properties files", mime: "text/x-properties", mode: "properties", ext: ["properties", "ini", "in"], alias: ["ini", "properties"]},
  {name: "Python", mime: "text/x-python", mode: "python", ext: ["py", "pyw"]},
  {name: "Puppet", mime: "text/x-puppet", mode: "puppet", ext: ["pp"]},
  {name: "Q", mime: "text/x-q", mode: "q", ext: ["q"]},
  {name: "R", mime: "text/x-rsrc", mode: "r", ext: ["r"], alias: ["rscript"]},
  {name: "reStructuredText", mime: "text/x-rst", mode: "rst", ext: ["rst"], alias: ["rst"]},
  {name: "RPM Changes", mime: "text/x-rpm-changes", mode: "rpm"},
  {name: "RPM Spec", mime: "text/x-rpm-spec", mode: "rpm", ext: ["spec"]},
  {name: "Ruby", mime: "text/x-ruby", mode: "ruby", ext: ["rb"], alias: ["jruby", "macruby", "rake", "rb", "rbx"]},
  {name: "Rust", mime: "text/x-rustsrc", mode: "rust", ext: ["rs"]},
  {name: "Sass", mime: "text/x-sass", mode: "sass", ext: ["sass"]},
  {name: "Scala", mime: "text/x-scala", mode: "clike", ext: ["scala"]},
  {name: "Scheme", mime: "text/x-scheme", mode: "scheme", ext: ["scm", "ss"]},
  {name: "SCSS", mime: "text/x-scss", mode: "css", ext: ["scss"]},
  {name: "Shell", mime: "text/x-sh", mode: "shell", ext: ["sh", "ksh", "bash"], alias: ["bash", "sh", "zsh"], file: "^PKGBUILD$"},
  {name: "Sieve", mime: "application/sieve", mode: "sieve", ext: ["siv", "sieve"]},
  {name: "Slim", mimes: ["text/x-slim", "application/x-slim"], mode: "slim", ext: ["slim"]},
  {name: "Smalltalk", mime: "text/x-stsrc", mode: "smalltalk", ext: ["st"]},
  {name: "Smarty", mime: "text/x-smarty", mode: "smarty", ext: ["tpl"]},
  {name: "Solr", mime: "text/x-solr", mode: "solr"},
  {name: "Soy", mime: "text/x-soy", mode: "soy", ext: ["soy"], alias: ["closure template"]},
  {name: "SPARQL", mime: "application/sparql-query", mode: "sparql", ext: ["rq", "sparql"], alias: ["sparul"]},
  {name: "Spreadsheet", mime: "text/x-spreadsheet", mode: "spreadsheet", alias: ["excel", "formula"]},
  {name: "SQL", mime: "text/x-sql", mode: "sql", ext: ["sql"]},
  {name: "Squirrel", mime: "text/x-squirrel", mode: "clike", ext: ["nut"]},
  {name: "Swift", mime: "text/x-swift", mode: "swift", ext: ["swift"]},
  {name: "MariaDB", mime: "text/x-mariadb", mode: "sql"},
  {name: "sTeX", mime: "text/x-stex", mode: "stex"},
  {name: "LaTeX", mime: "text/x-latex", mode: "stex", ext: ["text", "ltx"], alias: ["tex"]},
  {name: "SystemVerilog", mime: "text/x-systemverilog", mode: "verilog", ext: ["v"]},
  {name: "Tcl", mime: "text/x-tcl", mode: "tcl", ext: ["tcl"]},
  {name: "Textile", mime: "text/x-textile", mode: "textile", ext: ["textile"]},
  {name: "TiddlyWiki ", mime: "text/x-tiddlywiki", mode: "tiddlywiki"},
  {name: "Tiki wiki", mime: "text/tiki", mode: "tiki"},
  {name: "TOML", mime: "text/x-toml", mode: "toml", ext: ["toml"]},
  {name: "Tornado", mime: "text/x-tornado", mode: "tornado"},
  {name: "troff", mime: "troff", mode: "troff", ext: ["1", "2", "3", "4", "5", "6", "7", "8", "9"]},
  {name: "TTCN", mime: "text/x-ttcn", mode: "ttcn", ext: ["ttcn", "ttcn3", "ttcnpp"]},
  {name: "TTCN_CFG", mime: "text/x-ttcn-cfg", mode: "ttcn-cfg", ext: ["cfg"]},
  {name: "Turtle", mime: "text/turtle", mode: "turtle", ext: ["ttl"]},
  {name: "TypeScript", mime: "application/typescript", mode: "javascript", ext: ["ts"], alias: ["ts"]},
  {name: "Twig", mime: "text/x-twig", mode: "twig"},
  {name: "VB.NET", mime: "text/x-vb", mode: "vb", ext: ["vb"]},
  {name: "VBScript", mime: "text/vbscript", mode: "vbscript", ext: ["vbs"]},
  {name: "Velocity", mime: "text/velocity", mode: "velocity", ext: ["vtl"]},
  {name: "Verilog", mime: "text/x-verilog", mode: "verilog", ext: ["v"]},
  {name: "VHDL", mime: "text/x-vhdl", mode: "vhdl", ext: ["vhd", "vhdl"]},
  {name: "XML", mimes: ["application/xml", "text/xml"], mode: "xml", ext: ["xml", "xsl", "xsd"], alias: ["rss", "wsdl", "xsd"]},
  {name: "XQuery", mime: "application/xquery", mode: "xquery", ext: ["xy", "xquery"]},
  {name: "YAML", mime: "text/x-yaml", mode: "yaml", ext: ["yaml", "yml"], alias: ["yml"]},
  {name: "Z80", mime: "text/x-z80", mode: "z80", ext: ["z80"]},
  {name: "mscgen", mime: "text/x-mscgen", mode: "mscgen", ext: ["mscgen", "mscin", "msc"]},
  {name: "xu", mime: "text/x-xu", mode: "mscgen", ext: ["xu"]},
  {name: "msgenny", mime: "text/x-msgenny", mode: "mscgen", ext: ["msgenny"]}
];

/**
 * Try to match a filename to a text mimetype.
 * 
 * @param name the filename to match.
 * @return the matching mimetype or null if one could not be identified.
 */
function filenameToTextMimetype(name: string): string {
  const lowerFilename = name.toLowerCase();
  const dotIndex = lowerFilename.lastIndexOf('.');
  if (dotIndex !== -1) {
    const extension = lowerFilename.slice(lowerFilename.indexOf('.') + 1);
    for (const modeRecord of modeInfo) { 
      if (modeRecord.ext !== undefined && modeRecord.ext.indexOf(extension) !== -1) {
        if (modeRecord.mime !== undefined){ 
          return modeRecord.mime;
        } else {
          if (modeRecord.mimes !== undefined) {
            return modeRecord.mimes[0];
          }
        }
      }
    }
  }
  return null;
}

const mimeTypeMap = {
    bmp: "image/bmp",
    dib: "image/bmp",
    png: "image/png",
    gif: "image/gif",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    jpe: "image/jpeg",
    jif: "image/jpeg",
    jfif: "image/jpeg",
    jfi: "image/jpeg",
    webp: "image/webp"
};

/**
 * Try to match a filename to an image mimetype.
 * 
 * @param name the filename to match.
 * @return the matching mimetype or null if one could not be identified.
 */
function filenameToImageMimetype(name: string): string {
  const lowerFilename = name.toLowerCase();
  const dotIndex = lowerFilename.lastIndexOf('.');
  if (dotIndex !== -1) {
    const extension = lowerFilename.slice(lowerFilename.indexOf('.') + 1);
    if (mimeTypeMap[extension] !== undefined) {
      return mimeTypeMap[extension];
    }
  }
  return null;
}

interface MagicTest {
  tests: [number, string][];
  mimetype: string;
}

const magic: MagicTest[] = [
  { tests: [ [0, "GIF8"]], mimetype: "image/gif"},
  { tests: [ [0, "\x89PNG\x0d\x0a\x1a\x0a"]], mimetype: "image/png"},
  { tests: [ [0, "\xff\xd8"]], mimetype: "image/jpeg"},
  { tests: [ [0, "BM"]], mimetype: "image/bmp"},
  { tests: [ [0, "RIFF"], [8, "WEBP"]], mimetype: "image/webp"}
];

/**
 * Try to match a buffer of bytes to a mimetype.
 * 
 * @param buffer the buffer off bytes to examine.
 * @return the matching mimetype or null if one could not be identified.
 */
function magicToMimeType(buffer: Buffer): string {
  for (const mimeTypeTest of magic) {
    let match = true;
    for(const test of mimeTypeTest.tests) {
      const offset = test[0];
      const stringTest = test[1];
      if ( ! bufferStartsWith(buffer, stringTest, offset)) {
        match = false;
        break;
      }
    }
    if (match) {
      return mimeTypeTest.mimetype;
    }
  }

  return null;
}

/**
 * Check if a byte string appears at the start of a byte buffer.
 * 
 * @param buffer the byte buffer to compare against.
 * @param testString the string of bytes to test.
 * @param offset the offset to start comparing at in the buffer. Optional.
 * @return true if the test string matches the buffer.  
 */
function bufferStartsWith(buffer: Buffer, testString: string, offset=0): boolean {
  if (testString.length + offset> buffer.length) {
    return false;
  }
  for (let i=0; i<testString.length; i++) {
    if (testString.codePointAt(i) !== buffer.readUInt8(i+offset)) {
      return false;
    }
  }
  return true;
}

/**
 * A crude test to see if a buffer contains a binary format or may be text.
 * 
 * @param buffer the buffer to test.
 * @return true if the buffer looks like a binary file format.
 */
function isNotText(buffer: Buffer): boolean {
  const bufferLength = buffer.length < SAMPLE_SIZE ? buffer.length: SAMPLE_SIZE;

  let nonTextCharCount = 0;
  for (let i=0; i<bufferLength; i++) {
    const c = buffer.readUInt8(i);
    if (c <= 6 || // ACK and lower
        c === 8 ||  // Backspace
        (c >= 16 && c <= 22) ||  //DLE to SYN
        c === 255) {

      nonTextCharCount++;
    }
  }
  return nonTextCharCount > 4;  // Allow a couple of bad chars.
}
