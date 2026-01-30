export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat', // New feature
        'fix', // Bug fix
        'docs', // Documentation changes
        'style', // code style changes (formatting, etc)
        'refactor', // Code refactoring
        'perf', // Performance improvement
        'test', // Adding or updating tests
        'build', // Build system or dependencies
        'ci', // CI configuration
        'chore', // Other changes
        'revert', // Revert previous commit
      ],
    ],
    'scope-case': [2, 'always', 'kebab-case'],
    'subject-case': [2, 'always', 'sentence-case'],
  },
};
