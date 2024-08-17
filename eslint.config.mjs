import eslintConfig from '@vroskus/eslint-config';

export default eslintConfig.node({
  configs: [{
    files: ['bin/*'],
    rules: {
      '@typescript-eslint/no-require-imports': [0],
    },
  }],
});
