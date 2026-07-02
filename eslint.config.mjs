import nextConfig from "eslint-config-next";
import coreWebVitalsConfig from "eslint-config-next/core-web-vitals";
import typescriptConfig from "eslint-config-next/typescript";

const eslintConfig = [
  ...nextConfig,
  ...coreWebVitalsConfig,
  ...typescriptConfig,
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "warn",
      "react/no-unescaped-entities": "off",
      "react-hooks/exhaustive-deps": "warn",
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/preserve-manual-memoization": "off",
      "react-hooks/purity": "off",
      "@typescript-eslint/no-empty-object-type": "off",
      "prefer-const": "warn"
    }
  }
];

export default eslintConfig;
