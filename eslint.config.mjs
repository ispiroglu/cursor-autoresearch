import eslint from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import tseslint from "typescript-eslint";

const typeCheckedPackages = tseslint.configs.recommendedTypeChecked.map(
  (config) => ({
    ...config,
    files: ["packages/**/*.ts"],
  })
);

export default defineConfig(
  globalIgnores([
    "**/dist/**",
    "**/node_modules/**",
    "**/.pnpm/**",
    "**/*.vsix",
  ]),
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  ...typeCheckedPackages,
  {
    files: ["packages/**/*.ts"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-return": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/restrict-template-expressions": "off",
      "@typescript-eslint/no-base-to-string": "off",
      "@typescript-eslint/require-await": "off",
    },
  },
  {
    files: ["scripts/**/*.mjs"],
    languageOptions: {
      globals: {
        console: "readonly",
        process: "readonly",
      },
    },
  }
);
