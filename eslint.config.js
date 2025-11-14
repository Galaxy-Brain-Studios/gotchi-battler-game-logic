const js = require('@eslint/js')
const globals = require('globals')

module.exports = [
    js.configs.recommended,
    {
        files: ['**/*.js'],
        languageOptions: {
            ecmaVersion: 2021,
            sourceType: 'commonjs',
            globals: {
                ...globals.node
            }
        },
        rules: {
            quotes: ['error', 'single'],
            semi: ['error', 'never'],
            indent: ['error', 4, { SwitchCase: 1 }],
            'object-curly-spacing': ['error', 'always'],
            'array-bracket-spacing': ['error', 'never']
        }
    },
    {
        files: ['tests/**/*.test.js'],
        languageOptions: {
            globals: {
                ...globals.mocha
            }
        }
    }
] 