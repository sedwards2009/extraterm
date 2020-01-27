module.exports = {
  parser: "@typescript-eslint/parser",
  parserOptions: {
    "ecmaVersion": 6,
    "sourceType": "module"
  },
  rules: {
    "no-cond-assign": ["warn", "always"],
    "no-sparse-arrays": "warn",
    "curly": "warn",
    "eqeqeq": ["warn", "smart"],
    "no-sequences": "warn",
  }
};
