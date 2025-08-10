import eslint from "@eslint/js";
import "eslint-plugin-only-warn";
import tseslint from "typescript-eslint";

export default tseslint.config(eslint.configs.recommended, tseslint.configs.recommended);
