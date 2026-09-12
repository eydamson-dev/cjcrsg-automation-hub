/*
|--------------------------------------------------------------------------
| JavaScript entrypoint for running ace commands
|--------------------------------------------------------------------------
|
| DO NOT MODIFY THIS FILE AS IT WILL BE OVERRIDDEN DURING THE BUILD
| PROCESS.
|
| This file registers the ts-exec hook with the Node.js module system
| and then imports the "bin/console.ts" file.
|
*/

import '@poppinss/ts-exec'

await import('./bin/console.js')
