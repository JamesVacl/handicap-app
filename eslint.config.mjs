import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals"),
  {
    rules: {
      "no-restricted-globals": ["error", "window", "document"],
      "no-undef": "error"
    },
    languageOptions: {
      globals: {
        window: 'readonly',
        document: 'readonly'
      }
    }
  }
];

export default eslintConfig;
