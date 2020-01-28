module.exports = {
  parser: "@typescript-eslint/parser",
  parserOptions: {
    "ecmaVersion": 6,
    "sourceType": "module"
  },
  rules: {
    "curly": "warn",
    "eqeqeq": ["warn", "smart"],
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
    "semi": "warn",
    "use-isnan": "warn",
    "valid-typeof": "warn",
  }
};
