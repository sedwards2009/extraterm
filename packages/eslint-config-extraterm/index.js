module.exports = {
  parser: "@typescript-eslint/parser",
  parserOptions: {
    "ecmaVersion": 6,
    "sourceType": "module"
  },
  "plugins": [
    "unicorn"
  ],
  rules: {
    "curly": "warn",
    "eqeqeq": ["warn", "smart"],
    "indent": ["warn", 2, {
      "SwitchCase": 1,
      "MemberExpression": "off",
      "FunctionDeclaration": {"parameters": "off"},
      "FunctionExpression": {"parameters": "off"},
      "CallExpression": {"arguments": "off"},
      "ArrayExpression": "off",
      "ObjectExpression": "off",
      "ImportDeclaration": "off",
      "ignoreComments": true,
      "ignoredNodes": ["ConditionalExpression"]
    }],
    "no-cond-assign": ["warn", "always"],
    "no-dupe-keys": "warn",
    "no-duplicate-case": "warn",
    "no-implicit-coercion": ["warn", {"string": false}],
    "no-irregular-whitespace": "warn",
    "no-sequences": "warn",
    "no-sparse-arrays": "warn",
    "no-tabs": "warn",
    "no-unreachable": "warn",
    "no-unsafe-negation": "warn",
    "no-var": "warn",
    "no-with": "warn",
    "one-var": ["warn", "never"],
    "one-var-declaration-per-line": ["warn", "always"],
    "prefer-const": ["warn", {
      "destructuring": "all"
    }],
    "semi": "warn",
    "use-isnan": "warn",
    "valid-typeof": "warn",
    "unicorn/prefer-node-protocol": ["error"],
    "unicorn/prefer-module": ["error"]
  }
};
